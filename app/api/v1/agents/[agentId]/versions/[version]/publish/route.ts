import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { validateVersionConfig } from '@/lib/embedded/agents';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST .../publish — draft|validating|ready_for_review → published (+ stable pointer).
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
    // The authoring lifecycle requires validation (and optionally an isolated
    // test) before publication: draft → validate → test → ready_for_review → publish.
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

    const { data: updated, error } = await supabase
        .from('agent_versions')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', (target.id as string))
        .select('id, version, status, published_at')
        .single();
    if (error || !updated) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Publish failed', { requestId }), { requestId });
    }
    // Pin validated skill references and subagent edges as durable rows.
    try {
        const { syncAgentVersionSkills, syncAgentVersionSubagents } = await import('@/lib/embedded/agents');
        await syncAgentVersionSkills(supabase as never, (target.id as string), manifest.skills.map((s) => s.skill_version_id));
        await syncAgentVersionSubagents(supabase as never, (target.id as string), manifest.subagents);
    } catch (e) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', e instanceof Error ? e.message : 'Capability pinning failed', { requestId }), { requestId });
    }
    await supabase.from('agents').update({ stable_version_id: (target.id as string) }).eq('id', agentId);
    return addGatewayHeaders(NextResponse.json(updated), { requestId });
}
