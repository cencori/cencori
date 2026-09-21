import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST .../retire — published|deprecated → retired; clears stable pointer when it targets this row.
export async function POST(req: NextRequest, ctx: { params: Promise<{ agentId: string; version: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { agentId, version } = await ctx.params;
    const supabase = createAdminClient();
    const { data: agent } = await supabase.from('agents').select('id, project_id, stable_version_id').eq('id', agentId).maybeSingle();
    if (!agent || (agent.project_id as string) !== validation.context.projectId) {
        return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent not found', { requestId }), { requestId });
    }
    const { data } = await supabase.from('agent_versions').select('*').eq('agent_id', agentId).eq('version', version).maybeSingle();
    const target = (data ?? (await supabase.from('agent_versions').select('*').eq('id', version).eq('agent_id', agentId).maybeSingle()).data ?? null) as Record<string, unknown> | null;
    if (!target) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent version not found', { requestId }), { requestId });
    const current = (target.status as string) ?? 'draft';
    if (!['published', 'deprecated'].includes(current)) {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Only published/deprecated versions can retire (current: ${current})`, { requestId }), { requestId });
    }
    const { data: updated, error } = await supabase.from('agent_versions').update({ status: 'retired' }).eq('id', target.id as string).select('id, version, status').single();
    if (error || !updated) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Retire failed', { requestId }), { requestId });
    if ((agent.stable_version_id as string | null) === (target.id as string)) {
        await supabase.from('agents').update({ stable_version_id: null }).eq('id', agentId);
    }
    return addGatewayHeaders(NextResponse.json(updated), { requestId });
}
