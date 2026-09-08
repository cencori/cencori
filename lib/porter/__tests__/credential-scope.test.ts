/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
    from: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    checkQuota: vi.fn(),
    keyScope: null as string | null,
}));

vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock('@/lib/gateway-middleware', () => ({
    addGatewayHeaders: (response: NextResponse) => response,
    handleCorsPreFlight: () => new NextResponse(null, { status: 204 }),
}));
vi.mock('@/lib/api-gateway-logs', () => ({
    extractGatewayCallerIdentity: () => ({}),
    logApiGatewayRequest: vi.fn(),
}));
vi.mock('@/lib/providers/config', () => ({ SUPPORTED_PROVIDERS: [] }));
vi.mock('@/lib/providers/branding', () => ({ publicProviderLabel: vi.fn() }));
vi.mock('@/lib/gateway/providers-setup', () => ({ getManagedProviderNames: () => new Set() }));
vi.mock('@/lib/providers/pricing', () => ({ hasStaticPricing: () => false }));
vi.mock('@/lib/gateway/model-access', () => ({ resolveApiKeyModelAccess: () => ({ allowed: true }) }));
vi.mock('@/lib/supabase-paginate', () => ({ fetchAllRows: async () => [] }));
vi.mock('@/lib/end-user-billing', () => ({ checkEndUserQuota: mocks.checkQuota }));

import { GET as models } from '@/app/api/v1/models/route';
import { GET as metrics } from '@/app/api/v1/metrics/route';
import { POST as telemetry } from '@/app/api/v1/telemetry/web/route';
import { GET as quotaGet, POST as quotaPost } from '@/app/api/v1/billing/check-quota/route';
import { GET as poll } from '@/app/api/v1/agent/actions/poll/route';
import { GET as setupGet, POST as setupPost } from '@/app/api/agent/setup/validate/route';

const routes = [
    { name: 'model catalog', handler: models, method: 'GET', path: '/api/v1/models' },
    { name: 'project metrics', handler: metrics, method: 'GET', path: '/api/v1/metrics' },
    { name: 'web telemetry', handler: telemetry, method: 'POST', path: '/api/v1/telemetry/web' },
    { name: 'quota GET', handler: quotaGet, method: 'GET', path: '/api/v1/billing/check-quota?end_user_id=visitor' },
    { name: 'quota POST', handler: quotaPost, method: 'POST', path: '/api/v1/billing/check-quota' },
    { name: 'action polling', handler: poll, method: 'GET', path: '/api/v1/agent/actions/poll?ids=action-1' },
    { name: 'agent setup GET', handler: setupGet, method: 'GET', path: '/api/agent/setup/validate' },
    { name: 'agent setup POST', handler: setupPost, method: 'POST', path: '/api/agent/setup/validate' },
];

function request(route: typeof routes[number]) {
    return new NextRequest(`https://cencori.com${route.path}`, {
        method: route.method,
        headers: { Authorization: 'Bearer cpk_example', 'Content-Type': 'application/json' },
        ...(route.method === 'POST' ? {
            body: JSON.stringify({
                agent_name: 'Example agent', project_id: 'project-1',
                host: 'example.com', path: '/', end_user_id: 'visitor',
            }),
        } : {}),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.keyScope = null;
    mocks.checkQuota.mockResolvedValue({ allowed: true });
    mocks.from.mockImplementation((table: string) => {
        let columns = '';
        const project = {
            id: 'project-1', name: 'Example', slug: 'example', organization_id: 'org-1',
            end_user_billing_enabled: true,
            organizations: { id: 'org-1', name: 'Example', slug: 'example', owner_id: 'owner-1' },
        };
        const key = {
            id: 'key-1', project_id: project.id, environment: 'production', key_type: 'publishable',
            client_app: mocks.keyScope, agent_id: null, revoked_at: null, projects: project,
        };
        const rows = table === 'agent_actions' ? [{
            id: 'action-1', status: 'pending', payload: {}, approved_at: null,
            agents: { project_id: project.id, projects: project },
        }] : [];
        const builder = {
            select: vi.fn((value: string) => { columns = value; return builder; }),
            eq: vi.fn(() => builder),
            is: vi.fn(() => builder),
            in: vi.fn(() => builder),
            order: vi.fn(() => builder),
            insert: vi.fn((value: unknown) => { mocks.insert(table, value); return builder; }),
            update: vi.fn((value: unknown) => { mocks.update(table, value); return builder; }),
            single: vi.fn(async () => ({
                // Honor the projection so forgetting client_app in a real query fails the test.
                data: table === 'api_keys'
                    ? Object.fromEntries(Object.entries(key).filter(([field]) => columns.includes(field)))
                    : { id: 'agent-1', name: 'Example agent' },
                error: null,
            })),
            then: (resolve: (result: { data: typeof rows; error: null }) => unknown) =>
                Promise.resolve({ data: rows, error: null }).then(resolve),
        };
        return builder;
    });
});

describe('Porter keys at standalone API authenticators', () => {
    it.each(routes)('rejects $name before reading project data or mutating it', async route => {
        mocks.keyScope = 'porter';

        const response = await route.handler(request(route));
        const payload = await response.json();

        expect(response.status).toBe(403);
        expect(payload.code ?? payload.error?.code).toBe('porter_key_scope');
        expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(['api_keys']);
        expect(mocks.insert).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.checkQuota).not.toHaveBeenCalled();
    });

    describe.each([null, 'basecode'])('preserves existing client_app=%s authentication', scope => {
        it.each(routes)('allows $name to complete', async route => {
            mocks.keyScope = scope;
            const response = await route.handler(request(route));
            expect(response.status).toBe(200);
        });
    });
});
