import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { PROVIDER_SYNC_PREFIX } from '@/lib/embedded/types';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/provider-connections/:connectionId/model-syncs/:syncId/apply — idempotent, never deletes missing, never reassigns agents.
export async function POST(req: NextRequest, ctx: { params: Promise<{ connectionId: string; syncId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId, syncId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: syncRow } = await supabase
        .from('provider_model_syncs')
        .select('*')
        .eq('project_id', validation.context.projectId)
        .eq('provider_connection_id', dePrefixId(connectionId))
        .eq('id', dePrefixId(syncId))
        .maybeSingle();
    if (!syncRow) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Model sync not found', { requestId }), { requestId });
    const sync = syncRow as { id: string; status: string; expires_at: string | null; diff_json: { upstream?: Array<{ id: string; display_name?: string | null }>; models?: Array<{ upstream_model_id: string; classification: string }> }; provider_connection_id: string };

    if (sync.status === 'applied') {
        return addGatewayHeaders(NextResponse.json({ id: withPrefix(PROVIDER_SYNC_PREFIX, sync.id), status: 'applied', deduped: true }), { requestId });
    }
    // 'failed' applies may be retried (partial failure leaves rows behind, upserts are idempotent).
    if (sync.status !== 'ready' && sync.status !== 'failed') {
        return addGatewayHeaders(embeddedError(409, 'sync_already_applied', `Sync is ${sync.status}`, { requestId }), { requestId });
    }
    if (sync.expires_at && Date.parse(sync.expires_at) <= Date.now()) {
        await supabase.from('provider_model_syncs').update({ status: 'expired' }).eq('id', sync.id);
        return addGatewayHeaders(embeddedError(410, 'sync_expired', 'Sync preview expired; create a new preview', { requestId }), { requestId });
    }

    const upstream = sync.diff_json?.upstream ?? [];

    // Pricing gate: a discovered model is not marked available until exact
    // pricing exists. Mirror the registry rule (active row, or a scheduled
    // changeover carrying its follow-on rate).
    const { data: pricingRows } = await supabase.from('model_pricing').select('provider, model_name, pricing_expires_at, next_input_price_per_1k_tokens, next_output_price_per_1k_tokens').eq('is_active', true);
    const { data: conn } = await supabase.from('provider_connections').select('provider').eq('id', sync.provider_connection_id).maybeSingle();
    const providerName = ((conn as { provider?: string } | null)?.provider as string) ?? '';
    const priced = new Set(
        ((pricingRows ?? []) as Array<{ provider: string; model_name: string; pricing_expires_at?: string; next_input_price_per_1k_tokens?: number; next_output_price_per_1k_tokens?: number }>)
            .filter((row) => !row.pricing_expires_at || Date.parse(row.pricing_expires_at) > Date.now() || (row.next_input_price_per_1k_tokens != null && row.next_output_price_per_1k_tokens != null))
            .map((row) => `${row.provider}:${row.model_name}`),
    );

    // Upsert new/unchanged; leave missing_upstream rows untouched (never auto-delete).
    // Per-row failures are collected: a partial apply is reported as failed and
    // the sync is NOT marked applied, so retry is safe and explicit.
    const applied: string[] = [];
    const rowErrors: Array<{ model: string; error: string }> = [];
    for (const m of upstream) {
        const classification = sync.diff_json?.models?.find((d) => d.upstream_model_id === m.id)?.classification;
        if (classification === 'unsupported') continue;
        const hasPricing = priced.has(`${providerName}:${m.id}`);
        try {
            const { error: upsertError } = await supabase.from('provider_connection_models').upsert(
                {
                    project_id: validation.context.projectId,
                    provider_connection_id: sync.provider_connection_id,
                    upstream_model_id: m.id,
                    display_name: m.display_name ?? m.id,
                    capabilities: ['chat'],
                    context_window: 0,
                    lifecycle_status: 'active',
                    availability_status: hasPricing ? 'available' : 'unavailable',
                    unavailable_reason: hasPricing ? null : 'pricing_required',
                    pricing_status: hasPricing ? 'priced' : 'unpriced',
                    upstream_snapshot: { id: m.id },
                    last_seen_at: new Date().toISOString(),
                },
                { onConflict: 'provider_connection_id,upstream_model_id' },
            );
            if (upsertError) throw new Error(upsertError.message);
            applied.push(m.id);
        } catch (e) {
            rowErrors.push({ model: m.id, error: e instanceof Error ? e.message : 'Upsert failed' });
        }
    }

    if (rowErrors.length > 0) {
        await supabase.from('provider_model_syncs').update({
            status: 'failed',
            diff_json: { ...(sync.diff_json ?? {}), apply_errors: rowErrors, applied },
        }).eq('id', sync.id);
        return addGatewayHeaders(
            embeddedError(502, 'sync_apply_failed', `${rowErrors.length} of ${upstream.length} models failed to apply; sync not marked applied`, { requestId }),
            { requestId },
        );
    }

    await supabase.from('provider_model_syncs').update({ status: 'applied', applied_at: new Date().toISOString() }).eq('id', sync.id);
    await supabase.from('provider_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', sync.provider_connection_id);

    return addGatewayHeaders(NextResponse.json({ id: withPrefix(PROVIDER_SYNC_PREFIX, sync.id), status: 'applied', applied_count: applied.length }), { requestId });
}
