import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /v1/runs/:runId/events — durable event log (cursor via ?after= ISO timestamp or event id).
export async function GET(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { runId } = await ctx.params;
    const raw = runId.replace(/^run_/, '');
    const supabase = createAdminClient();
    const { data: run } = await supabase.from('embedded_runs').select('id').eq('project_id', validation.context.projectId).eq('id', raw).maybeSingle();
    if (!run) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Run not found', { requestId }), { requestId });

    const url = new URL(req.url);
    const after = url.searchParams.get('after');
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50));
    let query = supabase.from('embedded_run_events').select('*').eq('run_id', raw).order('created_at', { ascending: true }).limit(limit + 1);
    if (after) query = query.gt('created_at', after);
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return addGatewayHeaders(
        NextResponse.json({ data: page.map((e) => ({ id: e.id, event: e.event_type, data: e.payload, created_at: e.created_at })), next_cursor: hasMore ? (page[page.length - 1].created_at as string) : null }),
        { requestId },
    );
}
