import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/gateway-middleware', () => ({
    validateGatewayRequest: vi.fn(async () => ({
        success: true,
        context: { projectId: 'proj-1', organizationId: 'org-1', keyType: 'secret', tier: 'free', requestId: 'req-1' },
    })),
    addGatewayHeaders: (r: unknown) => r,
    handleCorsPreFlight: () => ({}),
}));

vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => (globalThis as Record<string, unknown>).__fakeDb }));

vi.mock('next/server', () => ({
    NextRequest: class {},
    NextResponse: {
        json: (body: unknown, init?: { status?: number }) => ({ __body: body, status: init?.status ?? 200 }),
    },
}));

type Row = Record<string, unknown>;

function makeDb(seed: Record<string, Row[]>) {
    const tables: Record<string, Row[]> = Object.fromEntries(
        Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]),
    );
    const api: Record<string, unknown> = {};
    const state = { table: '', filters: [] as Array<(r: Row) => boolean>, order: [] as Array<{ col: string; asc: boolean }>, limitN: null as number | null };
    const reset = (table: string) => {
        state.table = table;
        state.filters = [];
        state.order = [];
        state.limitN = null;
    };
    const run = () => {
        let out = tables[state.table].filter((r) => state.filters.every((f) => f(r)));
        if (state.order.length > 0) {
            out = [...out].sort((a, b) => {
                for (const o of state.order) {
                    const av = String(a[o.col] ?? '');
                    const bv = String(b[o.col] ?? '');
                    if (av !== bv) return av < bv ? (o.asc ? -1 : 1) : 1;
                }
                return 0;
            });
        }
        if (state.limitN !== null) out = out.slice(0, state.limitN);
        return out;
    };
    Object.assign(api, {
        from: (table: string) => (reset(table), api),
        select: () => api,
        eq: (col: string, val: unknown) => (state.filters.push((r) => r[col] === val), api),
        gte: (col: string, val: unknown) => (state.filters.push((r) => String(r[col] ?? '') >= String(val)), api),
        lte: (col: string, val: unknown) => (state.filters.push((r) => String(r[col] ?? '') <= String(val)), api),
        lt: (col: string, val: unknown) => (state.filters.push((r) => String(r[col] ?? '') < String(val)), api),
        or: (expr: string) => {
            const m = expr.match(/^created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([^)]+)\)$/);
            if (m) {
                const [, ltC, eqC, ltId] = m;
                state.filters.push((r) => String(r.created_at) < ltC || (String(r.created_at) === eqC && String(r.id) < ltId));
            }
            return api;
        },
        order: (col: string, opts?: { ascending?: boolean }) => (state.order.push({ col, asc: opts?.ascending !== false }), api),
        limit: (n: number) => (state.limitN = n, api),
        then: (resolve: (v: unknown) => void) => resolve({ data: run(), error: null }),
    });
    return { from: api.from, tables };
}

const req = (url: string) => ({ url, json: async () => ({}) }) as never;

const usageRow = (id: string, createdAt: string, extra: Row = {}): Row => ({
    id,
    model: 'gpt-1',
    provider: 'openai',
    status: 'success',
    total_tokens: 10,
    cost_usd: 0.01,
    cencori_charge_usd: 0.01,
    tenant_id: 't1',
    agent_id: 'a1',
    installation_id: 'i1',
    session_id: null,
    run_id: null,
    end_user_id: null,
    created_at: createdAt,
    project_id: 'proj-1',
    prompt_tokens: 5,
    completion_tokens: 5,
    provider_cost_usd: 0.008,
    ...extra,
});

describe('usage events pagination', () => {
    it('pages the full set exactly once across an equal-timestamp boundary', async () => {
        const { GET } = await import('@/app/api/v1/usage/events/route');
        const { from } = makeDb({
            ai_requests: [
                usageRow('e5', '2026-09-25T00:00:05Z'),
                usageRow('e4', '2026-09-25T00:00:04Z'),
                usageRow('e3', '2026-09-25T00:00:04Z'),
                usageRow('e2', '2026-09-25T00:00:03Z'),
                usageRow('e1', '2026-09-25T00:00:02Z'),
            ],
        });
        (globalThis as Record<string, unknown>).__fakeDb = { from };

        const seen: string[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < 4; page++) {
            const params = new URLSearchParams({ limit: '2', since: '2026-09-01T00:00:00Z', until: '2026-10-01T00:00:00Z' });
            if (cursor) params.set('cursor', cursor);
            const res = (await GET(req(`http://x/v1/usage/events?${params}`))) as {
                status: number;
                __body: { data: Array<{ id: string }>; next_cursor: string | null };
            };
            expect(res.status).toBe(200);
            for (const r of res.__body.data) seen.push(r.id);
            cursor = res.__body.next_cursor;
            if (!cursor) break;
        }
        expect(seen.sort()).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
    });

    it('honors installation_id and model filters', async () => {
        const { GET } = await import('@/app/api/v1/usage/events/route');
        const { from } = makeDb({
            ai_requests: [
                usageRow('e1', '2026-09-25T00:00:02Z', { installation_id: 'i1', model: 'gpt-1' }),
                usageRow('e2', '2026-09-25T00:00:03Z', { installation_id: 'i2', model: 'gpt-1' }),
                usageRow('e3', '2026-09-25T00:00:04Z', { installation_id: 'i1', model: 'other' }),
            ],
        });
        (globalThis as Record<string, unknown>).__fakeDb = { from };
        const res = (await GET(
            req('http://x/v1/usage/events?since=2026-09-01T00:00:00Z&until=2026-10-01T00:00:00Z&installation_id=i1&model=gpt-1'),
        )) as { __body: { data: Array<{ id: string }> } };
        expect(res.__body.data.map((r) => r.id)).toEqual(['e1']);
    });

    it('rejects invalid cursors', async () => {
        const { GET } = await import('@/app/api/v1/usage/events/route');
        const { from } = makeDb({ ai_requests: [] });
        (globalThis as Record<string, unknown>).__fakeDb = { from };
        const res = (await GET(req('http://x/v1/usage/events?cursor=!!!'))) as { status: number };
        expect(res.status).toBe(400);
    });
});

describe('usage summary truncation', () => {
    it('marks totals partial at the row cap instead of silently capping', async () => {
        const { GET } = await import('@/app/api/v1/usage/route');
        const rows: Row[] = [];
        for (let i = 0; i < 10005; i++) {
            rows.push(usageRow(`e${i}`, '2026-09-25T00:00:02Z'));
        }
        const { from } = makeDb({ ai_requests: rows });
        (globalThis as Record<string, unknown>).__fakeDb = { from };
        const res = (await GET(req('http://x/v1/usage?since=2026-09-01T00:00:00Z&until=2026-10-01T00:00:00Z'))) as {
            __body: { totals: { requests: number }; truncated: boolean; row_cap: number };
        };
        expect(res.__body.truncated).toBe(true);
        expect(res.__body.row_cap).toBe(10000);
        expect(res.__body.totals.requests).toBe(10000);
    });

    it('reports complete small scans as untruncated', async () => {
        const { GET } = await import('@/app/api/v1/usage/route');
        const { from } = makeDb({ ai_requests: [usageRow('e1', '2026-09-25T00:00:02Z')] });
        (globalThis as Record<string, unknown>).__fakeDb = { from };
        const res = (await GET(req('http://x/v1/usage?since=2026-09-01T00:00:00Z&until=2026-10-01T00:00:00Z'))) as {
            __body: { totals: { requests: number }; truncated: boolean };
        };
        expect(res.__body.truncated).toBe(false);
        expect(res.__body.totals.requests).toBe(1);
    });
});
