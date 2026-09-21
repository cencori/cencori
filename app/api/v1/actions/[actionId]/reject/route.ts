import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { emitEmbeddedEvent } from '@/lib/embedded/runs';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/actions/:actionId/reject — idempotent; terminal-state conflicts 409.
export async function POST(req: NextRequest, ctx: { params: Promise<{ actionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { actionId } = await ctx.params;
    const supabase = createAdminClient();
    const { data } = await supabase.from('actions').select('*').eq('project_id', validation.context.projectId).eq('id', dePrefixId(actionId)).maybeSingle();
    if (!data) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Action not found', { requestId }), { requestId });
    const action = data as { id: string; status: string; project_id: string; tool_name: string };

    if (action.status === 'rejected') {
        return addGatewayHeaders(NextResponse.json({ id: withPrefix('act', action.id), status: 'rejected', deduped: true }), { requestId });
    }
    if (action.status !== 'pending') {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Cannot reject action in status ${action.status}`, { requestId }), { requestId });
    }
    let body: { rejected_by?: string; reason?: string } = {};
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }
    const { data: claimed } = await supabase.from('actions').update({ status: 'rejected', approved_by: body.rejected_by ?? null, resolved_at: new Date().toISOString(), error: (body.reason as string) ?? null }).eq('id', action.id).eq('status', 'pending').select('id').maybeSingle();
    if (!claimed) {
        const { data: current } = await supabase.from('actions').select('status').eq('id', action.id).maybeSingle();
        const currentStatus = (current as { status?: string } | null)?.status;
        if (currentStatus === 'rejected') {
            return addGatewayHeaders(NextResponse.json({ id: withPrefix('act', action.id), status: 'rejected', deduped: true }), { requestId });
        }
        return addGatewayHeaders(embeddedError(409, 'concurrent_modification', 'Action was already resolved by another approver', { requestId }), { requestId });
    }
    await emitEmbeddedEvent(action.project_id, 'action.rejected', { action_id: action.id, tool: action.tool_name });
    return addGatewayHeaders(NextResponse.json({ id: withPrefix('act', action.id), status: 'rejected' }), { requestId });
}
