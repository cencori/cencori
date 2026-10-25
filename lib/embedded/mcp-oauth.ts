/**
 * Sign-in for MCP servers that use OAuth instead of keys (Linear, Notion,
 * Atlassian, Sentry…), per the MCP authorization spec:
 *
 * 1. The server answers 401; its WWW-Authenticate header (or well-known
 *    path) points at its protected-resource metadata, which names the
 *    authorization server (RFC 9728).
 * 2. The authorization server's metadata (RFC 8414 / OIDC) gives the
 *    authorize, token and registration endpoints.
 * 3. Cencori registers itself as a client (RFC 7591), so there's no app to
 *    set up, then sends the owner to sign in with PKCE (S256) and the
 *    `resource` indicator (RFC 8707).
 * 4. The callback exchanges the code; tokens live encrypted in a project
 *    `tool_connections` row, refreshed (with rotation) when they expire.
 *
 * The in-flight state (PKCE verifier, client, where to save) travels
 * encrypted in the `state` parameter, so nothing is stored before sign-in
 * finishes.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { decryptApiKey, encryptApiKey } from '@/lib/encryption';
import { safeOutboundFetch } from '@/lib/security/outbound-url';
import { tokenSecret } from './client-tokens';

type Admin = ReturnType<typeof createAdminClient>;

const STATE_TTL_MS = 10 * 60_000;
const FETCH_TIMEOUT_MS = 15_000;
/** Refresh this long before the token says it expires. */
const EXPIRY_SKEW_MS = 60_000;
export const MCP_OAUTH_CONNECTOR_SLUG = 'mcp-oauth';

export interface McpAuthServer {
    issuer: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    registrationEndpoint: string | null;
    scopes: string[];
}

export interface McpAuthDiscovery {
    /** The resource the token is for (RFC 8707): the server URL unless its metadata says otherwise. */
    resource: string;
    server: McpAuthServer;
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
    try {
        const response = await safeOutboundFetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!response.ok) {
            await response.body?.cancel().catch(() => undefined);
            return null;
        }
        const body = await response.json().catch(() => null) as unknown;
        return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

/** `resource_metadata="…"` from a Bearer WWW-Authenticate challenge. */
export function resourceMetadataUrl(header: string | null): string | null {
    const match = header ? /resource_metadata="([^"]+)"/i.exec(header) : null;
    return match?.[1] ?? null;
}

/** RFC 8414 / OIDC discovery URLs for an issuer, path-aware, most specific first. */
export function authServerMetadataUrls(issuer: string): string[] {
    const url = new URL(issuer);
    const path = url.pathname.replace(/\/$/, '');
    return path
        ? [
            `${url.origin}/.well-known/oauth-authorization-server${path}`,
            `${url.origin}/.well-known/openid-configuration${path}`,
            `${url.origin}${path}/.well-known/openid-configuration`,
        ]
        : [`${url.origin}/.well-known/oauth-authorization-server`, `${url.origin}/.well-known/openid-configuration`];
}

const DISCOVERY_TTL_MS = 10 * 60_000;
const discoveryCache = new Map<string, { value: McpAuthDiscovery; expiresAt: number }>();

/**
 * Find where a server's sign-in lives. Null when it doesn't use OAuth (or
 * hides it), in which case the owner pastes a key instead. Found sign-ins
 * are reused for a few minutes, so a retry doesn't walk the metadata again.
 */
export async function discoverMcpAuth(serverUrl: string): Promise<McpAuthDiscovery | null> {
    const cached = discoveryCache.get(serverUrl);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const found = await findMcpAuth(serverUrl);
    if (found) discoveryCache.set(serverUrl, { value: found, expiresAt: Date.now() + DISCOVERY_TTL_MS });
    return found;
}

