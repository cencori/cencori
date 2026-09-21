import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import { createAuthorizationUrl } from '@/lib/embedded/oauth';
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
    const { data: connector } = await supabase.from('connectors').select('oauth_config, default_scopes, auth_type').eq('slug', slug).maybeSingle();
    if (!connector || (connector.auth_type as string) !== 'oauth2') {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', `Connector ${slug} does not use OAuth`, { requestId }), { requestId });
    }

    let body: { redirect_uri?: string; scopes?: string[]; client_id?: string } = {};
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }
    const redirectUri = body.redirect_uri || `${process.env.NEXT_PUBLIC_APP_URL || 'https://cencori.com'}/api/v1/connections/oauth/callback`;
    const clientId = body.client_id || process.env.CENCORI_GMAIL_CLIENT_ID || '';
    if (!clientId) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', 'OAuth client is not configured', { requestId }), { requestId });

    try {
        const { url, state } = await createAuthorizationUrl(supabase as never, {
            projectId: validation.context.projectId,
            connectionId: (conn.id as string),
            connectorSlug: slug,
            redirectUri,
            scopes: body.scopes ?? ((connector.default_scopes ?? []) as string[]),
        }, { oauth_config: (connector.oauth_config ?? {}) as { auth_url?: string }, default_scopes: ((connector.default_scopes ?? []) as string[]) }, clientId);
        return addGatewayHeaders(NextResponse.json({ authorize_url: url, state, expires_in: 900 }), { requestId });
    } catch (e) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', e instanceof Error ? e.message : 'Failed to create authorization URL', { requestId }), { requestId });
    }
}
