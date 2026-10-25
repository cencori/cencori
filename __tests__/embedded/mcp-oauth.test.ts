import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/security/outbound-url', () => ({ safeOutboundFetch: fetchMock }));

import { encryptApiKey, decryptApiKey } from '@/lib/encryption';
import {
    authServerMetadataUrls, discoverMcpAuth, exchangeMcpCode, mcpAccessToken, mcpAuthorizeUrl,
    mcpRedirectFor, openMcpOAuthState, pkcePair, registerMcpClient, resourceMetadataUrl, sealMcpOAuthState,
} from '@/lib/embedded/mcp-oauth';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const ORG = 'org_1';

describe('MCP OAuth', () => {
    beforeEach(() => {
        process.env.ENCRYPTION_SECRET ??= 'test-encryption-secret-at-least-32-chars-long';
        fetchMock.mockReset();
    });

    it('reads the metadata pointer and builds path-aware discovery URLs', () => {
        expect(resourceMetadataUrl('Bearer error="invalid_token", resource_metadata="https://mcp.x.com/.well-known/oauth-protected-resource/mcp"')).toBe('https://mcp.x.com/.well-known/oauth-protected-resource/mcp');
        expect(resourceMetadataUrl('Bearer realm="x"')).toBeNull();
        expect(authServerMetadataUrls('https://auth.x.com')).toEqual(['https://auth.x.com/.well-known/oauth-authorization-server', 'https://auth.x.com/.well-known/openid-configuration']);
        expect(authServerMetadataUrls('https://x.com/tenant1')[0]).toBe('https://x.com/.well-known/oauth-authorization-server/tenant1');
    });

    it('follows the 401 challenge to the authorization server', async () => {
        fetchMock.mockImplementation(async (url: string | URL) => {
            const u = String(url);
            if (u === 'https://mcp.x.com/mcp') return new Response('', { status: 401, headers: { 'WWW-Authenticate': 'Bearer resource_metadata="https://mcp.x.com/.well-known/oauth-protected-resource"' } });
            if (u === 'https://mcp.x.com/.well-known/oauth-protected-resource') return json({ resource: 'https://mcp.x.com/mcp', authorization_servers: ['https://auth.x.com'], scopes_supported: ['read'] });
            if (u === 'https://auth.x.com/.well-known/oauth-authorization-server') {
                return json({ issuer: 'https://auth.x.com', authorization_endpoint: 'https://auth.x.com/authorize', token_endpoint: 'https://auth.x.com/token', registration_endpoint: 'https://auth.x.com/register', code_challenge_methods_supported: ['S256'], scopes_supported: ['read', 'write'] });
            }
            return new Response('', { status: 404 });
        });
        const discovery = await discoverMcpAuth('https://mcp.x.com/mcp');
        expect(discovery).toEqual({
            resource: 'https://mcp.x.com/mcp',
            server: { issuer: 'https://auth.x.com', authorizationEndpoint: 'https://auth.x.com/authorize', tokenEndpoint: 'https://auth.x.com/token', registrationEndpoint: 'https://auth.x.com/register', scopes: ['read', 'write'] },
        });
        const authorize = new URL(mcpAuthorizeUrl(discovery!, { clientId: 'c1', redirectUri: 'https://console.cencori.com/api/mcp/oauth/callback', challenge: 'ch', state: 'st' }));
        expect(Object.fromEntries(authorize.searchParams)).toMatchObject({ response_type: 'code', client_id: 'c1', code_challenge: 'ch', code_challenge_method: 'S256', state: 'st', resource: 'https://mcp.x.com/mcp', scope: 'read write' });
    });

    it('returns null for servers without OAuth', async () => {
        fetchMock.mockResolvedValue(new Response('', { status: 404 }));
        expect(await discoverMcpAuth('https://mcp.y.com/mcp')).toBeNull();
    });

    it('returns local sign-ins via loopback, which servers accept over http', () => {
        expect(mcpRedirectFor('http://console.localhost:3000')).toEqual({ redirectUri: 'http://localhost:3000/api/mcp/oauth/callback', returnOrigin: 'http://console.localhost:3000' });
        expect(mcpRedirectFor('https://console.cencori.com')).toEqual({ redirectUri: 'https://console.cencori.com/api/mcp/oauth/callback', returnOrigin: null });
        expect(mcpRedirectFor('http://localhost:3000')).toEqual({ redirectUri: 'http://localhost:3000/api/mcp/oauth/callback', returnOrigin: null });
    });

    it('surfaces the server\'s reason when registration is refused', async () => {
        fetchMock.mockResolvedValueOnce(json({ error: 'invalid_redirect_uri', error_description: 'plaintext HTTP is allowed only for loopback addresses.' }, 400));
        await expect(registerMcpClient({ issuer: 'https://refuse.example.com', authorizationEndpoint: 'a', tokenEndpoint: 't', registrationEndpoint: 'https://refuse.example.com/register', scopes: [] }, 'http://console.localhost:3000/cb')).rejects.toThrow(/loopback/);
    });

    it('registers as a public client', async () => {
        fetchMock.mockResolvedValueOnce(json({ client_id: 'dyn_1' }, 201));
        const client = await registerMcpClient({ issuer: 'i', authorizationEndpoint: 'a', tokenEndpoint: 't', registrationEndpoint: 'https://auth.x.com/register', scopes: [] }, 'https://c/cb');
        expect(client).toEqual({ clientId: 'dyn_1', clientSecret: null });
        expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({ redirect_uris: ['https://c/cb'], token_endpoint_auth_method: 'none' });
        await expect(registerMcpClient({ issuer: 'i', authorizationEndpoint: 'a', tokenEndpoint: 't', registrationEndpoint: null, scopes: [] }, 'x')).rejects.toThrow(/key/);
    });

    it('seals state so it can\'t be read, forged or reused late', () => {
        const pkce = pkcePair();
        expect(pkce.verifier).not.toBe(pkce.challenge);
        const state = { projectId: 'p', organizationId: ORG, userId: 'u', agentId: 'a', versionId: 'v', serverId: null, url: 'https://mcp.x.com/mcp', resource: 'r', issuer: 'https://auth.x.com', tokenEndpoint: 't', clientId: 'c', clientSecret: null, verifier: pkce.verifier, redirectUri: 'cb', returnOrigin: null };
        const sealed = sealMcpOAuthState(state);
        expect(sealed).not.toContain(pkce.verifier);
        expect(openMcpOAuthState(sealed)).toMatchObject(state);
        expect(openMcpOAuthState(`${sealed.slice(0, -2)}xx`)).toBeNull();
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + 11 * 60_000);
        expect(openMcpOAuthState(sealed)).toBeNull();
        vi.useRealTimers();
    });

    it('exchanges the code with the verifier and resource', async () => {
        fetchMock.mockResolvedValueOnce(json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));
        const tokens = await exchangeMcpCode({ tokenEndpoint: 'https://auth.x.com/token', clientId: 'c1', clientSecret: null, verifier: 'ver', redirectUri: 'https://c/cb', resource: 'https://mcp.x.com/mcp' } as never, 'code1');
        expect(tokens.access_token).toBe('at');
        const body = new URLSearchParams(String((fetchMock.mock.calls[0][1] as RequestInit).body));
        expect(Object.fromEntries(body)).toEqual({ grant_type: 'authorization_code', code: 'code1', redirect_uri: 'https://c/cb', client_id: 'c1', code_verifier: 'ver', resource: 'https://mcp.x.com/mcp' });
    });

    it('refreshes expired tokens, keeping the rotated refresh token, and signs out on refusal', async () => {
        const row: Record<string, unknown> = {
            id: 'conn1', project_id: 'p', status: 'active',
            encrypted_access_ref: encryptApiKey('old_access', ORG), encrypted_refresh_ref: encryptApiKey('old_refresh', ORG),
            expires_at: new Date(Date.now() - 1000).toISOString(),
            metadata: { token_endpoint: 'https://auth.x.com/token', client_id: 'c1', resource: 'https://mcp.x.com/mcp', client_secret_encrypted: null },
        };
        const updates: Array<Record<string, unknown>> = [];
        const db = {
            from: () => {
                const chain = {
                    select: () => chain, eq: () => chain,
                    maybeSingle: async () => ({ data: row }),
                    update: (patch: Record<string, unknown>) => { updates.push(patch); Object.assign(row, patch); return chain; },
                };
                return chain;
            },
        };
        fetchMock.mockResolvedValueOnce(json({ access_token: 'new_access', refresh_token: 'new_refresh', expires_in: 3600 }));
        expect(await mcpAccessToken(db as never, 'conn1', ORG)).toBe('new_access');
        expect(decryptApiKey(row.encrypted_refresh_ref as string, ORG)).toBe('new_refresh');
        expect(Object.fromEntries(new URLSearchParams(String((fetchMock.mock.calls[0][1] as RequestInit).body)))).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'old_refresh', resource: 'https://mcp.x.com/mcp' });

        // Fresh token: no refresh.
        expect(await mcpAccessToken(db as never, 'conn1', ORG)).toBe('new_access');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Refused refresh: the sign-in is marked expired.
        fetchMock.mockResolvedValueOnce(json({ error: 'invalid_grant' }, 400));
        await expect(mcpAccessToken(db as never, 'conn1', ORG, { force: true })).rejects.toThrow('signed_out');
        expect(updates.at(-1)).toMatchObject({ status: 'expired' });
    });
});
