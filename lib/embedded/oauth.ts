import crypto from 'crypto';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { encryptApiKey, decryptApiKey } from '@/lib/encryption';
import { safeOutboundFetch } from '@/lib/security/outbound-url';

type Admin = ReturnType<typeof createAdminClient>;

function brokerSecret(): string {
    return process.env.EMBEDDED_OAUTH_STATE_SECRET || process.env.ENCRYPTION_SECRET || 'dev-embedded-oauth-secret';
}

export function signOAuthState(payload: string): string {
    return crypto.createHmac('sha256', brokerSecret()).update(payload).digest('base64url');
}

export function newCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
}

export function codeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export interface AuthorizeInput {
    projectId: string;
    connectionId: string;
    connectorSlug: string;
    redirectUri: string;
    scopes: string[];
    tenantId?: string | null;
    externalUserId?: string | null;
}

export async function createAuthorizationUrl(
    supabase: Admin,
    input: AuthorizeInput,
    connector: { oauth_config: { auth_url?: string; token_url?: string }; default_scopes: string[] },
    clientId: string,
): Promise<{ url: string; state: string }> {
    const authUrl = (connector.oauth_config?.auth_url as string | undefined) ?? 'https://accounts.google.com/o/oauth2/v2/auth';
    const scopes = input.scopes.length > 0 ? input.scopes : (connector.default_scopes as string[]);
    const stateRaw = crypto.randomBytes(24).toString('base64url');
    const state = `${stateRaw}.${signOAuthState(`${input.projectId}:${input.connectionId}:${stateRaw}`)}`;
    const verifier = newCodeVerifier();

    await supabase.from('oauth_states').insert({
        state,
        project_id: input.projectId,
        connection_id: input.connectionId,
        connector_slug: input.connectorSlug,
        code_verifier: verifier,
        redirect_uri: input.redirectUri,
        scopes,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: input.redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        state,
        access_type: 'offline',
        prompt: 'consent',
        code_challenge: codeChallenge(verifier),
        code_challenge_method: 'S256',
    });
    return { url: `${authUrl}?${params.toString()}`, state };
}

export async function exchangeCodeForTokens(opts: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string | null;
}): Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }> {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: opts.code,
        redirect_uri: opts.redirectUri,
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
    });
    if (opts.codeVerifier) {
        body.set('code_verifier', opts.codeVerifier);
    }
    const res = await safeOutboundFetch(opts.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(15000),
    }, { maxRedirects: 0 });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

export async function refreshAccessToken(opts: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
}): Promise<{ access_token: string; expires_in?: number }> {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: opts.refreshToken,
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
    });
    const res = await safeOutboundFetch(opts.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(15000),
    }, { maxRedirects: 0 });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Token refresh failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return (await res.json()) as { access_token: string; expires_in?: number };
}

/** Load a connection's access token, refreshing when expired (60s skew). Never logs the secret. */
export async function getValidAccessToken(
    supabase: Admin,
    connection: { id: string; encrypted_access_ref: string | null; encrypted_refresh_ref: string | null; expires_at: string | null },
    ctx: { organizationId: string; tokenUrl: string; clientId: string; clientSecret: string },
): Promise<string> {
    const skew = 60 * 1000;
    const expired = !connection.expires_at || Date.parse(connection.expires_at) - Date.now() < skew;
    if (!expired && connection.encrypted_access_ref) {
        return decryptApiKey(connection.encrypted_access_ref, ctx.organizationId);
    }
    if (!connection.encrypted_refresh_ref) {
        throw new Error('Connection credential expired and no refresh token is stored');
    }
    const refreshToken = decryptApiKey(connection.encrypted_refresh_ref, ctx.organizationId);
    const refreshed = await refreshAccessToken({ tokenUrl: ctx.tokenUrl, clientId: ctx.clientId, clientSecret: ctx.clientSecret, refreshToken });
    const encrypted = encryptApiKey(refreshed.access_token, ctx.organizationId);
    await supabase.from('tool_connections').update({
        encrypted_access_ref: encrypted,
        expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
        status: 'active',
        last_error: null,
    }).eq('id', connection.id);
    return refreshed.access_token;
}

export function gmailClientConfig(connectorConfig: Record<string, unknown>): { clientId: string; clientSecret: string; tokenUrl: string } {
    const clientId = (connectorConfig.client_id as string) || process.env.CENCORI_GMAIL_CLIENT_ID || '';
    const clientSecret = (connectorConfig.client_secret as string) || process.env.CENCORI_GMAIL_CLIENT_SECRET || '';
    const tokenUrl = (connectorConfig.token_url as string) || 'https://oauth2.googleapis.com/token';
    if (!clientId || !clientSecret) {
        throw new Error('Gmail OAuth client is not configured (CENCORI_GMAIL_CLIENT_ID/SECRET)');
    }
    return { clientId, clientSecret, tokenUrl };
}
