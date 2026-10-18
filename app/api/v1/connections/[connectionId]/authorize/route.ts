import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import { createAuthorizationUrl, oauthClientConfig, resolveOauthEndpoints } from '@/lib/embedded/oauth';
import { encryptApiKey } from '@/lib/encryption';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/connections/:id/authorize — returns OAuth consent URL + state (secret-key only).
export async function POST(req: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: conn } = await supabase.from('tool_connections').select('*').eq('project_id', validation.context.projectId).eq('id', dePrefixId(connectionId)).maybeSingle();
    if (!conn) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Connection not found', { requestId }), { requestId });
    const slug = (conn.connector_slug as string) ?? 'gmail';
    const { data: connector } = await supabase.from('connectors').select('oauth_config, default_scopes, auth_type, managed_auth').eq('slug', slug).maybeSingle();
    if (!connector || (connector.auth_type as string) !== 'oauth2') {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', `Connector ${slug} does not use OAuth`, { requestId }), { requestId });
    }

    let body: { redirect_uri?: string; scopes?: string[]; client_id?: string; client_secret?: string; discovery_url?: string } = {};
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }
    const redirectUri = body.redirect_uri || `${process.env.NEXT_PUBLIC_APP_URL || 'https://cencori.com'}/api/v1/connections/oauth/callback`;
    const connectorConfig = (connector.oauth_config ?? {}) as Record<string, unknown>;
    try {
        const endpoints = await resolveOauthEndpoints({ slug, connectorConfig, discoveryUrl: body.discovery_url ?? null });
        const creds = oauthClientConfig(slug, connectorConfig, { client_id: body.client_id, client_secret: body.client_secret });
        if (!creds.clientId) {
            const connectorManaged = (connector?.managed_auth as boolean | null) === true;
            return addGatewayHeaders(embeddedError(
                500,
                'invalid_request_error',
                connectorManaged
                    ? `Platform-managed credentials for ${slug} are not configured yet — retry later or pass client_id/client_secret`
                    : 'OAuth client is not configured — pass client_id/client_secret for a BYO connector (env fallback: CENCORI_OAUTH_' + slug.toUpperCase().replace(/-/g, '_') + '_*)',
                { requestId },
            ), { requestId });
        }

        // BYO / discovered provider context rides with the state (secret as an
        // org-scoped encrypted ref) and persists to the connection so the
        // refresh endpoint can renew without re-submitting credentials.
        const metadata: Record<string, unknown> = {
            auth_url: endpoints.auth_url,
            token_url: endpoints.token_url,
            token_auth: endpoints.token_auth,
            client_id: creds.clientId,
        };
        if (creds.clientSecret) metadata.client_secret_ref = encryptApiKey(creds.clientSecret, validation.context.organizationId);
        if (body.client_id || body.client_secret) {
            await supabase.from('tool_connections').update({
                metadata: { ...((conn.metadata ?? {}) as Record<string, unknown>), oauth: metadata },
            }).eq('id', conn.id);
        }

        const { url, state } = await createAuthorizationUrl(supabase as never, {
            projectId: validation.context.projectId,
            connectionId: (conn.id as string),
            connectorSlug: slug,
            redirectUri,
            scopes: body.scopes ?? ((connector.default_scopes ?? []) as string[]),
            metadata,
        }, { oauth_config: { auth_url: endpoints.auth_url, token_url: endpoints.token_url }, default_scopes: ((connector.default_scopes ?? []) as string[]) }, creds.clientId);
        return addGatewayHeaders(NextResponse.json({ authorize_url: url, state, expires_in: 900 }), { requestId });
    } catch (e) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', e instanceof Error ? e.message : 'Failed to create authorization URL', { requestId }), { requestId });
    }
}
