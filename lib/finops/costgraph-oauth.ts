/**
 * "Connect CostGraph" — OAuth 2.0 + PKCE against "Sign in with CostGraph".
 *
 * The flow, once CostGraph supports it end to end:
 *   1. An org owner or admin clicks Connect CostGraph in the console (/start).
 *   2. They sign in to CostGraph and approve `focus:write` (+ openid/profile).
 *   3. The callback exchanges the code, reads which CostGraph tenants they belong to, and — with
 *      one tenant, or after they pick one — creates the FOCUS push connection for the
 *      organization's billing account.
 *   4. The nightly push sends usage with the OAuth access token, refreshing it as needed.
 *
 * Cencori's OAuth client is a Client ID Metadata Document (CostGraph advertises
 * `client_id_metadata_document_supported`): the client_id is the URL of a JSON document we serve,
 * so there is nothing to register with CostGraph.
 *
 * Gated by COSTGRAPH_OAUTH_ENABLED. As of 2026-10-14 CostGraph lacks three pieces, verified live:
 *   - a `focus:write` OAuth scope (scopes_supported: openid, profile, email, usage:read,
 *     billing:read, pricing:read, pricing:write, mcp);
 *   - Bearer tokens on POST /api/v1/tenant/billing/focus (it answers 401 "API key required");
 *   - an endpoint that creates a push connection (dashboard only). Its path is configured with
 *     COSTGRAPH_PUSH_CONNECTION_CREATE_PATH once CostGraph ships it.
 * Docs: https://docs.costgraph.ai/costgraph/developers/sign-in-with-costgraph
 */

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptApiKey, encryptApiKey } from '@/lib/encryption';
import { COSTGRAPH_API_URL, CostGraphError } from './costgraph';

export const COSTGRAPH_APP_URL = (process.env.COSTGRAPH_APP_URL || 'https://app.costgraph.ai').replace(/\/$/, '');
export const COSTGRAPH_AUTHORIZE_URL = `${COSTGRAPH_APP_URL}/oauth/authorize`;
export const COSTGRAPH_TOKEN_URL = `${COSTGRAPH_API_URL}/api/v1/oauth/token`;
export const COSTGRAPH_REVOKE_URL = `${COSTGRAPH_API_URL}/api/v1/oauth/revoke`;

/** Refresh when the access token has less than this left. */
const REFRESH_MARGIN_MS = 2 * 60 * 1000;
/** How long one process may hold the right to refresh. */
const REFRESH_LEASE_MS = 30 * 1000;
/** How long a process waits for another one's refresh to land. */
const LEASE_WAIT_MS = 10 * 1000;
/** Signed state is good for this long: one sign-in round trip. */
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

export const COSTGRAPH_OAUTH_STATE_COOKIE = 'cg_oauth_state';
/** Holds the tokens while a user with several CostGraph tenants picks one. */
export const COSTGRAPH_OAUTH_PENDING_COOKIE = 'cg_oauth_pending';
export const PENDING_MAX_AGE_MS = 10 * 60 * 1000;
const CALLBACK_PATH = '/api/integrations/costgraph/oauth/callback';
const CLIENT_DOCUMENT_PATH = '/api/integrations/costgraph/oauth/client.json';

type FetchLike = typeof fetch;

export function costgraphOAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.COSTGRAPH_OAUTH_ENABLED === 'true';
}

export function costgraphOAuthScopes(env: NodeJS.ProcessEnv = process.env): string[] {
    const raw = env.COSTGRAPH_OAUTH_SCOPES || 'openid profile focus:write';
    return [...new Set(raw.split(/[\s,]+/).filter(Boolean))];
}

export function callbackUrl(consoleOrigin: string): string {
    return `${consoleOrigin}${CALLBACK_PATH}`;
}

/**
 * Our client_id. A metadata document must be served over HTTPS, so local development uses a
 * client registered in CostGraph's dashboard instead (COSTGRAPH_OAUTH_CLIENT_ID).
 */
export function oauthClientId(consoleOrigin: string, env: NodeJS.ProcessEnv = process.env): string {
    return env.COSTGRAPH_OAUTH_CLIENT_ID || `${consoleOrigin}${CLIENT_DOCUMENT_PATH}`;
}

/** The Client ID Metadata Document CostGraph fetches when someone signs in. */
export function clientMetadataDocument(consoleOrigin: string) {
    return {
        client_id: `${consoleOrigin}${CLIENT_DOCUMENT_PATH}`,
        client_name: 'Cencori',
        redirect_uris: [callbackUrl(consoleOrigin)],
        token_endpoint_auth_method: 'none',
        logo_uri: 'https://cencori.com/logos/icon-black.svg',
        client_uri: 'https://cencori.com',
        tos_uri: 'https://cencori.com/terms-of-service',
        policy_uri: 'https://cencori.com/privacy-policy',
    };
}