async function findMcpAuth(serverUrl: string): Promise<McpAuthDiscovery | null> {
    const server = new URL(serverUrl);
    // The 401 challenge carries the metadata URL; a JSON-RPC ping draws it.
    let challenge: string | null = null;
    try {
        const response = await safeOutboundFetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'cencori', version: '1.0' } } }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        challenge = response.headers.get('www-authenticate');
        await response.body?.cancel().catch(() => undefined);
    } catch {
        // Fall through to the well-known paths.
    }

    const path = server.pathname.replace(/\/$/, '');
    const candidates = [
        resourceMetadataUrl(challenge),
        path ? `${server.origin}/.well-known/oauth-protected-resource${path}` : null,
        `${server.origin}/.well-known/oauth-protected-resource`,
    ].filter((u): u is string => !!u);
    let resource = serverUrl;
    let issuers: string[] = [];
    for (const candidate of candidates) {
        const metadata = await getJson(candidate);
        const servers = Array.isArray(metadata?.authorization_servers) ? (metadata.authorization_servers as unknown[]).filter((s): s is string => typeof s === 'string') : [];
        if (servers.length > 0) {
            issuers = servers;
            if (typeof metadata?.resource === 'string') resource = metadata.resource;
            break;
        }
    }
    // Servers from before protected-resource metadata host their own authorization server.
    if (issuers.length === 0) issuers = [server.origin];

    for (const issuer of issuers) {
        for (const url of authServerMetadataUrls(issuer)) {
            const metadata = await getJson(url);
            if (typeof metadata?.authorization_endpoint === 'string' && typeof metadata.token_endpoint === 'string') {
                const methods = Array.isArray(metadata.code_challenge_methods_supported) ? metadata.code_challenge_methods_supported : ['S256'];
                if (!methods.includes('S256')) continue;
                return {
                    resource,
                    server: {
                        issuer: typeof metadata.issuer === 'string' ? metadata.issuer : issuer,
                        authorizationEndpoint: metadata.authorization_endpoint,
                        tokenEndpoint: metadata.token_endpoint,
                        registrationEndpoint: typeof metadata.registration_endpoint === 'string' ? metadata.registration_endpoint : null,
                        scopes: Array.isArray(metadata.scopes_supported) ? (metadata.scopes_supported as unknown[]).filter((s): s is string => typeof s === 'string') : [],
                    },
                };
            }
        }
    }
    return null;
}

const REGISTRATION_TTL_MS = 60 * 60_000;
const registrationCache = new Map<string, { value: { clientId: string; clientSecret: string | null }; expiresAt: number }>();

/**
 * Register Cencori as a public client for this redirect (RFC 7591). One
 * registration per authorization server and redirect is reused for an hour,
 * so retries don't leave a trail of registered apps.
 */
export async function registerMcpClient(server: McpAuthServer, redirectUri: string): Promise<{ clientId: string; clientSecret: string | null }> {
    // Versioned: bump when the registration details change, so old registrations aren't reused.
    const key = `v2 ${server.issuer} ${redirectUri}`;
    const cached = registrationCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const client = await registerClient(server, redirectUri);
    registrationCache.set(key, { value: client, expiresAt: Date.now() + REGISTRATION_TTL_MS });
    return client;
}

