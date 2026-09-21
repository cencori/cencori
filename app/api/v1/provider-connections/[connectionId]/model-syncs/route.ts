import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix, getIdempotencyKey } from '@/lib/embedded/http';
import { PROVIDER_CONNECTION_PREFIX, PROVIDER_SYNC_PREFIX } from '@/lib/embedded/types';
import { decryptApiKey } from '@/lib/encryption';
import { safeOutboundFetch } from '@/lib/security/outbound-url';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

interface UpstreamModel {
    id: string;
    displayName?: string;
    capabilities?: string[];
    contextWindow?: number;
}

// POST /v1/provider-connections/:connectionId/model-syncs — durable preview.
export async function POST(req: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: conn } = await supabase
        .from('provider_connections')
        .select('*')
        .eq('project_id', validation.context.projectId)
        .eq('id', dePrefixId(connectionId))
        .maybeSingle();
    if (!conn) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Provider connection not found', { requestId }), { requestId });

    const idempotencyKey = getIdempotencyKey(req.headers);
    if (idempotencyKey) {
        const { data: existing } = await supabase
            .from('provider_model_syncs')
            .select('*')
            .eq('provider_connection_id', conn.id as string)
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle();
        if (existing) {
            const e = existing as Record<string, unknown>;
            return addGatewayHeaders(NextResponse.json({ id: withPrefix(PROVIDER_SYNC_PREFIX, e.id as string), status: e.status, counts: (e.diff_json as { counts?: unknown })?.counts ?? {} }), { requestId });
        }
    }

    // Discover upstream models.
    let upstream: UpstreamModel[] = [];
    let upstreamEtag: string | null = null;
    const baseUrl = (conn.base_url as string | null) ?? null;
    if (baseUrl) {
        try {
            const headers: Record<string, string> = {};
            if (conn.encrypted_key_ref) {
                try {
                    const key = decryptApiKey(conn.encrypted_key_ref as string, validation.context.organizationId);
                    headers.Authorization = `Bearer ${key}`;
                } catch {
                    return addGatewayHeaders(embeddedError(500, 'invalid_request_error', 'Stored credential cannot be decrypted', { requestId }), { requestId });
                }
            }
            const res = await safeOutboundFetch(`${baseUrl.replace(/\/$/, '')}/models`, { headers, signal: AbortSignal.timeout(15000) }, { maxRedirects: 0 });
            if (!res.ok) {
                return addGatewayHeaders(embeddedError(502, 'provider_unhealthy', `Upstream model discovery failed with status ${res.status}`, { requestId }), { requestId });
            }
            upstreamEtag = res.headers.get('etag');
            const json = (await res.json().catch(() => null)) as { data?: Array<{ id?: string; name?: string; display_name?: string }> } | null;
            upstream = (json?.data ?? []).filter((m) => m.id).map((m) => ({ id: m.id as string, displayName: m.display_name ?? m.name }));
        } catch (e) {
            return addGatewayHeaders(embeddedError(502, 'provider_unhealthy', e instanceof Error ? e.message : 'Upstream discovery failed', { requestId }), { requestId });
        }
    } else {
        // Official provider without custom base URL: snapshot is empty in M0 (managed catalog is source of truth).
        upstream = [];
    }

    const { data: existingModels } = await supabase.from('provider_connection_models').select('upstream_model_id').eq('provider_connection_id', conn.id as string);
    const known = new Set(((existingModels ?? []) as Array<{ upstream_model_id: string }>).map((m) => m.upstream_model_id));
    const seen = new Set(upstream.map((m) => m.id));
    const counts = { new: 0, updated: 0, unchanged: 0, missing_upstream: 0, unsupported: 0 };
    const details: Array<{ upstream_model_id: string; classification: string; display_name: string | null }> = [];
    for (const m of upstream) {
        // M0 heuristic: ids with whitespace/control chars are unsupported.
        if (/[\s]/.test(m.id) || m.id.length > 128) {
            counts.unsupported += 1;
            details.push({ upstream_model_id: m.id, classification: 'unsupported', display_name: m.displayName ?? null });
            continue;
        }
        if (!known.has(m.id)) {
            counts.new += 1;
            details.push({ upstream_model_id: m.id, classification: 'new', display_name: m.displayName ?? null });
        } else {
            counts.unchanged += 1;
            details.push({ upstream_model_id: m.id, classification: 'unchanged', display_name: m.displayName ?? null });
        }
    }
    for (const id of known) {
        if (!seen.has(id)) counts.missing_upstream += 1;
    }

    const snapshotHash = crypto.createHash('sha256').update(JSON.stringify(upstream.map((m) => m.id).sort())).digest('hex');
    const { data: sync, error } = await supabase
        .from('provider_model_syncs')
        .insert({
            project_id: validation.context.projectId,
            provider_connection_id: conn.id as string,
            status: 'ready',
            upstream_etag: upstreamEtag,
            diff_json: { counts, models: details, upstream: upstream.map((m) => ({ id: m.id, display_name: m.displayName ?? null })) },
            snapshot_hash: snapshotHash,
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            idempotency_key: idempotencyKey,
        })
        .select('*')
        .single();
    if (error || !sync) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to create sync preview', { requestId }), { requestId });
    }
    const s = sync as Record<string, unknown>;
    return addGatewayHeaders(
        NextResponse.json({ id: withPrefix(PROVIDER_SYNC_PREFIX, s.id as string), status: s.status, counts, expires_at: s.expires_at, connection_id: withPrefix(PROVIDER_CONNECTION_PREFIX, conn.id as string) }, { status: 201 }),
        { requestId },
    );
}
