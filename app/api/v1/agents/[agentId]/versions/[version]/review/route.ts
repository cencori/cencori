import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { validateVersionConfig } from '@/lib/embedded/agents';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

async function loadTarget(supabase: ReturnType<typeof createAdminClient>, projectId: string, agentId: string, version: string) {
    const { data: agent } = await supabase.from('agents').select('id, project_id').eq('id', agentId).maybeSingle();
    if (!agent || (agent.project_id as string) !== projectId) return null;
    const { data } = await supabase.from('agent_versions').select('*').eq('agent_id', agentId).eq('version', version).maybeSingle();
    return (data ?? (await supabase.from('agent_versions').select('*').eq('id', version).eq('agent_id', agentId).maybeSingle()).data ?? null) as Record<string, unknown> | null;
}

// POST .../review {decision: approve|reject} — approve → published (+stable, reviewed_by); reject → draft.
export async function POST(req: NextRequest, ctx: { params: Promise<{ agentId: string; version: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { agentId, version } = await ctx.params;
    const supabase = createAdminClient();
    const target = await loadTarget(supabase, validation.context.projectId, agentId, version);
    if (!target) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent version not found', { requestId }), { requestId });
    const current = (target.status as string) ?? 'draft';
    if (current !== 'ready_for_review') {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Only versions in review can be reviewed (current: ${current})`, { requestId }), { requestId });
    }

    let body: { decision?: string; reviewed_by?: string; reason?: string; visibility?: string };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (body.decision !== 'approve' && body.decision !== 'reject') {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'decision must be approve or reject', { requestId }), { requestId });
    }
    if (body.decision === 'reject') {
        const { data, error } = await supabase.from('agent_versions').update({ status: 'draft', reviewed_by: body.reviewed_by ?? null }).eq('id', target.id as string).select('id, version, status').single();
        if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Review failed', { requestId }), { requestId });
        return addGatewayHeaders(NextResponse.json({ ...data, reason: body.reason ?? null }), { requestId });
    }

    const checked = validateVersionConfig(((target.config_json ?? {}) as Record<string, unknown>) as never);
    if (!checked.ok) return addGatewayHeaders(embeddedError(422, 'invalid_request_error', checked.message, { requestId }), { requestId });
    const patch: Record<string, unknown> = { status: 'published', published_at: new Date().toISOString(), reviewed_by: body.reviewed_by ?? null };
    if (body.visibility && ['private', 'tenant', 'unlisted', 'public'].includes(body.visibility)) patch.visibility = body.visibility;
    const { data, error } = await supabase.from('agent_versions').update(patch).eq('id', target.id as string).select('id, version, status, visibility, published_at').single();
    if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Review failed', { requestId }), { requestId });
    await supabase.from('agents').update({ stable_version_id: (target.id as string) }).eq('id', agentId);
    return addGatewayHeaders(NextResponse.json(data), { requestId });
}
