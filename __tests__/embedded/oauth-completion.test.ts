import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/security/outbound-url', () => ({
    safeOutboundFetch: (...args: unknown[]) => (globalThis as Record<string, unknown>).__outboundFetch?.(...args),
    assertSafeOutboundUrl: vi.fn(() => true),
}));

import {
    completeOauthAuthorization,
    connectionOauthConfig,
    isAllowedReturnUrl,
    returnUrlWith,
    signOAuthState,
    withLiveManagedAuth,
} from '@/lib/embedded/oauth';
import { encryptApiKey } from '@/lib/encryption';

const ORG = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const CONNECTION = '33333333-3333-4333-8333-333333333333';

type Row = Record<string, unknown>;

/** Just enough of the query builder for the completion path. */
function fakeDb(tables: Record<string, Row[]>) {
    const updates: Array<{ table: string; patch: Row }> = [];
    const from = (table: string) => {
        const filters: Array<[string, unknown]> = [];
        let mode: 'select' | 'update' | 'delete' = 'select';
        let patch: Row = {};
        const match = () => (tables[table] ?? []).filter((row) => filters.every(([k, v]) => row[k] === v));
        const run = () => {
            if (mode === 'update') {
                updates.push({ table, patch });
                for (const row of match()) Object.assign(row, patch);
            }
            if (mode === 'delete') tables[table] = (tables[table] ?? []).filter((row) => !match().includes(row));
            return { data: null, error: null };
        };
        const builder = {
            select: () => builder,
            update: (p: Row) => { mode = 'update'; patch = p; return builder; },
            delete: () => { mode = 'delete'; return builder; },
            eq: (k: string, v: unknown) => { filters.push([k, v]); return builder; },
            maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
        };
        return builder;
    };
    return { db: { from } as never, tables, updates };
}

function stateFor(raw: string) {
    return `${raw}.${signOAuthState(`${PROJECT}:${CONNECTION}:${raw}`)}`;
}

function seeded(metadata: Row, overrides: Row = {}) {
    const state = stateFor('abc');
    return {
        state,
        ...fakeDb({
            oauth_states: [{
                state, project_id: PROJECT, connection_id: CONNECTION, connector_slug: 'gmail', code_verifier: 'v',
                redirect_uri: 'https://app.acme.example/oauth/google', scopes: ['s1'], metadata,
                expires_at: new Date(Date.now() + 60_000).toISOString(), ...overrides,
            }],
            projects: [{ id: PROJECT, organization_id: ORG }],
            connectors: [{ slug: 'gmail', oauth_config: { auth_url: 'https://accounts.google.com/o/oauth2/v2/auth', token_url: 'https://oauth2.googleapis.com/token' } }],
            tool_connections: [{ id: CONNECTION, status: 'pending' }],
        }),
    };
}

beforeEach(() => {
    for (const key of Object.keys(process.env)) {
        if (key.startsWith('CENCORI_OAUTH_') || key.startsWith('CENCORI_GMAIL')) delete process.env[key];
    }
    process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'test-secret-test-secret-test-secret';
    delete (globalThis as Record<string, unknown>).__outboundFetch;
});

describe('return_url', () => {
    it('allows https and localhost http only', () => {
        expect(isAllowedReturnUrl('https://app.acme.example/done')).toBe(true);
        expect(isAllowedReturnUrl('http://localhost:3000/done')).toBe(true);
        expect(isAllowedReturnUrl('http://app.acme.example/done')).toBe(false);
        expect(isAllowedReturnUrl('javascript:alert(1)')).toBe(false);
        expect(isAllowedReturnUrl('https://user:pw@app.acme.example/')).toBe(false);
        expect(isAllowedReturnUrl(undefined)).toBe(false);
    });

    it('keeps the query the customer already had', () => {
        expect(returnUrlWith('https://a.example/x?tab=mail', { status: 'connected', connection_id: 'con_1' }))
            .toBe('https://a.example/x?tab=mail&status=connected&connection_id=con_1');
    });
});

