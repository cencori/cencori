import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { assertSafeOutboundUrl } from '@/lib/security/outbound-url';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    return { ...row, id: withPrefix('mcp', row.id as string) };
}

async function loadServer(supabase: ReturnType<typeof createAdminClient>, projectId: string, serverId: string) {
    const { data } = await supabase.from('mcp_servers').select('*').eq('project_id', projectId).eq('id', dePrefixId(serverId)).maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
}

// GET /v1/mcp/servers/:serverId — single server with snapshot.
export async function GET(req: NextRequest, ctx: { params: Promise<{ serverId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { serverId } = await ctx.params;
    const row = await loadServer(createAdminClient(), validation.context.projectId, serverId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'MCP server not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(row)), { requestId });
}

// PATCH /v1/mcp/servers/:serverId — name, URL (re-validated + rediscovered), status, auth connection.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ serverId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { serverId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadServer(supabase, validation.context.projectId, serverId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'MCP server not found', { requestId }), { requestId });

    let body: { name?: string; url?: string; status?: string; auth_connection_id?: string | null };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const patch: Record<string, unknown> = {};
    if (body.name?.trim()) patch.name = body.name.trim();
    if (body.status === 'active' || body.status === 'disabled') patch.status = body.status;
    if (body.auth_connection_id !== undefined) {
        if (body.auth_connection_id === null) {
            patch.auth_connection_id = null;
        } else {
            const { data: conn } = await supabase.from('tool_connections').select('id').eq('project_id', validation.context.projectId).eq('id', dePrefixId(body.auth_connection_id)).maybeSingle();
            if (!conn) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Auth connection not found in this project', { requestId }), { requestId });
            patch.auth_connection_id = (conn as { id: string }).id;
        }
    }
    if (body.url?.trim()) {
        let safeUrl: URL;
        try {
            safeUrl = await assertSafeOutboundUrl(body.url.trim());
        } catch (e) {
            return addGatewayHeaders(embeddedError(400, 'unsafe_provider_url', e instanceof Error ? e.message : 'Unsafe URL', { requestId }), { requestId });
        }
        patch.url = safeUrl.toString();
        patch.status = 'active';
        patch.last_error = null;
    }
    if (Object.keys(patch).length === 0) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No updatable fields', { requestId }), { requestId });
    }
    const { data, error } = await supabase.from('mcp_servers').update(patch).eq('id', row.id as string).select('*').single();
    if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Update failed', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>)), { requestId });
}

// DELETE /v1/mcp/servers/:serverId — disables (snapshots retained for audit).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ serverId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { serverId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadServer(supabase, validation.context.projectId, serverId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'MCP server not found', { requestId }), { requestId });
    const { error } = await supabase.from('mcp_servers').update({ status: 'disabled' }).eq('id', row.id as string);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ id: withPrefix('mcp', row.id as string), status: 'disabled' }), { requestId });
}
