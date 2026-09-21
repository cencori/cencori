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
    const { normalizeManifest, validateManifest } = await import('@/lib/embedded/manifest');
    const manifest = normalizeManifest(((target.config_json ?? {}) as Record<string, unknown>) as Record<string, unknown>);
    const manifestCheck = await validateManifest(supabase as never, { projectId: validation.context.projectId, agentId, manifest });
    if (!manifestCheck.valid) {
        return addGatewayHeaders(embeddedError(422, 'invalid_request_error', `Manifest invalid: ${manifestCheck.errors.slice(0, 3).join('; ')}`, { requestId }), { requestId });
    }
    if (body.visibility && ['private', 'tenant', 'unlisted', 'public'].includes(body.visibility)) {
        const { error: visError } = await supabase.from('agent_versions').update({ visibility: body.visibility }).eq('id', target.id as string);
        if (visError) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', visError.message, { requestId }), { requestId });
    }
    // Atomic publish via RPC (status + pins + stable pointer commit together).
    const { data, error } = await supabase.rpc('publish_embedded_agent_version', {
        p_version_id: (target.id as string),
        p_project_id: validation.context.projectId,
        p_reviewed_by: body.reviewed_by ?? null,
        p_set_stable: true,
        p_skill_version_ids: manifest.skills.map((s) => s.skill_version_id.replace(/^(skv_)/, '')),
        p_subagents: manifest.subagents.map((s) => ({ agent_version_id: s.agent_version_id.replace(/^(agv_)/, ''), max_calls: s.max_calls })),
    });
    if (error) {
        return addGatewayHeaders(mapReviewError(error.message, requestId), { requestId });
    }
    return addGatewayHeaders(NextResponse.json(data), { requestId });
}

function mapReviewError(message: string, requestId: string) {
    if (/version_not_found/.test(message)) {
        return embeddedError(404, 'invalid_request_error', 'Agent version not found', { requestId });
    }
    if (/invalid_status/.test(message)) {
        return embeddedError(409, 'invalid_request_error', 'Version is no longer reviewable', { requestId });
    }
    if (/untested_version/.test(message)) {
        return embeddedError(409, 'invalid_request_error', 'Version has no passing isolated test; POST .../test first', { requestId });
    }
    if (/unpublished_(skill|subagent)/.test(message) || /self_cycle/.test(message)) {
        return embeddedError(422, 'invalid_request_error', `Capability pin failed: ${message}`, { requestId });
    }
    return embeddedError(500, 'invalid_request_error', 'Review failed', { requestId });
}
