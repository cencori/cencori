import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { refreshAccessToken } from '@/lib/embedded/oauth';
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
    const cfg = ((connector?.oauth_config ?? {}) as { token_url?: string; client_id?: string; client_secret?: string });
    try {
        const refreshed = await refreshAccessToken({
            tokenUrl: cfg.token_url || 'https://oauth2.googleapis.com/token',
            clientId: cfg.client_id || process.env.CENCORI_GMAIL_CLIENT_ID || '',
            clientSecret: cfg.client_secret || process.env.CENCORI_GMAIL_CLIENT_SECRET || '',
            refreshToken: decryptApiKey(c.encrypted_refresh_ref, validation.context.organizationId),
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