describe('connectionOauthConfig', () => {
    it("uses the connection's own OAuth app over the platform client", () => {
        process.env.CENCORI_OAUTH_GMAIL_CLIENT_ID = 'platform-id';
        process.env.CENCORI_OAUTH_GMAIL_CLIENT_SECRET = 'platform-secret';
        const own = connectionOauthConfig('gmail', {}, { oauth: { client_id: 'own-id', client_secret_ref: encryptApiKey('own-secret', ORG) } }, ORG);
        expect(own.clientId).toBe('own-id');
        expect(own.clientSecret).toBe('own-secret');
        expect(connectionOauthConfig('gmail', {}, {}, ORG).clientId).toBe('platform-id');
    });
});

describe('withLiveManagedAuth', () => {
    it('reports managed_auth only when this deployment holds the client', () => {
        expect(withLiveManagedAuth({ slug: 'gmail', managed_auth: true }).managed_auth).toBe(false);
        process.env.CENCORI_OAUTH_GMAIL_CLIENT_ID = 'id';
        process.env.CENCORI_OAUTH_GMAIL_CLIENT_SECRET = 'secret';
        expect(withLiveManagedAuth({ slug: 'gmail', managed_auth: true }).managed_auth).toBe(true);
        expect(withLiveManagedAuth({ slug: 'slack', managed_auth: false }).managed_auth).toBe(false);
    });
});

describe('completeOauthAuthorization', () => {
    const ownApp = () => ({ client_id: 'own-id', client_secret_ref: encryptApiKey('own-secret', ORG), token_url: 'https://oauth2.googleapis.com/token' });

    it("exchanges with the customer's app and redirect URI, then activates the connection", async () => {
        const { db, state, tables } = seeded({ ...ownApp(), return_url: 'https://app.acme.example/settings' });
        const calls: Array<{ url: string; body: string }> = [];
        (globalThis as Record<string, unknown>).__outboundFetch = async (url: string, init: { body: string }) => {
            calls.push({ url, body: init.body });
            return { ok: true, status: 200, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'a b' }), text: async () => '' };
        };
        const done = await completeOauthAuthorization(db, { state, code: 'the-code', expect: { projectId: PROJECT, connectionId: CONNECTION } });
        expect(done).toMatchObject({ ok: true, connectionId: CONNECTION, connector: 'gmail', scopes: ['a', 'b'], returnUrl: 'https://app.acme.example/settings' });
        const sent = new URLSearchParams(calls[0].body);
        expect(sent.get('client_id')).toBe('own-id');
        expect(sent.get('client_secret')).toBe('own-secret');
        expect(sent.get('redirect_uri')).toBe('https://app.acme.example/oauth/google');
        expect(sent.get('code')).toBe('the-code');
        expect(tables.tool_connections[0].status).toBe('active');
        expect(tables.oauth_states).toHaveLength(0);
    });

    it('refuses a state issued for another connection', async () => {
        const { db, state } = seeded(ownApp());
        const done = await completeOauthAuthorization(db, { state, code: 'c', expect: { projectId: PROJECT, connectionId: '44444444-4444-4444-8444-444444444444' } });
        expect(done).toMatchObject({ ok: false, status: 400 });
    });

    it('refuses a tampered or expired state', async () => {
        const tampered = seeded(ownApp());
        tampered.tables.oauth_states[0].state = 'abc.bad';
        expect(await completeOauthAuthorization(tampered.db, { state: 'abc.bad', code: 'c' })).toMatchObject({ ok: false, status: 400 });
        const expired = seeded(ownApp(), { expires_at: new Date(Date.now() - 1000).toISOString() });
        expect(await completeOauthAuthorization(expired.db, { state: expired.state, code: 'c' })).toMatchObject({ ok: false, status: 410 });
    });

    it('marks the connection errored when the provider rejects the code', async () => {
        const { db, state, tables } = seeded(ownApp());
        (globalThis as Record<string, unknown>).__outboundFetch = async () => ({ ok: false, status: 400, json: async () => ({}), text: async () => 'invalid_grant' });
        const done = await completeOauthAuthorization(db, { state, code: 'c' });
        expect(done).toMatchObject({ ok: false, status: 502, code: 'oauth_failed' });
        expect(tables.tool_connections[0].status).toBe('error');
    });
});
