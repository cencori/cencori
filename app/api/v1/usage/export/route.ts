import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import { groupUsage, parseWindow, toCsv, USAGE_EXPORT_ROW_LIMIT } from '@/lib/embedded/usage';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /v1/usage/export — invoice-quality export grouped by tenant+agent (?format=csv|json).
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const url = new URL(req.url);
    const window = parseWindow(url.searchParams);
    if ('error' in window) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', window.error, { requestId }), { requestId });
    const format = (url.searchParams.get('format') ?? 'json').toLowerCase();
    if (!['json', 'csv'].includes(format)) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'format must be json or csv', { requestId }), { requestId });
    }

    const supabase = createAdminClient();
    let query = supabase
        .from('ai_requests')
        .select('tenant_id, agent_id, installation_id, model, provider, prompt_tokens, completion_tokens, total_tokens, cost_usd, provider_cost_usd, cencori_charge_usd, created_at')
        .eq('project_id', validation.context.projectId)
        .gte('created_at', window.since)
        .lte('created_at', window.until)
        .order('created_at', { ascending: false })
        .limit(USAGE_EXPORT_ROW_LIMIT);
    const tenant = url.searchParams.get('tenant_id');
    const agent = url.searchParams.get('agent_id');
    if (tenant) query = query.eq('tenant_id', dePrefixId(tenant));
    if (agent) query = query.eq('agent_id', dePrefixId(agent));
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
    if (format === 'csv') {
        return addGatewayHeaders(
            new NextResponse(toCsv(groups), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="usage-${window.since.slice(0, 10)}-${window.until.slice(0, 10)}.csv"` } }),
            { requestId },
        );
    }
    return addGatewayHeaders(NextResponse.json({ window: { since: window.since, until: window.until }, groups, truncated: rows.length >= USAGE_EXPORT_ROW_LIMIT }), { requestId });
}