// ─── PKCE and signed state ───────────────────────────────────────────────────

export function createPkce(): { verifier: string; challenge: string } {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

export interface OAuthStatePayload {
    /** Random value echoed through CostGraph and compared on the callback. */
    state: string;
    nonce: string;
    verifier: string;
    organizationId: string;
    orgSlug: string;
    userId: string;
    /** Console path to return to; always a relative path. */
    returnTo: string;
    issuedAt: number;
}

function stateSecret(env: NodeJS.ProcessEnv = process.env): string {
    const secret = env.COSTGRAPH_OAUTH_STATE_SECRET || env.ENCRYPTION_SECRET;
    if (!secret) throw new Error('COSTGRAPH_OAUTH_STATE_SECRET or ENCRYPTION_SECRET must be set');
    return secret;
}

/** Only same-site relative paths, so the callback can never be used as an open redirect. */
export function safeReturnTo(value: string | null | undefined, fallback: string): string {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
    return value;
}

/** The PKCE verifier lives only in this signed, httpOnly cookie — never in the URL. */
export function sealOAuthState(payload: OAuthStatePayload, env: NodeJS.ProcessEnv = process.env): string {
    return sealSigned(payload, env);
}

export function openOAuthState(
    sealed: string | null | undefined,
    returnedState: string | null,
    now = Date.now(),
    env: NodeJS.ProcessEnv = process.env,
): OAuthStatePayload | null {
    const payload = openSigned<OAuthStatePayload>(sealed, STATE_MAX_AGE_MS, now, env);
    if (!payload || !returnedState || payload.state !== returnedState) return null;
    return payload;
}

/** A signed, expiring, opaque cookie value for any small payload. */
export function sealSigned<T extends { issuedAt: number }>(payload: T, env: NodeJS.ProcessEnv = process.env): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', stateSecret(env)).update(body).digest('base64url');
    return `${body}.${sig}`;
}

export function openSigned<T extends { issuedAt: number }>(
    sealed: string | null | undefined,
    maxAgeMs: number,
    now = Date.now(),
    env: NodeJS.ProcessEnv = process.env,
): T | null {
    if (!sealed) return null;
    const [body, sig] = sealed.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', stateSecret(env)).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
        if (!Number.isFinite(payload.issuedAt) || now - payload.issuedAt > maxAgeMs) return null;
        return payload;
    } catch {
        return null;
    }
}

export function buildAuthorizeUrl(params: {
    clientId: string;
    redirectUri: string;
    scopes: string[];
    state: string;
    nonce: string;
    codeChallenge: string;
}): string {
    const url = new URL(COSTGRAPH_AUTHORIZE_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', params.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('scope', params.scopes.join(' '));
    url.searchParams.set('state', params.state);
    url.searchParams.set('nonce', params.nonce);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
}

// ─── Token endpoint ──────────────────────────────────────────────────────────

export interface TokenSet {
    accessToken: string;
    refreshToken: string;
    /** When the access token expires (ms since epoch). */
    expiresAt: number;
    scope: string | null;
    idToken: string | null;
}

/** CostGraph's token errors (RFC 6749 §5.2), e.g. invalid_grant when a refresh token is dead. */
export class CostGraphOAuthError extends Error {
    constructor(readonly status: number, readonly code: string, detail?: string) {
        super(`CostGraph OAuth ${status} ${code}${detail ? `: ${detail}` : ''}`);
        this.name = 'CostGraphOAuthError';
    }

    /** The user must connect again; retrying cannot help. */
    get requiresReconnect(): boolean {
        return this.code === 'invalid_grant' || this.code === 'invalid_client';
    }
}

async function tokenRequest(body: Record<string, string>, fetchImpl: FetchLike, now: number): Promise<TokenSet> {
    const res = await fetchImpl(COSTGRAPH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams(body).toString(),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON error page */ }
    if (!res.ok) {
        throw new CostGraphOAuthError(res.status, String(json.error ?? `http_${res.status}`), String(json.error_description ?? json.message ?? '') || undefined);
    }
    const accessToken = String(json.access_token ?? '');
    const refreshToken = String(json.refresh_token ?? '');
    if (!accessToken || !refreshToken) throw new CostGraphOAuthError(res.status, 'invalid_response', 'token response is missing a token');
    const expiresIn = Number(json.expires_in);
    return {
        accessToken,
        refreshToken,
        expiresAt: now + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000,
        scope: typeof json.scope === 'string' ? json.scope : null,
        idToken: typeof json.id_token === 'string' ? json.id_token : null,
    };
}

export function exchangeAuthorizationCode(params: {
    code: string;
    verifier: string;
    clientId: string;
    redirectUri: string;
    fetchImpl?: FetchLike;
    now?: number;
}): Promise<TokenSet> {
    return tokenRequest({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: params.clientId,
        code_verifier: params.verifier,
    }, params.fetchImpl ?? fetch, params.now ?? Date.now());
}

/** Refresh tokens rotate: the response carries a new one, and the old one is now dead. */
export function refreshTokens(params: { refreshToken: string; clientId: string; fetchImpl?: FetchLike; now?: number }): Promise<TokenSet> {
    return tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: params.refreshToken,
        client_id: params.clientId,
    }, params.fetchImpl ?? fetch, params.now ?? Date.now());
}

