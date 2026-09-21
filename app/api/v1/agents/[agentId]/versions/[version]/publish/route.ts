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
    if (!['draft', 'validating', 'ready_for_review'].includes(current)) {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Cannot publish from status ${current}; create a new version`, { requestId }), { requestId });
    }
    const checked = validateVersionConfig(((target.config_json ?? {}) as Record<string, unknown>) as never);
    if (!checked.ok) return addGatewayHeaders(embeddedError(422, 'invalid_request_error', checked.message, { requestId }), { requestId });

    const { data: updated, error } = await supabase
        .from('agent_versions')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', (target.id as string))
        .select('id, version, status, published_at')
        .single();
    if (error || !updated) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Publish failed', { requestId }), { requestId });
    }
    await supabase.from('agents').update({ stable_version_id: (target.id as string) }).eq('id', agentId);
    return addGatewayHeaders(NextResponse.json(updated), { requestId });
}
