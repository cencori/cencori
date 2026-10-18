import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/security/outbound-url', () => ({
    safeOutboundFetch: (...args: unknown[]) => (globalThis as Record<string, unknown>).__outboundFetch?.(...args),
    assertSafeOutboundUrl: vi.fn(() => true),
}));

import { oauthClientConfig, resolveOauthEndpoints, type OauthEndpoints } from '@/lib/embedded/oauth';
import { executeConnectorHttp } from '@/lib/embedded/tool-executor';
import { encryptApiKey } from '@/lib/encryption';

type FakeResponse = { ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string>; headers: Map<string, string> };

function jsonResponse(body: unknown, status = 200): FakeResponse {
    return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body), headers: new Map() };
}

describe('oauthClientConfig', () => {
    beforeEach(() => {
        for (const key of Object.keys(process.env)) {
            if (key.startsWith('CENCORI_OAUTH_') || key.startsWith('CENCORI_GMAIL')) delete process.env[key];
        }
    });

    it('prefers overrides, then connector config, then per-slug env, then legacy gmail env', () => {
        process.env.CENCORI_OAUTH_SLACK_CLIENT_ID = 'env-slack';
        process.env.CENCORI_OAUTH_SLACK_CLIENT_SECRET = 'env-slack-secret';
        const base = oauthClientConfig('slack', {});
        expect(base.clientId).toBe('env-slack');

        const configured = oauthClientConfig('slack', { client_id: 'cfg', client_secret: 'cfg-secret' });
        expect(configured.clientId).toBe('cfg');

        const overridden = oauthClientConfig('slack', { client_id: 'cfg' }, { client_id: 'byo', client_secret: 'byo-secret' });
        expect(overridden.clientId).toBe('byo');
        expect(overridden.clientSecret).toBe('byo-secret');

        process.env.CENCORI_GMAIL_CLIENT_ID = 'legacy';
        process.env.CENCORI_GMAIL_CLIENT_SECRET = 'legacy-secret';
        const legacy = oauthClientConfig('generic-http', {});
        expect(legacy.clientId).toBe('legacy');
    });

    it('honors token_auth basic and slug dash normalization', () => {
        process.env.CENCORI_OAUTH_GOOGLE_CALENDAR_CLIENT_ID = 'cal';
        const cfg = oauthClientConfig('google_calendar', {});
        expect(cfg.clientId).toBe('cal');

        const notion = oauthClientConfig('notion', { token_auth: 'basic' });
        expect(notion.tokenAuth).toBe('basic');
    });
});

describe('resolveOauthEndpoints', () => {
    it('returns connector config endpoints without discovery', async () => {
        const endpoints = await resolveOauthEndpoints({
            slug: 'gmail',
            connectorConfig: { auth_url: 'https://accounts.example.com/auth', token_url: 'https://oauth.example.com/token' },
            discoveryUrl: 'https://should-not-be-fetched.example.com/.well-known/openid-configuration',
        });
        expect(endpoints).toEqual({ auth_url: 'https://accounts.example.com/auth', token_url: 'https://oauth.example.com/token', token_auth: 'form' });
    });

    it('resolves a discovery document and detects client_secret_basic', async () => {
        (globalThis as Record<string, unknown>).__outboundFetch = vi.fn(async () => jsonResponse({
            authorization_endpoint: 'https://idp.example.com/authorize',
            token_endpoint: 'https://idp.example.com/token',
            token_endpoint_auth_methods_supported: ['client_secret_basic'],
        }));
        const endpoints: OauthEndpoints = await resolveOauthEndpoints({ slug: 'generic-oidc', connectorConfig: {}, discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration' });
        expect(endpoints.auth_url).toBe('https://idp.example.com/authorize');
        expect(endpoints.token_auth).toBe('basic');
    });

    it('rejects documents without https endpoints', async () => {
        (globalThis as Record<string, unknown>).__outboundFetch = vi.fn(async () => jsonResponse({ authorization_endpoint: 'http://evil.com/a' }));
        await expect(resolveOauthEndpoints({ slug: 'generic-oidc', connectorConfig: {}, discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration' }))
            .rejects.toThrow(/authorization_endpoint/);
    });
});

describe('executeConnectorHttp', () => {
    it('relays GET with the decrypted key as Bearer and appends query params', async () => {
        const ref = encryptApiKey('sk-plain', 'org-1');
        (globalThis as Record<string, unknown>).__outboundFetch = vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
            expect(url).toBe('https://api.customer.example/v2/orders?limit=5');
            expect(init.headers.Authorization).toBe('Bearer sk-plain');
            return jsonResponse({ orders: [] });
        });
        const out = await executeConnectorHttp({} as never, {
            connection: { id: 'c1', encrypted_access_ref: ref, encrypted_refresh_ref: null, expires_at: null },
            organizationId: 'org-1',
            connectorConfig: { base_url: 'https://api.customer.example/' },
            input: { path: '/v2/orders', query: { limit: '5' } },
            executionKey: 'k1',
        });
        expect(out.status).toBe(200);
        expect(out.body).toEqual({ orders: [] });
    });

    it('rejects unsupported methods and missing paths', async () => {
        const base = {
            connection: { id: 'c1', encrypted_access_ref: encryptApiKey('k', 'org-1'), encrypted_refresh_ref: null, expires_at: null },
            organizationId: 'org-1',
            connectorConfig: { base_url: 'https://api.customer.example' },
            executionKey: 'k1',
        };
        await expect(executeConnectorHttp({} as never, { ...base, input: { method: 'TRACE' as 'GET', path: '/x' } })).rejects.toThrow('not supported');
        await expect(executeConnectorHttp({} as never, { ...base, input: { path: '' } })).rejects.toThrow('path is required');
    });
});
