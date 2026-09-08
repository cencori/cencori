/** @vitest-environment node */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { hashApiKey } from '@/lib/api-keys';

const mocks = vi.hoisted(() => ({
    key: { key_hash: '', project_id: 'project-1', client_app: 'porter' as string | null,
        key_type: 'publishable', revoked_at: null as string | null, allowed_domains: ['example.com'] },
    porter: { id: 'porter-1', project_id: 'project-1', organization_id: 'org-1',
        enabled: true, publishable_key: 'cpk_current', source_url: 'https://example.com' },
    member: true, user: true,
}));
vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => ({
    from: (table: string) => {
        const filters: Array<[string, unknown]> = [];
        const builder = {
            select: () => builder,
            eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
            is: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
            maybeSingle: async () => {
                const row: Record<string, unknown> | null = table === 'api_keys' ? mocks.key
                    : table === 'porters' ? mocks.porter
                    : mocks.member ? { organization_id: 'org-1', user_id: 'user-1' } : null;
                return { data: row && filters.every(([column, value]) => row[column] === value) ? row : null };
            },
        };
        return builder;
    },
}) }));
vi.mock('@/lib/supabaseServer', () => ({ createServerClient: async () => ({ auth: {
    getUser: async () => ({ data: { user: mocks.user ? { id: 'user-1' } : null } }),
} }) }));
vi.mock('@/lib/gateway-middleware', () => ({ handleCorsPreFlight: () => new NextResponse(null, { status: 204 }) }));
vi.mock('@/lib/porter/rate-limit', () => ({ checkPorterSessionLimit: async () => ({ allowed: true }) }));

import { POST as openSession } from '@/app/api/v1/porter/session/route';
import { GET as getConfig } from '@/app/api/v1/porter/config/route';
import { POST as previewSession } from '@/app/api/porter/[porterId]/preview-session/route';
import { readPorterSession } from '@/lib/porter/session';

const routes = [
    { name: 'session', handler: openSession, method: 'POST', path: '/api/v1/porter/session' },
    { name: 'config', handler: getConfig, method: 'GET', path: '/api/v1/porter/config?porter=porter-1' },
];
function request(route: typeof routes[number], origin: string | null = 'https://example.com', key = 'cpk_current') {
    return new NextRequest(`https://cencori.com${route.path}`, { method: route.method,
        headers: { Authorization: `Bearer ${key}`, ...(origin ? { Origin: origin } : {}) },
        ...(route.method === 'POST' ? { body: JSON.stringify({ porterId: 'porter-1' }) } : {}),
    });
}

beforeEach(() => {
    vi.stubEnv('PORTER_SESSION_SECRET', 'porter-test-signing-secret-at-least-32-characters');
    Object.assign(mocks.key, { key_hash: hashApiKey('cpk_current'), client_app: 'porter', revoked_at: null, allowed_domains: ['example.com'] });
    mocks.member = true;
    mocks.user = true;
});
afterEach(() => vi.unstubAllEnvs());

describe.each(routes)('Porter public $name authentication', route => {
    it('accepts the live scoped key from its allowed domain', async () => {
        expect((await route.handler(request(route))).status).toBe(200);
    });
    it.each([null, 'https://elsewhere.example'])('rejects missing or disallowed origin %s', async origin => {
        expect((await route.handler(request(route, origin))).status).toBe(403);
    });
    it('rejects revoked keys even if their rows remain', async () => {
        mocks.key.revoked_at = '2026-09-08T00:00:00Z';
        expect((await route.handler(request(route))).status).toBe(403);
    });
    it('rejects an ordinary sibling key on the same project', async () => {
        mocks.key.client_app = null;
        mocks.key.key_hash = hashApiKey('cpk_sibling');
        expect((await route.handler(request(route, 'https://example.com', 'cpk_sibling'))).status).toBe(403);
    });
    it('fails closed if the credential has not been migrated to Porter scope', async () => {
        mocks.key.client_app = null;
        expect((await route.handler(request(route))).status).toBe(403);
    });
});

describe('Porter preview authorization', () => {
    const params = { params: Promise.resolve({ porterId: 'porter-1' }) };
    it('issues a customer-scoped session for a member on the console origin', async () => {
        const response = await previewSession(request(routes[0], 'https://cencori.com'), params);
        expect(response.status).toBe(200);
        expect(readPorterSession((await response.json()).token)).toMatchObject({ p: 'porter-1', j: 'project-1', h: 'example.com' });
    });
    it('requires membership', async () => {
        mocks.member = false;
        expect((await previewSession(request(routes[0]), params)).status).toBe(403);
    });
    it('requires a signed-in user', async () => {
        mocks.user = false;
        expect((await previewSession(request(routes[0]), params)).status).toBe(401);
    });
});
