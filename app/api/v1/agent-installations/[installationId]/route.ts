import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    return {
        id: withPrefix('ins', row.id as string),
        tenant_id: withPrefix('ten', row.tenant_id as string),
        agent_id: row.agent_id,
        agent_version_id: row.agent_version_id ?? null,
        status: row.status,
        update_channel: row.update_channel,
        overlay_config: row.overlay_config ?? {},
        approval_policy: row.approval_policy ?? {},
        budget: row.budget ?? {},
        metadata: row.metadata ?? {},
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function loadInstallation(supabase: ReturnType<typeof createAdminClient>, projectId: string, installationId: string) {
    const { data } = await supabase.from('agent_installations').select('*').eq('project_id', projectId).eq('id', dePrefixId(installationId)).maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ installationId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { installationId } = await ctx.params;
    const row = await loadInstallation(createAdminClient(), validation.context.projectId, installationId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Installation not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(row)), { requestId });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ installationId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { installationId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadInstallation(supabase, validation.context.projectId, installationId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Installation not found', { requestId }), { requestId });

    let body: Record<string, unknown> = {};
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const patch: Record<string, unknown> = {};
    if (body.overlay_config && typeof body.overlay_config === 'object') patch.overlay_config = body.overlay_config;
    if (body.approval_policy && typeof body.approval_policy === 'object') patch.approval_policy = body.approval_policy;
    if (body.budget && typeof body.budget === 'object') patch.budget = body.budget;
    if (body.status === 'active' || body.status === 'disabled') patch.status = body.status;
    if (body.update_channel === 'pinned' || body.update_channel === 'stable') patch.update_channel = body.update_channel;
    if (Object.keys(patch).length === 0) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No updatable fields', { requestId }), { requestId });
    }
    const { data, error } = await supabase.from('agent_installations').update(patch).eq('id', row.id as string).select('*').single();
    if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Update failed', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>)), { requestId });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ installationId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { installationId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadInstallation(supabase, validation.context.projectId, installationId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Installation not found', { requestId }), { requestId });
    const { error } = await supabase.from('agent_installations').update({ status: 'disabled' }).eq('id', row.id as string);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ id: withPrefix('ins', row.id as string), status: 'disabled' }), { requestId });
}
