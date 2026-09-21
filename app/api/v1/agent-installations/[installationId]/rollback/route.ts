import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST .../rollback — repoint to previous version from metadata.history.
export async function POST(req: NextRequest, ctx: { params: Promise<{ installationId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { installationId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: row } = await supabase.from('agent_installations').select('*').eq('project_id', validation.context.projectId).eq('id', dePrefixId(installationId)).maybeSingle();
    if (!row) return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Installation not found', { requestId }), { requestId });
    const ins = row as { id: string; agent_id: string; agent_version_id: string | null; metadata: { history?: string[] } };
    const history = ins.metadata?.history ?? [];
    const previous = [...history].reverse().find((h) => h !== 'none' && h !== ins.agent_version_id);
    if (!previous) return addGatewayHeaders(embeddedError(409, 'invalid_request_error', 'No previous version to roll back to', { requestId }), { requestId });

    const { data: vrow } = await supabase.from('agent_versions').select('id, status').eq('id', previous).eq('agent_id', ins.agent_id).maybeSingle();
    if (!vrow) return addGatewayHeaders(embeddedError(409, 'invalid_request_error', 'Previous version no longer exists', { requestId }), { requestId });

    const { data: updated, error } = await supabase
        .from('agent_installations')
        .update({ agent_version_id: previous, status: 'active', metadata: { ...(ins.metadata ?? {}), history: [...history, ins.agent_version_id ?? 'none'].slice(-10) } })
        .eq('id', ins.id)
        .select('id, agent_version_id, status')
        .single();
    if (error || !updated) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Rollback failed', { requestId }), { requestId });
    const u = updated as Record<string, unknown>;
    return addGatewayHeaders(NextResponse.json({ id: withPrefix('ins', ins.id), agent_version_id: u.agent_version_id, status: u.status }), { requestId });
}
