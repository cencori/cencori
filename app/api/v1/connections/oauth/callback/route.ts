import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { handleCorsPreFlight } from '@/lib/gateway-middleware';
import { exchangeCodeForTokens, signOAuthState } from '@/lib/embedded/oauth';
import { encryptApiKey } from '@/lib/encryption';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /api/v1/connections/oauth/callback?code=&state= — browser redirect (state-verified, no auth header).
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    if (error) {
        return NextResponse.json({ error: { message: `OAuth failed: ${error}`, code: 'oauth_failed' } }, { status: 400 });
    }
    if (!code || !state) {
        return NextResponse.json({ error: { message: 'code and state are required', code: 'invalid_request_error' } }, { status: 400 });
    }
    const supabase = createAdminClient();
    const { data: row } = await supabase.from('oauth_states').select('*').eq('state', state).maybeSingle();
    if (!row) {
        return NextResponse.json({ error: { message: 'Unknown or expired OAuth state', code: 'invalid_request_error' } }, { status: 400 });
    }
    const oauth = row as { project_id: string; connection_id: string; connector_slug: string; code_verifier: string | null; redirect_uri: string; scopes: string[]; expires_at: string };
    if (Date.parse(oauth.expires_at) <= Date.now()) {
        await supabase.from('oauth_states').delete().eq('state', state);
        return NextResponse.json({ error: { message: 'OAuth state expired', code: 'invalid_request_error' } }, { status: 410 });
    }
    const [raw, sig] = state.split('.');
    if (!raw || signOAuthState(`${oauth.project_id}:${oauth.connection_id}:${raw}`) !== sig) {
        return NextResponse.json({ error: { message: 'Invalid OAuth state signature', code: 'invalid_request_error' } }, { status: 400 });
    }

    const { data: project } = await supabase.from('projects').select('organization_id').eq('id', oauth.project_id).maybeSingle();
    const organizationId = (project?.organization_id as string) ?? '';
    const { data: connector } = await supabase.from('connectors').select('oauth_config').eq('slug', oauth.connector_slug).maybeSingle();
    const oauthConfig = ((connector?.oauth_config ?? {}) as { token_url?: string; client_id?: string; client_secret?: string });
    const tokenUrl = oauthConfig.token_url || 'https://oauth2.googleapis.com/token';
    const clientId = oauthConfig.client_id || process.env.CENCORI_GMAIL_CLIENT_ID || '';
    const clientSecret = oauthConfig.client_secret || process.env.CENCORI_GMAIL_CLIENT_SECRET || '';
    if (!clientId || !clientSecret || !organizationId) {
        return NextResponse.json({ error: { message: 'OAuth client is not configured', code: 'invalid_request_error' } }, { status: 500 });
    }

    try {
        const tokens = await exchangeCodeForTokens({ tokenUrl, clientId, clientSecret, code, redirectUri: oauth.redirect_uri, codeVerifier: oauth.code_verifier });
        await supabase.from('tool_connections').update({
            encrypted_access_ref: encryptApiKey(tokens.access_token, organizationId),
            encrypted_refresh_ref: tokens.refresh_token ? encryptApiKey(tokens.refresh_token, organizationId) : undefined,
            key_hint: 'oauth',
            scopes: tokens.scope ? tokens.scope.split(' ') : oauth.scopes,
            status: 'active',
            expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
            last_error: null,
        }).eq('id', oauth.connection_id);
        await supabase.from('oauth_states').delete().eq('state', state);
        try {
            const { triggerWebhooks } = await import('@/lib/webhooks/trigger');
            await triggerWebhooks(oauth.project_id, 'connection.active' as never, { connection_id: oauth.connection_id, connector: oauth.connector_slug });
        } catch {
            // ignore
        }
        return NextResponse.json({ connected: true, connection_id: oauth.connection_id });
    } catch (e) {
        await supabase.from('tool_connections').update({ status: 'error', last_error: e instanceof Error ? e.message.slice(0, 500) : 'Exchange failed' }).eq('id', oauth.connection_id);
        return NextResponse.json({ error: { message: e instanceof Error ? e.message : 'Token exchange failed', code: 'oauth_failed' } }, { status: 502 });
    }
}
