import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, withPrefix, dePrefixId } from '@/lib/embedded/http';
import { PROVIDER_CONNECTION_PREFIX } from '@/lib/embedded/types';
import { sanitizeConnection, validateConnectionInput, keyHintFor } from '@/lib/embedded/provider-connections';
import { invalidateProviderConfig } from '@/lib/config-cache';
import { mirrorConnectionsToKeys } from '@/lib/providers/byok-store';
import { encryptApiKey } from '@/lib/encryption';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    const clean = sanitizeConnection(row);
    return { ...clean, id: withPrefix(PROVIDER_CONNECTION_PREFIX, row.id as string) };
}

async function loadConnection(supabase: ReturnType<typeof createAdminClient>, projectId: string, connectionId: string) {
    const { data } = await supabase.from('provider_connections').select('*').eq('project_id', projectId).eq('id', dePrefixId(connectionId)).maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId } = await ctx.params;
    const row = await loadConnection(createAdminClient(), validation.context.projectId, connectionId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Provider connection not found', { requestId }), { requestId });
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
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Provider connection not found', { requestId }), { requestId });

    let body: { name?: string; api_key?: string; status?: string; base_url?: string };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const patch: Record<string, unknown> = {};
    if (body.name?.trim()) patch.name = body.name.trim();
    if (body.status && ['active', 'disabled'].includes(body.status)) patch.status = body.status;
    if (typeof body.api_key !== 'undefined' && body.api_key) {
        patch.encrypted_key_ref = encryptApiKey(body.api_key, validation.context.organizationId);
        patch.key_hint = keyHintFor(body.api_key);
    }
    if (typeof body.base_url !== 'undefined') {
        const checked = await validateConnectionInput(
            { name: (row.name as string) ?? 'update', provider: row.provider as string, baseUrl: body.base_url ?? undefined },
            { organizationId: validation.context.organizationId },
        );
        if (!checked.ok) {
            return addGatewayHeaders(embeddedError(400, checked.code, checked.message, { requestId }), { requestId });
        }
        patch.base_url = checked.baseUrl;
    }
    if (Object.keys(patch).length === 0) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No updatable fields', { requestId }), { requestId });
    }
    const { data, error } = await supabase.from('provider_connections').update(patch).eq('id', row.id as string).select('*').single();
    if (error || !data) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Update failed', { requestId }), { requestId });
    }
    void invalidateProviderConfig(validation.context.projectId, String(row.provider as string).toLowerCase());
    await mirrorConnectionsToKeys(supabase as never, {
        projectId: validation.context.projectId,
        organizationId: validation.context.organizationId,
        provider: String(row.provider as string),
    });
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
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Provider connection not found', { requestId }), { requestId });
    const { error } = await supabase.from('provider_connections').delete().eq('id', row.id as string);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    void invalidateProviderConfig(validation.context.projectId, String(row.provider as string).toLowerCase());
    await mirrorConnectionsToKeys(supabase as never, {
        projectId: validation.context.projectId,
        organizationId: validation.context.organizationId,
        provider: String(row.provider as string),
    });
    return addGatewayHeaders(NextResponse.json({ deleted: true }), { requestId });
}