/** Revoking any token of a sign-in ends the whole sign-in. Unknown tokens still answer 200. */
export async function revokeToken(params: { token: string; clientId: string; fetchImpl?: FetchLike }): Promise<void> {
    await (params.fetchImpl ?? fetch)(COSTGRAPH_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: params.token, client_id: params.clientId }).toString(),
    }).catch(() => undefined);
}

/** The `sub` claim of an id_token, for knowing which CostGraph user connected. Not verified. */
export function idTokenSubject(idToken: string | null): string | null {
    if (!idToken) return null;
    try {
        const claims = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { sub?: unknown };
        return typeof claims.sub === 'string' ? claims.sub : null;
    } catch {
        return null;
    }
}

// ─── Stored tokens, refreshed safely ─────────────────────────────────────────

export interface OAuthConnectionRow {
    id: string;
    organization_id: string;
    oauth_access_token_encrypted: string | null;
    oauth_refresh_token_encrypted: string | null;
    oauth_access_expires_at: string | null;
    oauth_refresh_lease_until?: string | null;
}

export function encryptedTokenColumns(tokens: TokenSet, organizationId: string) {
    return {
        oauth_access_token_encrypted: encryptApiKey(tokens.accessToken, organizationId),
        oauth_refresh_token_encrypted: encryptApiKey(tokens.refreshToken, organizationId),
        oauth_access_expires_at: new Date(tokens.expiresAt).toISOString(),
        oauth_scope: tokens.scope,
    };
}

