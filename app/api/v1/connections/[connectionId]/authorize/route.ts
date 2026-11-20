import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import { createAuthorizationUrl, isAllowedReturnUrl, oauthClientConfig, resolveOauthEndpoints, scopesBeyondPlatformGoogleApp } from '@/lib/embedded/oauth';
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

    let body: { redirect_uri?: string; return_url?: string; scopes?: string[]; client_id?: string; client_secret?: string; discovery_url?: string } = {};
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }
    if (body.return_url !== undefined && !isAllowedReturnUrl(body.return_url)) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'return_url must be an https URL (http is allowed on localhost)', { requestId }), { requestId });
    }
    if (body.return_url && body.redirect_uri) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Pass return_url (Cencori receives the code, then sends the browser to you) or redirect_uri (you receive the code and call /exchange), not both', { requestId }), { requestId });
    }
    if (body.scopes !== undefined && (!Array.isArray(body.scopes) || body.scopes.some((s) => typeof s !== 'string' || !s))) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'scopes must be an array of scope strings', { requestId }), { requestId });
    }
    const redirectUri = body.redirect_uri || `${process.env.NEXT_PUBLIC_APP_URL || 'https://cencori.com'}/api/v1/connections/oauth/callback`;
    const connectorConfig = (connector.oauth_config ?? {}) as Record<string, unknown>;
    try {
        const endpoints = await resolveOauthEndpoints({ slug, connectorConfig, discoveryUrl: body.discovery_url ?? null });
        const creds = oauthClientConfig(slug, connectorConfig, { client_id: body.client_id, client_secret: body.client_secret });
        if (!creds.clientId) {
            const connectorManaged = (connector?.managed_auth as boolean | null) === true;
            // A setup gap the caller can act on, not a server fault.
            return addGatewayHeaders(embeddedError(
                400,
                'oauth_client_not_configured',
                connectorManaged
                    ? `Cencori's own OAuth app for ${slug} is not available yet — pass the client_id and client_secret of your OAuth app`
                    : 'OAuth client is not configured — pass client_id/client_secret for a BYO connector (env fallback: CENCORI_OAUTH_' + slug.toUpperCase().replace(/-/g, '_') + '_*)',
                { requestId },
            ), { requestId });
        }

        if (!body.client_id) {
            const refused = scopesBeyondPlatformGoogleApp(endpoints.auth_url, body.scopes ?? [], (connector.default_scopes ?? []) as string[]);
            if (refused.length > 0) {
                return addGatewayHeaders(embeddedError(
                    400,
                    'scope_not_available',
                    `Cencori's own Google app cannot ask for ${refused.join(', ')}. Leave scopes out to use this connector's defaults, or pass the client_id and client_secret of your own Google OAuth app to ask for more.`,
                    { requestId },
                ), { requestId });
            }
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
            // return_url belongs to this attempt only, not to the connection.
            metadata: body.return_url ? { ...metadata, return_url: body.return_url } : metadata,
        }, { oauth_config: { auth_url: endpoints.auth_url, token_url: endpoints.token_url }, default_scopes: ((connector.default_scopes ?? []) as string[]) }, creds.clientId);
        // `redirect_uri` is the exact value to register on the OAuth app.
        const scopes = (body.scopes?.length ? body.scopes : ((connector.default_scopes ?? []) as string[]));
        return addGatewayHeaders(NextResponse.json({ authorize_url: url, state, redirect_uri: redirectUri, scopes, expires_in: 900 }), { requestId });
    } catch (e) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', e instanceof Error ? e.message : 'Failed to create authorization URL', { requestId }), { requestId });
    }
}
