import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { refreshAccessToken, oauthClientConfig } from '@/lib/embedded/oauth';
import { encryptApiKey, decryptApiKey } from '@/lib/encryption';
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

// POST /v1/connections/:id/refresh — rotate access token from stored refresh token.
export async function POST(req: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: conn } = await supabase.from('tool_connections').select('*').eq('project_id', validation.context.projectId).eq('id', dePrefixId(connectionId)).maybeSingle();
    if (!conn) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Connection not found', { requestId }), { requestId });
    const c = conn as { id: string; connector_slug: string; encrypted_refresh_ref: string | null };

    if (!c.encrypted_refresh_ref) {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', 'No refresh token stored for this connection', { requestId }), { requestId });
    }
    const { data: connector } = await supabase.from('connectors').select('oauth_config').eq('slug', c.connector_slug).maybeSingle();
    const connMeta = ((conn.metadata ?? {}) as { oauth?: { token_url?: string; token_auth?: 'form' | 'basic'; client_id?: string; client_secret_ref?: string } }).oauth ?? null;
    const clientSecretOverride = connMeta?.client_secret_ref ? decryptApiKey(connMeta.client_secret_ref, validation.context.organizationId) : undefined;
    const cfg = oauthClientConfig(c.connector_slug, ((connector?.oauth_config ?? {}) as Record<string, unknown>), {
        client_id: connMeta?.client_id,
        client_secret: clientSecretOverride,
        token_url: connMeta?.token_url,
    });
    const tokenAuth = connMeta?.token_auth ?? cfg.tokenAuth;
    try {
        const refreshed = await refreshAccessToken({
            tokenUrl: cfg.tokenUrl,
            clientId: cfg.clientId,
            clientSecret: cfg.clientSecret,
            refreshToken: decryptApiKey(c.encrypted_refresh_ref, validation.context.organizationId),
            tokenAuth,
        });
        const { data: updated } = await supabase.from('tool_connections').update({
            encrypted_access_ref: encryptApiKey(refreshed.access_token, validation.context.organizationId),
            expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
            status: 'active',
            last_tested_at: new Date().toISOString(),
            last_error: null,
        }).eq('id', c.id).select('*').single();
        return addGatewayHeaders(NextResponse.json({ ...serialize(updated as Record<string, unknown>), refreshed: true }), { requestId });
    } catch (e) {
        await supabase.from('tool_connections').update({ status: 'expired', last_error: e instanceof Error ? e.message.slice(0, 500) : 'Refresh failed' }).eq('id', c.id);
        return addGatewayHeaders(embeddedError(502, 'invalid_request_error', e instanceof Error ? e.message : 'Refresh failed', { requestId }), { requestId });
    }
}
