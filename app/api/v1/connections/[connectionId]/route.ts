import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { encryptApiKey } from '@/lib/encryption';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    const { encrypted_access_ref, encrypted_refresh_ref, ...rest } = row;
    void encrypted_access_ref;
    void encrypted_refresh_ref;
    return { ...rest, id: withPrefix('con', row.id as string) };
}

async function loadConnection(supabase: ReturnType<typeof createAdminClient>, projectId: string, connectionId: string) {
    const { data } = await supabase.from('tool_connections').select('*').eq('project_id', projectId).eq('id', dePrefixId(connectionId)).maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId } = await ctx.params;
    const row = await loadConnection(createAdminClient(), validation.context.projectId, connectionId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Connection not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(row)), { requestId });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadConnection(supabase, validation.context.projectId, connectionId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Connection not found', { requestId }), { requestId });

    let body: { api_key?: string; status?: string; scopes?: string[]; metadata?: Record<string, unknown> };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const patch: Record<string, unknown> = {};
    if (typeof body.api_key !== 'undefined' && body.api_key) {
        patch.encrypted_access_ref = encryptApiKey(body.api_key, validation.context.organizationId);
        patch.key_hint = body.api_key.length > 4 ? `...${body.api_key.slice(-4)}` : '****';
        patch.status = 'active';
        patch.last_error = null;
    }
    if (body.status === 'revoked' || body.status === 'disabled') patch.status = 'revoked';
    if (Array.isArray(body.scopes)) patch.scopes = body.scopes;
    if (body.metadata && typeof body.metadata === 'object') patch.metadata = body.metadata;
    if (Object.keys(patch).length === 0) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No updatable fields', { requestId }), { requestId });
    }
    const { data, error } = await supabase.from('tool_connections').update(patch).eq('id', row.id as string).select('*').single();
    if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Update failed', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>)), { requestId });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadConnection(supabase, validation.context.projectId, connectionId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Connection not found', { requestId }), { requestId });
    // Revoke upstream where supported is connector-specific; M2 destroys local encrypted material.
    const { error } = await supabase.from('tool_connections').update({ status: 'revoked', encrypted_access_ref: null, encrypted_refresh_ref: null }).eq('id', row.id as string);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ id: withPrefix('con', row.id as string), status: 'revoked' }), { requestId });
}
