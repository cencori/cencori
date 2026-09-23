import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { validateVersionConfig } from '@/lib/embedded/agents';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST .../publish — validating|ready_for_review → published (+ stable pointer).
// Status flip, capability pins, and stable pointer commit atomically inside
// publish_embedded_agent_version: a pinning failure can never leave a
// published-but-incomplete version behind.
export async function POST(req: NextRequest, ctx: { params: Promise<{ agentId: string; version: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { agentId, version } = await ctx.params;
    const supabase = createAdminClient();
    const { data: agent } = await supabase.from('agents').select('id, project_id').eq('id', agentId).maybeSingle();
    if (!agent || (agent.project_id as string) !== validation.context.projectId) {
        return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent not found', { requestId }), { requestId });
    }
    const { data: row } = await supabase.from('agent_versions').select('*').eq('agent_id', agentId).eq('version', version).maybeSingle();
    const target = row ?? (await supabase.from('agent_versions').select('*').eq('id', version).eq('agent_id', agentId).maybeSingle()).data;
    if (!target) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent version not found', { requestId }), { requestId });
    const current = (target.status as string) ?? 'draft';
    // The authoring lifecycle requires validation and a passing isolated test
    // before publication: draft → validate → test → ready_for_review → publish.
    if (!['validating', 'ready_for_review'].includes(current)) {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Validate the version before publishing (current: ${current}); POST .../validate then .../test`, { requestId }), { requestId });
    }
    const checked = validateVersionConfig(((target.config_json ?? {}) as Record<string, unknown>) as never);
    if (!checked.ok) return addGatewayHeaders(embeddedError(422, 'invalid_request_error', checked.message, { requestId }), { requestId });

    const { normalizeManifest, validateManifest } = await import('@/lib/embedded/manifest');
    const manifest = normalizeManifest(((target.config_json ?? {}) as Record<string, unknown>) as Record<string, unknown>);
    const check = await validateManifest(supabase as never, { projectId: validation.context.projectId, agentId, manifest });
    if (!check.valid) {
        return addGatewayHeaders(embeddedError(422, 'invalid_request_error', `Manifest invalid: ${check.errors.slice(0, 3).join('; ')}`, { requestId }), { requestId });
    }

    const { data: published, error } = await supabase.rpc('publish_embedded_agent_version', {
        p_version_id: (target.id as string),
        p_project_id: validation.context.projectId,
        p_reviewed_by: null,
        p_set_stable: true,
        p_skill_version_ids: manifest.skills.map((s) => s.skill_version_id.replace(/^(skv_)/, '')),
        p_subagents: manifest.subagents.map((s) => ({ agent_version_id: s.agent_version_id.replace(/^(agv_)/, ''), max_calls: s.max_calls, timeout_ms: s.timeout_ms, budget_limit: s.budget_limit })),
    });
    if (error) {
        return addGatewayHeaders(mapPublishError(error.message, requestId, current), { requestId });
    }
    return addGatewayHeaders(NextResponse.json(published), { requestId });
}

function mapPublishError(message: string, requestId: string, current: string) {
    if (/version_not_found/.test(message)) {
        return embeddedError(404, 'invalid_request_error', 'Agent version not found', { requestId });
    }
    if (/invalid_status/.test(message)) {
        return embeddedError(409, 'invalid_request_error', `Cannot publish from status ${current}`, { requestId });
    }
    if (/untested_version/.test(message)) {
        return embeddedError(409, 'invalid_request_error', 'Version has no passing isolated test; POST .../test first', { requestId });
    }
    if (/unpublished_(skill|subagent)/.test(message) || /self_cycle/.test(message)) {
        return embeddedError(422, 'invalid_request_error', `Capability pin failed: ${message}`, { requestId });
    }
    return embeddedError(500, 'invalid_request_error', 'Publish failed', { requestId });
}
