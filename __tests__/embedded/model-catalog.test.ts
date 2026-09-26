import { describe, expect, it, vi } from 'vitest';
import { buildUnifiedModelRegistry } from '@/lib/embedded/model-registry';

vi.mock('@/lib/gateway-middleware', () => ({
    validateGatewayRequest: vi.fn(async () => ({
        success: true,
        context: { projectId: 'proj-1', organizationId: 'org-1', keyType: 'secret', tier: 'free', requestId: 'req-1' },
    })),
    addGatewayHeaders: (r: unknown) => r,
    handleCorsPreFlight: () => ({}),
}));

vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => (globalThis as Record<string, unknown>).__fakeDb }));

vi.mock('@/lib/gateway-middleware', () => ({
    addGatewayHeaders: (r: unknown) => r,
    handleCorsPreFlight: () => ({}),
}));

vi.mock('@/lib/api-keys', () => ({ extractCencoriApiKeyFromHeaders: () => 'test-key' }));

vi.mock('@/lib/api-gateway-logs', () => ({
    extractGatewayCallerIdentity: () => ({}),
    logApiGatewayRequest: vi.fn(async () => undefined),
}));

vi.mock('next/server', () => ({
    NextRequest: class {},
    NextResponse: {
        json: (body: unknown, init?: { status?: number }) => ({ __body: body, status: init?.status ?? 200 }),
    },
}));

type Row = Record<string, unknown>;

// errors: table -> message forces that source query to fail.
function makeDb(tables: Record<string, Row[]>, errors: Record<string, string> = {}) {
    const api: Record<string, unknown> = {};
    const state = { table: '', filters: [] as Array<(r: Row) => boolean>, limitN: null as number | null };
    const run = () => {
        if (errors[state.table]) return { data: null as unknown, error: { message: errors[state.table] } };
        let out = (tables[state.table] ?? []).filter((r) => state.filters.every((f) => f(r)));
        if (state.limitN !== null) out = out.slice(0, state.limitN);
        return { data: out, error: null };
    };
    Object.assign(api, {
        from: (table: string) => (state.table = table, state.filters = [], state.limitN = null, api),
        select: () => api,
        eq: (col: string, val: unknown) => (state.filters.push((r) => r[col] === val), api),
        is: (col: string, val: unknown) => (state.filters.push((r) => (r[col] ?? null) === val), api),
        order: () => api,
        limit: (n: number) => (state.limitN = n, api),
        single: async () => {
            if (state.table === 'api_keys') {
                const key = tables.api_keys[0];
                return key ? { data: key, error: null } : { data: null, error: { message: 'none' } };
            }
            const rows = run();
            if (rows.error) return { data: null, error: rows.error };
            return { data: (rows.data as Row[])[0] ?? null, error: null };
        },
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve(run()),
    });
    return { from: api.from };
}

const req = (url: string, headers?: Record<string, string>) => ({
    url,
    headers: { get: (k: string) => (headers ?? {})[k.toLowerCase()] ?? null },
}) as never;

describe('unified model registry', () => {
    it('deduplicates cross-source model IDs keeping the managed row', async () => {
        const { from } = makeDb({
            provider_keys: [],
            provider_connections: [],
            custom_providers: [
                {
                    id: 'cp1',
                    name: 'Proxy',
                    created_at: '2026-09-25T00:00:01Z',
                    custom_models: [{ model_name: 'gpt-4o', display_name: null, is_active: true, created_at: '2026-09-25T00:00:01Z' }],
                },
            ],
            model_pricing: [],
        });
        const registry = await buildUnifiedModelRegistry({ from } as never, { projectId: 'proj-1', query: {} });
        const gpt4o = registry.models.filter((m) => m.id === 'gpt-4o' && !m.connection_id);
        expect(gpt4o).toHaveLength(1);
        expect(gpt4o[0].source).toBe('cencori');
        const ids = registry.models.map((m) => `${m.id}${m.connection_id ?? ''}`);
        expect(new Set(ids).size).toBe(ids.length);
        expect(registry.partial).toBe(false);
    });

    it('flags partial when a source query fails instead of silently dropping it', async () => {
        const { from } = makeDb(
            { provider_keys: [], provider_connections: [], custom_providers: [], model_pricing: [] },
            { model_pricing: 'boom' },
        );
        const registry = await buildUnifiedModelRegistry({ from } as never, { projectId: 'proj-1', query: {} });
        expect(registry.partial).toBe(true);
    });
});

describe('models endpoint pagination', () => {
    it('pages with total and next_cursor, honoring limit', async () => {
        const crypto = await import('crypto');
        const keyHash = crypto.createHash('sha256').update('test-key').digest('hex');
        const { GET } = await import('@/app/api/v1/models/route');
        const { from } = makeDb({
            api_keys: [{ id: 'k1', project_id: 'proj-1', environment: 'live', allowed_models: null, sponsored_models: null, key_hash: keyHash }],
            provider_keys: [],
            provider_connections: [],
            custom_providers: [],
            model_pricing: [],
        });
        (globalThis as Record<string, unknown>).__fakeDb = { from };

        const first = (await GET(req('http://x/v1/models?limit=2'))) as {
            status: number;
            __body: { object: string; data: Array<{ id: string }>; total: number; next_cursor: string | null; partial: boolean };
        };
        expect(first.status).toBe(200);
        expect(first.__body.object).toBe('list');
        expect(first.__body.data).toHaveLength(2);
        expect(first.__body.total).toBeGreaterThan(2);
        expect(first.__body.next_cursor).toBeTruthy();
        expect(first.__body.partial).toBe(false);

        const second = (await GET(req(`http://x/v1/models?limit=2&cursor=${encodeURIComponent(first.__body.next_cursor as string)}`))) as {
            __body: { data: Array<{ id: string }>; total: number; next_cursor: string | null };
        };
        expect(second.__body.total).toBe(first.__body.total);
        expect(second.__body.data).toHaveLength(2);
        const ids = [...first.__body.data, ...second.__body.data].map((m) => m.id);
        expect(new Set(ids).size).toBe(4);
    });

    it('rejects invalid cursors', async () => {
        const crypto = await import('crypto');
        const keyHash = crypto.createHash('sha256').update('test-key').digest('hex');
        const { GET } = await import('@/app/api/v1/models/route');
        const { from } = makeDb({
            api_keys: [{ id: 'k1', project_id: 'proj-1', environment: 'live', allowed_models: null, sponsored_models: null, key_hash: keyHash }],
            provider_keys: [],
            provider_connections: [],
            custom_providers: [],
            model_pricing: [],
        });
        (globalThis as Record<string, unknown>).__fakeDb = { from };
        const res = (await GET(req('http://x/v1/models?cursor=!!!'))) as { status: number };
        expect(res.status).toBe(400);
    });
});
