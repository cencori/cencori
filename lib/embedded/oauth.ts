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
    /** Persisted onto oauth_states.metadata (resolved endpoints, BYO client refs). */
    metadata?: Record<string, unknown>;
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
        metadata: input.metadata ?? {},
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: input.redirectUri,
        response_type: 'code',
        state,
        access_type: 'offline',
        prompt: 'consent',
        code_challenge: codeChallenge(verifier),
        code_challenge_method: 'S256',
    });
    // Providers configure scopes app-side (Notion, Linear, HubSpot): an empty
    // scope list must be omitted, not sent as an empty string.
    if (scopes.length > 0) params.set('scope', scopes.join(' '));
    return { url: `${authUrl}?${params.toString()}`, state };
}

export type TokenEndpointAuth = 'form' | 'basic';

/** Helpers for token requests: form-encoded (most providers) vs HTTP Basic auth (Notion). */
function tokenRequestParams(
    grant: Record<string, string>,
    opts: { clientId: string; clientSecret: string; tokenAuth?: TokenEndpointAuth },
): { body: URLSearchParams; headers: Record<string, string> } {
    const body = new URLSearchParams(grant);
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (opts.tokenAuth === 'basic') {
        headers['Authorization'] = `Basic ${Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString('base64')}`;
    } else {
        body.set('client_id', opts.clientId);
        body.set('client_secret', opts.clientSecret);
    }
    return { body, headers };
}

export async function exchangeCodeForTokens(opts: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string | null;
    tokenAuth?: TokenEndpointAuth;
}): Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }> {
    const grant: Record<string, string> = {
        grant_type: 'authorization_code',
        code: opts.code,
        redirect_uri: opts.redirectUri,
    };
    if (opts.codeVerifier) {
        grant.code_verifier = opts.codeVerifier;
    }
    const { body, headers } = tokenRequestParams(grant, opts);
    const res = await safeOutboundFetch(opts.tokenUrl, {
        method: 'POST',
        headers,
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
    tokenAuth?: TokenEndpointAuth;
}): Promise<{ access_token: string; expires_in?: number }> {
    const { body, headers } = tokenRequestParams({ grant_type: 'refresh_token', refresh_token: opts.refreshToken }, opts);
    const res = await safeOutboundFetch(opts.tokenUrl, {
        method: 'POST',
        headers,
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
    ctx: { organizationId: string; tokenUrl: string; clientId: string; clientSecret: string; tokenAuth?: TokenEndpointAuth },
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
    const refreshed = await refreshAccessToken({ tokenUrl: ctx.tokenUrl, clientId: ctx.clientId, clientSecret: ctx.clientSecret, refreshToken, tokenAuth: ctx.tokenAuth });
    const encrypted = encryptApiKey(refreshed.access_token, ctx.organizationId);
    await supabase.from('tool_connections').update({
        encrypted_access_ref: encrypted,
        expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
        status: 'active',
        last_error: null,
    }).eq('id', connection.id);
    return refreshed.access_token;
}

/**
 * Resolve OAuth client credentials for ANY connector slug, in order:
 * per-request overrides (BYO apps) → connector oauth_config → per-slug env
 * (`CENCORI_OAUTH_<SLUG>_CLIENT_ID/SECRET`, dashes → underscores) → legacy
 * Gmail env fallback (kept for pre-catalog Gmail setups). Also carries the
 * token endpoint auth style (`token_auth: 'basic'` for Notion-style Basic).
 */
export function oauthClientConfig(
    slug: string,
    connectorConfig: Record<string, unknown>,
    overrides?: { client_id?: string; client_secret?: string; token_url?: string },
): { clientId: string; clientSecret: string; tokenUrl: string; tokenAuth: TokenEndpointAuth } {
    const envSlug = slug.toUpperCase().replace(/-/g, '_');
    const clientId = overrides?.client_id
        || (connectorConfig.client_id as string)
        || process.env[`CENCORI_OAUTH_${envSlug}_CLIENT_ID`]
        || process.env.CENCORI_GMAIL_CLIENT_ID
        || '';
    const clientSecret = overrides?.client_secret
        || (connectorConfig.client_secret as string)
        || process.env[`CENCORI_OAUTH_${envSlug}_CLIENT_SECRET`]
        || process.env.CENCORI_GMAIL_CLIENT_SECRET
        || '';
    const tokenUrl = overrides?.token_url
        || (connectorConfig.token_url as string)
        || 'https://oauth2.googleapis.com/token';
    const tokenAuth: TokenEndpointAuth = connectorConfig.token_auth === 'basic' ? 'basic' : 'form';
    return { clientId, clientSecret, tokenUrl, tokenAuth };
}

export interface OauthEndpoints {
    auth_url: string;
    token_url: string;
    token_auth: TokenEndpointAuth;
}

/**
 * Provider endpoints for the authorize flow: connector config first, then a
 * generic-oidc discovery document (OpenID Connect Discovery 1.0). Discovery
 * goes through safeOutboundFetch (https + egress safety) with a short timeout.
 */
export async function resolveOauthEndpoints(opts: {
    slug: string;
    connectorConfig: { auth_url?: string; token_url?: string; token_auth?: string };
    discoveryUrl?: string | null;
}): Promise<OauthEndpoints> {
    const tokenAuth: TokenEndpointAuth = opts.connectorConfig.token_auth === 'basic' ? 'basic' : 'form';
    if (opts.connectorConfig.auth_url && opts.connectorConfig.token_url) {
        return { auth_url: opts.connectorConfig.auth_url, token_url: opts.connectorConfig.token_url, token_auth: tokenAuth };
    }
    if (!opts.discoveryUrl) {
        throw new Error(`Connector ${opts.slug} has no OAuth endpoints configured; pass discovery_url`);
    }
    const res = await safeOutboundFetch(opts.discoveryUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
    }, { maxRedirects: 0 });
    if (!res.ok) {
        throw new Error(`Discovery document unavailable (${res.status})`);
    }
    const doc = (await res.json()) as { authorization_endpoint?: unknown; token_endpoint?: unknown; token_endpoint_auth_methods_supported?: unknown };
    if (typeof doc.authorization_endpoint !== 'string' || typeof doc.token_endpoint !== 'string' || !doc.authorization_endpoint.startsWith('https://') || !doc.token_endpoint.startsWith('https://')) {
        throw new Error('Discovery document is missing https authorization_endpoint/token_endpoint');
    }
    const methods = Array.isArray(doc.token_endpoint_auth_methods_supported) ? doc.token_endpoint_auth_methods_supported as unknown[] : [];
    return {
        auth_url: doc.authorization_endpoint,
        token_url: doc.token_endpoint,
        token_auth: methods.includes('client_secret_basic') ? 'basic' : 'form',
    };
}

export function gmailClientConfig(connectorConfig: Record<string, unknown>): { clientId: string; clientSecret: string; tokenUrl: string } {    const { clientId, clientSecret, tokenUrl } = oauthClientConfig('gmail', connectorConfig);
    if (!clientId || !clientSecret) {
        throw new Error('Gmail OAuth client is not configured (CENCORI_OAUTH_GMAIL_CLIENT_ID/SECRET)');
    }
    return { clientId, clientSecret, tokenUrl };
}
