import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

async function loadVersion(supabase: ReturnType<typeof createAdminClient>, projectId: string, agentId: string, version: string) {
    // Accept version string or version row id.
    const { data } = await supabase.from('agents').select('id, project_id').eq('id', agentId).maybeSingle();
    if (!data || (data.project_id as string) !== projectId) return null;
    const byId = await supabase.from('agent_versions').select('*').eq('id', version).eq('agent_id', agentId).maybeSingle();
    if (byId.data) return byId.data as Record<string, unknown>;
    const byStr = await supabase.from('agent_versions').select('*').eq('agent_id', agentId).eq('version', version).maybeSingle();
    return (byStr.data ?? null) as Record<string, unknown> | null;
}

function serialize(row: Record<string, unknown>) {
    return {
        id: row.id, agent_id: row.agent_id, version: row.version, status: row.status,
        visibility: row.visibility ?? 'private',
        config: row.config_json ?? {}, requirements: row.requirements_json ?? {},
        checksum: row.checksum ?? null, reviewed_by: row.reviewed_by ?? null,
        published_at: row.published_at ?? null,
        created_at: row.created_at, updated_at: row.updated_at,
    };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ agentId: string; version: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { agentId, version } = await ctx.params;
    const row = await loadVersion(createAdminClient(), validation.context.projectId, agentId, version);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent version not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(row)), { requestId });
}
