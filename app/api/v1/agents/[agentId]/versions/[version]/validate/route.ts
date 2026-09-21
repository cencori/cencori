import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { validateVersionConfig } from '@/lib/embedded/agents';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

async function loadRow(supabase: ReturnType<typeof createAdminClient>, projectId: string, agentId: string, version: string) {
    const { data: agent } = await supabase.from('agents').select('id, project_id').eq('id', agentId).maybeSingle();
    if (!agent || (agent.project_id as string) !== projectId) return null;
    const { data } = await supabase.from('agent_versions').select('*').eq('agent_id', agentId).eq('version', version).maybeSingle();
    return (data ?? (await supabase.from('agent_versions').select('*').eq('id', version).eq('agent_id', agentId).maybeSingle()).data ?? null) as Record<string, unknown> | null;
}

// POST .../validate — draft → validating (schema + requirements check, no mutation of published rows).
export async function POST(req: NextRequest, ctx: { params: Promise<{ agentId: string; version: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { agentId, version } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadRow(supabase, validation.context.projectId, agentId, version);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent version not found', { requestId }), { requestId });
    if (['published', 'deprecated', 'retired'].includes((row.status as string) ?? '')) {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', 'Published versions are immutable; create a new version', { requestId }), { requestId });
    }
    const checked = validateVersionConfig(((row.config_json ?? {}) as Record<string, unknown>) as never);
    if (!checked.ok) return addGatewayHeaders(embeddedError(422, 'invalid_request_error', checked.message, { requestId }), { requestId });
    const { data, error } = await supabase.from('agent_versions').update({ status: 'validating' }).eq('id', row.id as string).select('id, version, status').single();
    if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Validation failed', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(data), { requestId });
}
