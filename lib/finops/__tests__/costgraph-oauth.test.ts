/**
 * @vitest-environment node
 */
import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { encryptApiKey } from '@/lib/encryption';
import {
    CostGraphOAuthError,
    assertGrantedScopes,
    costgraphOAuthEnabled,
    costgraphOAuthScopes,
    costgraphOAuthServed,
    buildAuthorizeUrl,
    clientMetadataDocument,
    createPkce,
    createPushConnection,
    getValidAccessToken,
    openOAuthState,
    refreshTokens,
    safeReturnTo,
    sealOAuthState,
    type OAuthStatePayload,
} from '@/lib/finops/costgraph-oauth';
import { createCostGraphPlatformClient } from '@/lib/finops/costgraph';

const env = { COSTGRAPH_OAUTH_STATE_SECRET: 'test-secret' } as NodeJS.ProcessEnv;

describe('PKCE', () => {
    it('derives the S256 challenge from the verifier', () => {
        const { verifier, challenge } = createPkce();
        expect(challenge).toBe(crypto.createHash('sha256').update(verifier).digest('base64url'));
        expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });
});

describe('signed state', () => {
    const payload: OAuthStatePayload = {
        state: 'st', nonce: 'n', verifier: 'v', organizationId: 'org_1', orgSlug: 'arcie',
        userId: 'user_1', returnTo: '/arcie/arcie/settings?tab=integrations', issuedAt: 1_000_000,
    };

    it('round-trips for the matching state within its lifetime', () => {
        const sealed = sealOAuthState(payload, env);
        expect(openOAuthState(sealed, 'st', 1_000_000 + 60_000, env)).toEqual(payload);
    });

    it('rejects a tampered cookie, a different state, and an expired one', () => {
        const sealed = sealOAuthState(payload, env);
        const [body, sig] = sealed.split('.');
        const forged = Buffer.from(JSON.stringify({ ...payload, organizationId: 'org_victim' })).toString('base64url');
        expect(openOAuthState(`${forged}.${sig}`, 'st', 1_000_000, env)).toBeNull();
        expect(openOAuthState(`${body}.${sig}`, 'other', 1_000_000, env)).toBeNull();
        expect(openOAuthState(sealed, 'st', 1_000_000 + 16 * 60_000, env)).toBeNull();
        expect(openOAuthState(sealed, 'st', 1_000_000, { COSTGRAPH_OAUTH_STATE_SECRET: 'other' } as NodeJS.ProcessEnv)).toBeNull();
    });
});

describe('safeReturnTo', () => {
    /** The callback redirects here, so it must never leave the console. */
    it('only allows same-site relative paths', () => {
        expect(safeReturnTo('/arcie/x/settings?tab=integrations', '/home')).toBe('/arcie/x/settings?tab=integrations');
        expect(safeReturnTo('https://evil.example', '/home')).toBe('/home');
        expect(safeReturnTo('//evil.example/path', '/home')).toBe('/home');
        expect(safeReturnTo('/\\evil.example', '/home')).toBe('/home');
        expect(safeReturnTo(null, '/home')).toBe('/home');
    });
});

describe('authorize URL and client document', () => {
    it('asks for the code flow with PKCE S256', () => {
        const url = new URL(buildAuthorizeUrl({
            clientId: 'https://console.cencori.com/api/integrations/costgraph/oauth/client.json',
            redirectUri: 'https://console.cencori.com/api/integrations/costgraph/oauth/callback',
            scopes: ['openid', 'profile', 'focus:write'],
            state: 's', nonce: 'n', codeChallenge: 'c',
        }));
        expect(url.origin + url.pathname).toBe('https://app.costgraph.ai/oauth/authorize');
        expect(Object.fromEntries(url.searchParams)).toMatchObject({
            response_type: 'code', scope: 'openid profile focus:write', code_challenge_method: 'S256', code_challenge: 'c', state: 's',
        });
    });

    it('describes our client with a client_id equal to its own URL', () => {
        const doc = clientMetadataDocument('https://console.cencori.com');
        expect(doc.client_id).toBe('https://console.cencori.com/api/integrations/costgraph/oauth/client.json');
        expect(doc.redirect_uris).toEqual(['https://console.cencori.com/api/integrations/costgraph/oauth/callback']);
        expect(doc.token_endpoint_auth_method).toBe('none');
        expect(doc.client_name).toBe('Cencori');
    });
});

function tokenResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('token endpoint', () => {
    it('reads a rotated token pair and its expiry', async () => {
        const fetchImpl = vi.fn(async () => tokenResponse({ access_token: 'a2', refresh_token: 'r2', expires_in: 3600, scope: 'focus:write' }));
        const tokens = await refreshTokens({ refreshToken: 'r1', clientId: 'cid', fetchImpl: fetchImpl as typeof fetch, now: 0 });
        expect(tokens).toMatchObject({ accessToken: 'a2', refreshToken: 'r2', expiresAt: 3_600_000, scope: 'focus:write' });
        const body = new URLSearchParams(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
        expect(Object.fromEntries(body)).toEqual({ grant_type: 'refresh_token', refresh_token: 'r1', client_id: 'cid' });
    });

    it('marks a dead refresh token as needing the user to reconnect', async () => {
        const fetchImpl = vi.fn(async () => tokenResponse({ error: 'invalid_grant' }, 400));
        const error = await refreshTokens({ refreshToken: 'r', clientId: 'c', fetchImpl: fetchImpl as typeof fetch }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(CostGraphOAuthError);
        expect((error as CostGraphOAuthError).requiresReconnect).toBe(true);
    });
});

/** A one-row stand-in for organization_finops_connections, enough for the lease logic. */
function fakeStore(initial: Record<string, unknown>) {
    const row: Record<string, unknown> = { ...initial };
    const updates: Array<Record<string, unknown>> = [];
    const builder = () => {
        let patch: Record<string, unknown> | null = null;
        let leaseFilter = false;
        const api = {
            select: () => api,
            update: (p: Record<string, unknown>) => { patch = p; return api; },
            eq: () => api,
            or: () => { leaseFilter = true; return api; },
            single: async () => apply(),
            maybeSingle: async () => apply(),
            then: (resolve: (v: unknown) => void) => resolve(apply()),
        };
        const apply = () => {
            if (patch) {
                if (leaseFilter) {
                    const lease = row.oauth_refresh_lease_until as string | null;
                    if (lease && Date.parse(lease) > Date.now()) return { data: null, error: null };
                }
                Object.assign(row, patch);
                updates.push(patch);
            }
            return { data: { ...row }, error: null };
        };
        return api;
    };
    return { supabase: { from: () => builder() } as never, row, updates };
}

describe('getValidAccessToken', () => {
    const org = 'org_1';
    const base = {
        id: 'conn_1',
        organization_id: org,
        oauth_access_token_encrypted: encryptApiKey('access-old', org),
        oauth_refresh_token_encrypted: encryptApiKey('refresh-old', org),
        oauth_refresh_lease_until: null,
    };

    it('uses the stored token while it has time left, without refreshing', async () => {
        const { supabase } = fakeStore({ ...base, oauth_access_expires_at: new Date(Date.now() + 30 * 60_000).toISOString() });
        const fetchImpl = vi.fn();
        await expect(getValidAccessToken(supabase, 'conn_1', { clientId: 'c', fetchImpl: fetchImpl as never })).resolves.toBe('access-old');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('refreshes once under a lease and stores the rotated pair', async () => {
        const store = fakeStore({ ...base, oauth_access_expires_at: new Date(Date.now() + 30_000).toISOString() });
        const fetchImpl = vi.fn(async () => tokenResponse({ access_token: 'access-new', refresh_token: 'refresh-new', expires_in: 3600 }));
        await expect(getValidAccessToken(store.supabase, 'conn_1', { clientId: 'c', fetchImpl: fetchImpl as never })).resolves.toBe('access-new');
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(store.row.oauth_refresh_lease_until).toBeNull();
        expect(store.row.oauth_refresh_token_encrypted).not.toBe(base.oauth_refresh_token_encrypted);
    });

    /**
     * CostGraph signs the user out if a rotated-away refresh token is presented again, so a second
     * process must wait for the first one's token rather than refresh too.
     */
    it('waits for another process holding the lease instead of spending the refresh token twice', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
        const store = fakeStore({
            ...base,
            oauth_access_expires_at: new Date(Date.now() + 30_000).toISOString(),
            oauth_refresh_lease_until: new Date(Date.now() + 20_000).toISOString(),
        });
        const fetchImpl = vi.fn();
        const pending = getValidAccessToken(store.supabase, 'conn_1', { clientId: 'c', fetchImpl: fetchImpl as never });
        // Let it read the stale token, fail to claim the lease, and start waiting.
        await vi.advanceTimersByTimeAsync(0);
        expect(store.updates).toHaveLength(0);
        // Only now does the other process land its refresh.
        Object.assign(store.row, {
            oauth_access_token_encrypted: encryptApiKey('access-from-other', org),
            oauth_access_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
            oauth_refresh_lease_until: null,
        });
        await vi.advanceTimersByTimeAsync(600);
        await expect(pending).resolves.toBe('access-from-other');
        expect(fetchImpl).not.toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('releases the lease when the refresh fails', async () => {
        const store = fakeStore({ ...base, oauth_access_expires_at: new Date(Date.now() - 1).toISOString() });
        const fetchImpl = vi.fn(async () => tokenResponse({ error: 'invalid_grant' }, 400));
        await expect(getValidAccessToken(store.supabase, 'conn_1', { clientId: 'c', fetchImpl: fetchImpl as never })).rejects.toBeInstanceOf(CostGraphOAuthError);
        expect(store.row.oauth_refresh_lease_until).toBeNull();
    });
});

describe('assertGrantedScopes', () => {
    /**
     * What CostGraph actually granted on 2026-10-14: we asked for openid profile focus:write
     * integrations:read and got "mcp" — enough to create the connection, never enough to push.
     */
    it('refuses a token that cannot send usage', () => {
        expect(() => assertGrantedScopes({ scope: 'mcp' })).toThrow(CostGraphOAuthError);
        try { assertGrantedScopes({ scope: 'mcp' }); } catch (e) { expect((e as CostGraphOAuthError).code).toBe('insufficient_scope'); }
    });

    it('accepts a token with focus:write, and one whose response names no scope', () => {
        expect(() => assertGrantedScopes({ scope: 'openid profile focus:write integrations:read' })).not.toThrow();
        expect(() => assertGrantedScopes({ scope: null })).not.toThrow();
    });
});

describe('createPushConnection', () => {
    it('creates a connection bound to provider cencori and the organization', async () => {
        const fetchImpl = vi.fn(async () => tokenResponse({ data: { connection_id: 'fpc_new' } }, 201));
        const result = await createPushConnection({
            accessToken: 'tok', tenantId: 'ten', billingAccountId: 'org_1', fetchImpl: fetchImpl as never, env: {} as NodeJS.ProcessEnv,
        });
        expect(result).toEqual({ connectionId: 'fpc_new', reused: false });
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://api.costgraph.ai/api/v1/integrations/connections');
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
        expect(JSON.parse(String(init.body))).toMatchObject({ provider: 'cencori', provider_account_id: 'org_1', tenant_id: 'ten' });
    });

    /** A reconnect: CostGraph allows one connection per provider and billing account. */
    it('reuses the existing connection when CostGraph answers 409', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(tokenResponse({ message: 'connection exists' }, 409))
            .mockResolvedValueOnce(tokenResponse({ data: [
                { connection_id: 'fpc_other', provider_account_id: 'org_2', ingest_mode: 'push', provider: 'cencori' },
                { connection_id: 'fpc_pull', provider_account_id: 'org_1', ingest_mode: 'pull', provider: 'cencori' },
                { connection_id: 'fpc_mine', provider_account_id: 'org_1', ingest_mode: 'push', provider: 'cencori' },
            ] }));
        const result = await createPushConnection({ accessToken: 'tok', tenantId: 'ten', billingAccountId: 'org_1', fetchImpl: fetchImpl as never, env: {} as NodeJS.ProcessEnv });
        expect(result).toEqual({ connectionId: 'fpc_mine', reused: true });
        const [url, init] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
        expect(url).toBe('https://api.costgraph.ai/api/v1/integrations');
        expect((init.headers as Record<string, string>)['X-CostGraph-Tenant-ID']).toBe('ten');
    });

    it('surfaces a 403 when the user may not create connections in CostGraph', async () => {
        const fetchImpl = vi.fn(async () => tokenResponse({ message: 'forbidden' }, 403));
        const error = await createPushConnection({ accessToken: 't', tenantId: 'x', billingAccountId: 'o', fetchImpl: fetchImpl as never, env: {} as NodeJS.ProcessEnv }).catch((e: unknown) => e);
        expect((error as { status?: number }).status).toBe(403);
    });
});

describe('rollout switch', () => {
    it('turns Connect on for everyone, or only for listed organizations', () => {
        expect(costgraphOAuthEnabled('arcie', { COSTGRAPH_OAUTH_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(true);
        expect(costgraphOAuthEnabled('arcie', { COSTGRAPH_OAUTH_ORGS: 'arcie, other' } as NodeJS.ProcessEnv)).toBe(true);
        expect(costgraphOAuthEnabled('someone', { COSTGRAPH_OAUTH_ORGS: 'arcie' } as NodeJS.ProcessEnv)).toBe(false);
        expect(costgraphOAuthEnabled(null, { COSTGRAPH_OAUTH_ORGS: 'arcie' } as NodeJS.ProcessEnv)).toBe(false);
        expect(costgraphOAuthServed({ COSTGRAPH_OAUTH_ORGS: 'arcie' } as NodeJS.ProcessEnv)).toBe(true);
        expect(costgraphOAuthServed({} as NodeJS.ProcessEnv)).toBe(false);
    });

    it('asks for focus:write and integrations:read by default', () => {
        expect(costgraphOAuthScopes({} as NodeJS.ProcessEnv)).toEqual(['openid', 'profile', 'focus:write', 'integrations:read']);
    });
});

describe('platform client credentials', () => {
    it('sends an OAuth token as Bearer and an API key as X-API-Key', async () => {
        const fetchImpl = vi.fn(async () => tokenResponse({}));
        const body = { connection_id: 'fpc', focus_version: '1.2', charge_period_start: 'a', charge_period_end: 'b', rows: [] };
        await createCostGraphPlatformClient({ accessToken: 'tok' }, fetchImpl as never).pushFocus(body);
        await createCostGraphPlatformClient('bl_key', fetchImpl as never).pushFocus(body);
        const headers = fetchImpl.mock.calls.map((c) => (c as unknown as [URL, RequestInit])[1].headers as Record<string, string>);
        expect(headers[0].Authorization).toBe('Bearer tok');
        expect(headers[0]).not.toHaveProperty('X-API-Key');
        expect(headers[1]['X-API-Key']).toBe('bl_key');
    });
});