function freshAccessToken(row: OAuthConnectionRow, now: number): string | null {
    if (!row.oauth_access_token_encrypted || !row.oauth_access_expires_at) return null;
    if (Date.parse(row.oauth_access_expires_at) - now <= REFRESH_MARGIN_MS) return null;
    return decryptApiKey(row.oauth_access_token_encrypted, row.organization_id);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A valid access token for a connection, refreshing it when it is about to expire.
 *
 * CostGraph rotates refresh tokens and treats a second use of an old one as theft — it signs the
 * user out. The nightly push and a "Send now" click can run at the same moment, so the refresh is
 * guarded by a lease: one process claims `oauth_refresh_lease_until` with a conditional update,
 * refreshes, and stores the new pair; any other process waits for that to land and uses it.
 */
export async function getValidAccessToken(
    supabase: SupabaseClient,
    connectionId: string,
    options: { clientId: string; fetchImpl?: FetchLike; now?: () => number } = { clientId: '' },
): Promise<string> {
    const now = options.now ?? Date.now;
    const read = async (): Promise<OAuthConnectionRow> => {
        const { data, error } = await supabase
            .from('organization_finops_connections')
            .select('id, organization_id, oauth_access_token_encrypted, oauth_refresh_token_encrypted, oauth_access_expires_at, oauth_refresh_lease_until')
            .eq('id', connectionId)
            .single();
        if (error || !data) throw new Error(`FinOps connection ${connectionId} not found`);
        return data as OAuthConnectionRow;
    };

    const current = await read();
    const fresh = freshAccessToken(current, now());
    if (fresh) return fresh;

    const leaseUntil = new Date(now() + REFRESH_LEASE_MS).toISOString();
    const { data: claimed } = await supabase
        .from('organization_finops_connections')
        .update({ oauth_refresh_lease_until: leaseUntil })
        .eq('id', connectionId)
        .or(`oauth_refresh_lease_until.is.null,oauth_refresh_lease_until.lt.${new Date(now()).toISOString()}`)
        .select('id, organization_id, oauth_access_token_encrypted, oauth_refresh_token_encrypted, oauth_access_expires_at')
        .maybeSingle();

    if (!claimed) {
        // Someone else is refreshing. Wait for their token rather than spend the refresh token twice.
        const deadline = now() + LEASE_WAIT_MS;
        while (now() < deadline) {
            await sleep(500);
            const row = await read();
            const token = freshAccessToken(row, now());
            if (token) return token;
        }
        throw new Error('Timed out waiting for another process to refresh the CostGraph token');
    }

    const row = claimed as OAuthConnectionRow;
    try {
        // The lease may have been won just after another process finished refreshing.
        const already = freshAccessToken(row, now());
        if (already) return already;
        if (!row.oauth_refresh_token_encrypted) throw new CostGraphOAuthError(400, 'invalid_grant', 'no refresh token stored');

        const tokens = await refreshTokens({
            refreshToken: decryptApiKey(row.oauth_refresh_token_encrypted, row.organization_id),
            clientId: options.clientId,
            fetchImpl: options.fetchImpl,
            now: now(),
        });
        const { error } = await supabase
            .from('organization_finops_connections')
            .update({ ...encryptedTokenColumns(tokens, row.organization_id), oauth_refresh_lease_until: null, updated_at: new Date(now()).toISOString() })
            .eq('id', connectionId);
        if (error) throw new Error(`Could not store refreshed CostGraph tokens: ${error.message}`);
        return tokens.accessToken;
    } catch (error) {
        await supabase.from('organization_finops_connections').update({ oauth_refresh_lease_until: null }).eq('id', connectionId);
        throw error;
    }
}

// ─── CostGraph account calls made with the user's token ──────────────────────

export interface CostGraphTenant {
    id: string;
    name: string;
}

/** Tenants the signed-in user belongs to (GET /api/v1/me). */
export async function listTenants(accessToken: string, fetchImpl: FetchLike = fetch): Promise<CostGraphTenant[]> {
    const res = await fetchImpl(`${COSTGRAPH_API_URL}/api/v1/me`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    const json = await res.json().catch(() => ({})) as { data?: { tenants?: Array<{ id?: unknown; name?: unknown }> }; message?: string };
    if (!res.ok) throw new CostGraphError(res.status, { detail: json.message }, 'could not read the CostGraph account');
    return (json.data?.tenants ?? [])
        .filter((t) => typeof t.id === 'string')
        .map((t) => ({ id: t.id as string, name: typeof t.name === 'string' ? t.name : (t.id as string) }));
}

/** CostGraph has not shipped an API for creating push connections yet. */
export class CostGraphCapabilityMissing extends Error {
    constructor(what: string) {
        super(`CostGraph does not offer ${what} yet`);
        this.name = 'CostGraphCapabilityMissing';
    }
}

/**
 * Create the FOCUS push connection for an organization's billing account in the chosen tenant.
 *
 * The endpoint does not exist yet; COSTGRAPH_PUSH_CONNECTION_CREATE_PATH turns this on once
 * CostGraph ships it. The request mirrors the dashboard form (name, provider, billing account).
 */
export async function createPushConnection(params: {
    accessToken: string;
    tenantId: string;
    billingAccountId: string;
    displayName?: string;
    fetchImpl?: FetchLike;
    env?: NodeJS.ProcessEnv;
}): Promise<{ connectionId: string }> {
    const path = (params.env ?? process.env).COSTGRAPH_PUSH_CONNECTION_CREATE_PATH;
    if (!path) throw new CostGraphCapabilityMissing('an API to create FOCUS push connections');
    const res = await (params.fetchImpl ?? fetch)(`${COSTGRAPH_API_URL}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${params.accessToken}`,
            'Content-Type': 'application/json',
            'X-CostGraph-Tenant-ID': params.tenantId,
        },
        body: JSON.stringify({
            tenant_id: params.tenantId,
            display_name: params.displayName ?? 'Cencori',
            provider: 'cencori',
            provider_account_id: params.billingAccountId,
        }),
    });
    const json = await res.json().catch(() => ({})) as { data?: { connection_id?: unknown }; connection_id?: unknown; message?: string };
    if (!res.ok) throw new CostGraphError(res.status, { detail: json.message }, 'could not create the push connection');
    const connectionId = json.data?.connection_id ?? json.connection_id;
    if (typeof connectionId !== 'string' || !connectionId.startsWith('fpc_')) {
        throw new CostGraphError(res.status, { detail: 'response did not include an fpc_ connection id' }, 'unexpected response');
    }
    return { connectionId };
}
