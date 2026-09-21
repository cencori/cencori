import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import { decryptApiKey } from '@/lib/encryption';
import { safeOutboundFetch } from '@/lib/security/outbound-url';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/provider-connections/:connectionId/test — saved-credential probe.
export async function POST(req: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: row } = await supabase
        .from('provider_connections')
        .select('*')
        .eq('project_id', validation.context.projectId)
        .eq('id', dePrefixId(connectionId))
        .maybeSingle();
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Provider connection not found', { requestId }), { requestId });

    const started = Date.now();
    try {
        const baseUrl = (row.base_url as string | null) ?? null;
        const apiFormat = (row.api_format as string) ?? 'openai';
        if (!baseUrl) {
            // Official provider: key-presence check only in M0 (no upstream call without explicit probe opt-in).
            const hasKey = Boolean(row.encrypted_key_ref);
            await supabase.from('provider_connections').update({ last_tested_at: new Date().toISOString(), status: hasKey ? 'active' : 'unhealthy' }).eq('id', row.id as string);
            return addGatewayHeaders(
                NextResponse.json({ success: hasKey, reachable: null, authenticated: hasKey, latency_ms: Date.now() - started, discovery_supported: true }),
                { requestId },
            );
        }
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (row.encrypted_key_ref) {
            try {
                const key = decryptApiKey(row.encrypted_key_ref as string, validation.context.organizationId);
                headers.Authorization = apiFormat === 'anthropic' || apiFormat === 'anthropic-compatible' ? `Bearer ${key}` : `Bearer ${key}`;
                if (apiFormat.startsWith('anthropic')) {
                    (headers as Record<string, string>)['x-api-key'] = key;
                    (headers as Record<string, string>)['anthropic-version'] = '2023-06-01';
                }
            } catch {
                return addGatewayHeaders(embeddedError(500, 'invalid_request_error', 'Stored credential cannot be decrypted', { requestId }), { requestId });
            }
        }
        const modelsUrl = `${baseUrl.replace(/\/$/, '')}/models`;
        const res = await safeOutboundFetch(modelsUrl, { headers, signal: AbortSignal.timeout(15000) }, { maxRedirects: 0 });
        const latencyMs = Date.now() - started;
        if (!res.ok) {
            await supabase.from('provider_connections').update({ last_tested_at: new Date().toISOString(), status: 'unhealthy' }).eq('id', row.id as string);
            return addGatewayHeaders(NextResponse.json({ success: false, reachable: true, authenticated: res.status !== 401 && res.status !== 403, latency_ms: latencyMs, status: res.status }), { requestId });
        }
        const json = (await res.json().catch(() => null)) as { data?: unknown[] } | null;
        await supabase.from('provider_connections').update({ last_tested_at: new Date().toISOString(), status: 'active' }).eq('id', row.id as string);
        return addGatewayHeaders(
            NextResponse.json({ success: true, reachable: true, authenticated: true, latency_ms: latencyMs, discovery_supported: true, model_count: Array.isArray(json?.data) ? json?.data.length : null }),
            { requestId },
        );
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Connection test failed';
        await supabase.from('provider_connections').update({ last_tested_at: new Date().toISOString(), status: 'unhealthy' }).eq('id', row.id as string);
        return addGatewayHeaders(NextResponse.json({ success: false, reachable: false, authenticated: false, latency_ms: Date.now() - started, error: message }), { requestId });
    }
}
