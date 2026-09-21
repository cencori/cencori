import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import { parseWindow } from '@/lib/embedded/usage';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /v1/usage/events — paginated attributed request rows.
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const url = new URL(req.url);
    const window = parseWindow(url.searchParams);
    if ('error' in window) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', window.error, { requestId }), { requestId });

    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
    const cursor = url.searchParams.get('cursor');
    const supabase = createAdminClient();
    let query = supabase
        .from('ai_requests')
        .select('id, model, provider, status, total_tokens, cost_usd, cencori_charge_usd, tenant_id, agent_id, installation_id, session_id, run_id, end_user_id, created_at')
        .eq('project_id', validation.context.projectId)
        .gte('created_at', window.since)
        .lte('created_at', window.until)
        .order('created_at', { ascending: false })
        .limit(limit + 1);
    const tenant = url.searchParams.get('tenant_id');
    const agent = url.searchParams.get('agent_id');
    if (tenant) query = query.eq('tenant_id', dePrefixId(tenant));
    if (agent) query = query.eq('agent_id', dePrefixId(agent));
    if (cursor) query = query.lt('created_at', cursor);
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return addGatewayHeaders(
        NextResponse.json({ data: page, next_cursor: hasMore ? (page[page.length - 1].created_at as string) : null }),
        { requestId },
    );
}
