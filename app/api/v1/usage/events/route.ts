import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import { parseWindow } from '@/lib/embedded/usage';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// Opaque keyset cursor over (created_at, id) so equal-timestamp rows
// straddling the boundary are not skipped. Raw-timestamp cursors issued
// before keyset pagination are still accepted (no id tiebreaker there).
function encodeUsageCursor(createdAt: string, id: string): string {
    return Buffer.from(JSON.stringify({ c: createdAt, i: id }), 'utf8').toString('base64url');
}

function parseUsageCursor(raw: string | null): { cursor: { createdAt: string; id: string | null } } | { error: string } | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { c?: unknown; i?: unknown };
        if (parsed && typeof parsed.c === 'string' && parsed.c) {
            return { cursor: { createdAt: parsed.c, id: typeof parsed.i === 'string' && parsed.i ? parsed.i : null } };
        }
    } catch {
        // Not an opaque cursor — fall through to legacy handling below.
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return { cursor: { createdAt: raw, id: null } };
    return { error: 'Invalid cursor' };
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
    const parsedCursor = parseUsageCursor(url.searchParams.get('cursor'));
    if (parsedCursor && 'error' in parsedCursor) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', parsedCursor.error, { requestId }), { requestId });
    const supabase = createAdminClient();
    let query = supabase
        .from('ai_requests')
        .select('id, model, provider, status, total_tokens, cost_usd, cencori_charge_usd, tenant_id, agent_id, installation_id, session_id, run_id, end_user_id, created_at')
        .eq('project_id', validation.context.projectId)
        .gte('created_at', window.since)
        .lte('created_at', window.until)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);
    const tenant = url.searchParams.get('tenant_id');
    const agent = url.searchParams.get('agent_id');
    const installation = url.searchParams.get('installation_id');
    const model = url.searchParams.get('model');
    if (tenant) query = query.eq('tenant_id', dePrefixId(tenant));
    if (agent) query = query.eq('agent_id', dePrefixId(agent));
    if (installation) query = query.eq('installation_id', dePrefixId(installation));
    if (model) query = query.eq('model', model);
    if (parsedCursor && 'cursor' in parsedCursor && parsedCursor.cursor) {
        const { createdAt, id } = parsedCursor.cursor;
        query = id
            ? query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`)
            : query.lt('created_at', createdAt);
    }
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return addGatewayHeaders(
        NextResponse.json({
            data: page,
            next_cursor: hasMore && last ? encodeUsageCursor(last.created_at as string, last.id as string) : null,
        }),
        { requestId },
    );
}