async function registerClient(server: McpAuthServer, redirectUri: string): Promise<{ clientId: string; clientSecret: string | null }> {
    if (!server.registrationEndpoint) throw new Error('This server doesn\'t let apps register themselves, so it can\'t be signed into from Cencori yet. Paste a key instead.');
    const response = await safeOutboundFetch(server.registrationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            // What the server's approval screen shows about Cencori.
            client_name: 'Cencori',
            client_uri: 'https://cencori.com',
            logo_uri: 'https://cencori.com/logos/logo-w.png',
            tos_uri: 'https://cencori.com/terms-of-service',
            policy_uri: 'https://cencori.com/privacy-policy',
            redirect_uris: [redirectUri],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => null) as { client_id?: unknown; client_secret?: unknown; error_description?: unknown; error?: unknown } | null;
    if (!response.ok || typeof body?.client_id !== 'string') {
        const reason = typeof body?.error_description === 'string' ? body.error_description : typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`;
        throw new Error(`The server refused to register Cencori: ${reason.slice(0, 200)}`);
    }
    return { clientId: body.client_id, clientSecret: typeof body.client_secret === 'string' ? body.client_secret : null };
}

export function pkcePair(): { verifier: string; challenge: string } {
    const verifier = randomBytes(32).toString('base64url');
    return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

/** Everything the callback needs, encrypted into `state`. */
export interface McpOAuthState {
    projectId: string;
    organizationId: string;
    userId: string;
    agentId: string;
    versionId: string;
    /** Set when signing in again to a server already on the draft. */
    serverId: string | null;
    url: string;
    resource: string;
    issuer: string;
    tokenEndpoint: string;
    clientId: string;
    clientSecret: string | null;
    verifier: string;
    redirectUri: string;
    /** Where the owner is signed in to Cencori, when the redirect lands elsewhere (local development). */
    returnOrigin: string | null;
    exp: number;
}

function stateKey() {
    return createHash('sha256').update(`${tokenSecret()}:mcp-oauth-state`).digest();
}

export function sealMcpOAuthState(state: Omit<McpOAuthState, 'exp'>): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', stateKey(), iv);
    const sealed = Buffer.concat([cipher.update(JSON.stringify({ ...state, exp: Date.now() + STATE_TTL_MS }), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64url');
}

export function openMcpOAuthState(token: string): McpOAuthState | null {
    try {
        const raw = Buffer.from(token, 'base64url');
        const decipher = createDecipheriv('aes-256-gcm', stateKey(), raw.subarray(0, 12));
        decipher.setAuthTag(raw.subarray(12, 28));
        const state = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as McpOAuthState;
        return typeof state.exp === 'number' && state.exp > Date.now() ? state : null;
    } catch {
        return null;
    }
}

export function mcpAuthorizeUrl(discovery: McpAuthDiscovery, opts: { clientId: string; redirectUri: string; challenge: string; state: string }): string {
    const url = new URL(discovery.server.authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', opts.clientId);
    url.searchParams.set('redirect_uri', opts.redirectUri);
    url.searchParams.set('code_challenge', opts.challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', opts.state);
    url.searchParams.set('resource', discovery.resource);
    if (discovery.server.scopes.length > 0) url.searchParams.set('scope', discovery.server.scopes.join(' '));
    return url.toString();
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };

async function tokenRequest(tokenEndpoint: string, params: Record<string, string>, clientSecret: string | null): Promise<TokenResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
    if (clientSecret) headers.Authorization = `Basic ${Buffer.from(`${encodeURIComponent(params.client_id)}:${encodeURIComponent(clientSecret)}`).toString('base64')}`;
    const response = await safeOutboundFetch(tokenEndpoint, {
        method: 'POST',
        headers,
        body: new URLSearchParams(params).toString(),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => null) as (Partial<TokenResponse> & { error?: string; error_description?: string }) | null;
    if (!response.ok || typeof body?.access_token !== 'string') {
        throw Object.assign(new Error(body?.error_description || body?.error || `Token request failed (${response.status})`), { status: response.status, oauthError: body?.error });
    }
    return body as TokenResponse;
}

export function exchangeMcpCode(state: McpOAuthState, code: string): Promise<TokenResponse> {
    return tokenRequest(state.tokenEndpoint, {
        grant_type: 'authorization_code',
        code,
        redirect_uri: state.redirectUri,
        client_id: state.clientId,
        code_verifier: state.verifier,
        resource: state.resource,
    }, state.clientSecret);
}

/** What the connection row keeps to refresh tokens later. Secrets encrypted. */
interface ConnectionMetadata {
    kind: 'agent_mcp_oauth';
    server_url: string;
    resource: string;
    issuer: string;
    token_endpoint: string;
    client_id: string;
    client_secret_encrypted: string | null;
}

/** Store fresh tokens: a new connection, or replace the tokens on an existing one. */
export async function saveMcpConnection(
    db: Admin,
    opts: { projectId: string; organizationId: string; state: McpOAuthState; tokens: TokenResponse; connectionId?: string | null },
): Promise<string> {
    const metadata: ConnectionMetadata = {
        kind: 'agent_mcp_oauth',
        server_url: opts.state.url,
        resource: opts.state.resource,
        issuer: opts.state.issuer,
        token_endpoint: opts.state.tokenEndpoint,
        client_id: opts.state.clientId,
        client_secret_encrypted: opts.state.clientSecret ? encryptApiKey(opts.state.clientSecret, opts.organizationId) : null,
    };
    const row = {
        project_id: opts.projectId,
        connector_slug: MCP_OAUTH_CONNECTOR_SLUG,
        owner_type: 'platform',
        status: 'active',
        encrypted_access_ref: encryptApiKey(opts.tokens.access_token, opts.organizationId),
        encrypted_refresh_ref: opts.tokens.refresh_token ? encryptApiKey(opts.tokens.refresh_token, opts.organizationId) : null,
        expires_at: opts.tokens.expires_in ? new Date(Date.now() + opts.tokens.expires_in * 1000).toISOString() : null,
        key_hint: new URL(opts.state.url).host,
        metadata,
        last_error: null,
    };
    if (opts.connectionId) {
        const { data } = await db.from('tool_connections').update(row).eq('project_id', opts.projectId).eq('id', opts.connectionId).select('id').maybeSingle();
        if (data) return (data as { id: string }).id;
    }
    const { data, error } = await db.from('tool_connections').insert(row).select('id').single();
    if (error || !data) throw new Error('Couldn\'t save the sign-in. Try again.');
    return (data as { id: string }).id;
}

type ConnectionRow = {
    id: string;
    project_id: string;
    status: string;
    encrypted_access_ref: string | null;
    encrypted_refresh_ref: string | null;
    expires_at: string | null;
    metadata: Partial<ConnectionMetadata> | null;
};

/**
 * A usable access token for the connection: the stored one, or a refreshed
 * one when it has expired (or `force`, after the server rejected it). The
 * refresh token is replaced when the server rotates it.
 */
export async function mcpAccessToken(db: Admin, connectionId: string, organizationId: string, opts: { force?: boolean } = {}): Promise<string> {
    const { data } = await db.from('tool_connections')
        .select('id, project_id, status, encrypted_access_ref, encrypted_refresh_ref, expires_at, metadata')
        .eq('id', connectionId)
        .eq('connector_slug', MCP_OAUTH_CONNECTOR_SLUG)
        .maybeSingle();
    const connection = data as ConnectionRow | null;
    if (!connection || connection.status === 'revoked') throw new Error('signed_out');
    const expired = !!connection.expires_at && Date.parse(connection.expires_at) - Date.now() < EXPIRY_SKEW_MS;
    if (!opts.force && !expired && connection.encrypted_access_ref) return decryptApiKey(connection.encrypted_access_ref, organizationId);

    const metadata = connection.metadata ?? {};
    if (!connection.encrypted_refresh_ref || !metadata.token_endpoint || !metadata.client_id) throw new Error('signed_out');
    let tokens: TokenResponse;
    try {
        tokens = await tokenRequest(metadata.token_endpoint, {
            grant_type: 'refresh_token',
            refresh_token: decryptApiKey(connection.encrypted_refresh_ref, organizationId),
            client_id: metadata.client_id,
            ...(metadata.resource ? { resource: metadata.resource } : {}),
        }, metadata.client_secret_encrypted ? decryptApiKey(metadata.client_secret_encrypted, organizationId) : null);
    } catch (error) {
        // A refused refresh token means the owner has to sign in again.
        await db.from('tool_connections').update({ status: 'expired', last_error: error instanceof Error ? error.message.slice(0, 300) : 'Refresh failed' }).eq('id', connectionId);
        throw new Error('signed_out');
    }
    await db.from('tool_connections').update({
        encrypted_access_ref: encryptApiKey(tokens.access_token, organizationId),
        ...(tokens.refresh_token ? { encrypted_refresh_ref: encryptApiKey(tokens.refresh_token, organizationId) } : {}),
        expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
        status: 'active',
        last_error: null,
    }).eq('id', connectionId);
    return tokens.access_token;
}

/** Sign-ins for servers taken off the draft: tokens wiped, row kept for audit. */
export async function revokeMcpConnections(db: Admin, projectId: string, connectionIds: string[]): Promise<void> {
    if (connectionIds.length === 0) return;
    await db.from('tool_connections')
        .update({ status: 'revoked', encrypted_access_ref: null, encrypted_refresh_ref: null })
        .eq('project_id', projectId)
        .eq('connector_slug', MCP_OAUTH_CONNECTOR_SLUG)
        .in('id', connectionIds);
}

/**
 * The redirect to register for a console origin. Servers only accept plain
 * http for loopback hosts, and a local console runs on console.localhost,
 * so local sign-ins return to localhost and the callback forwards them to
 * the console (`returnOrigin`), where the owner's session is.
 */
export function mcpRedirectFor(consoleOrigin: string): { redirectUri: string; returnOrigin: string | null } {
    const origin = new URL(consoleOrigin);
    if (origin.protocol === 'http:' && origin.hostname.endsWith('.localhost')) {
        const loopback = new URL(origin.toString());
        loopback.hostname = 'localhost';
        return { redirectUri: `${loopback.origin}/api/mcp/oauth/callback`, returnOrigin: origin.origin };
    }
    return { redirectUri: `${origin.origin}/api/mcp/oauth/callback`, returnOrigin: null };
}
