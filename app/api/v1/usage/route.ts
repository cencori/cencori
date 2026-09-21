import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import { groupUsage, parseWindow } from '@/lib/embedded/usage';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function applyScopeFilters(query: never, url: URLSearchParams): never {
    const tenant = url.get('tenant_id');
    const agent = url.get('agent_id');
    const installation = url.get('installation_id');
    const model = url.get('model');
    let q = query as unknown as {
        eq(col: string, val: string): unknown;
    };
    if (tenant) q = q.eq('tenant_id', dePrefixId(tenant)) as typeof q;
    if (agent) q = q.eq('agent_id', dePrefixId(agent)) as typeof q;
    if (installation) q = q.eq('installation_id', dePrefixId(installation)) as typeof q;
    if (model) q = q.eq('model', model) as typeof q;
    return q as never;
}

// GET /v1/usage — summary grouped by tenant/agent/installation/model/day.
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const url = new URL(req.url);
    const window = parseWindow(url.searchParams);
    if ('error' in window) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', window.error, { requestId }), { requestId });

    const supabase = createAdminClient();
    let query = supabase
        .from('ai_requests')
        .select('tenant_id, agent_id, installation_id, model, provider, prompt_tokens, completion_tokens, total_tokens, cost_usd, provider_cost_usd, cencori_charge_usd, created_at')
        .eq('project_id', validation.context.projectId)
        .gte('created_at', window.since)
        .lte('created_at', window.until)
        .order('created_at', { ascending: false })
        .limit(10000);
    query = applyScopeFilters(query as never, url.searchParams) as never;
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        tenant_id: (r.tenant_id as string | null) ?? null,
        agent_id: (r.agent_id as string | null) ?? null,
        installation_id: (r.installation_id as string | null) ?? null,
        model: (r.model as string) ?? 'unknown',
        provider: (r.provider as string) ?? 'unknown',
        prompt_tokens: Number(r.prompt_tokens ?? 0),
        completion_tokens: Number(r.completion_tokens ?? 0),
        total_tokens: Number(r.total_tokens ?? 0),
        cost_usd: Number(r.cost_usd ?? 0),
        provider_cost_usd: Number(r.provider_cost_usd ?? 0),
        cencori_charge_usd: Number(r.cencori_charge_usd ?? 0),
        created_at: (r.created_at as string) ?? new Date().toISOString(),
    }));
    const groups = groupUsage(rows);
    const totals = rows.reduce(
        (acc, r) => ({ requests: acc.requests + 1, total_tokens: acc.total_tokens + r.total_tokens, cost_usd: acc.cost_usd + r.cost_usd, cencori_charge_usd: acc.cencori_charge_usd + r.cencori_charge_usd }),
        { requests: 0, total_tokens: 0, cost_usd: 0, cencori_charge_usd: 0 },
    );
    return addGatewayHeaders(NextResponse.json({ window: { since: window.since, until: window.until }, totals, groups }), { requestId });
}
