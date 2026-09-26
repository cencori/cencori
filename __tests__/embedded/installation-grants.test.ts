import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---- Mocks ---------------------------------------------------------------
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

// ---- In-memory Supabase fake ---------------------------------------------
type Row = Record<string, unknown>;

function makeDb(seed: Record<string, Row[]>) {
    const tables: Record<string, Row[]> = Object.fromEntries(
        Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]),
    );
    const api: Record<string, unknown> = {};
    const state = { table: '', filters: [] as Array<(r: Row) => boolean>, order: [] as Array<{ col: string; asc: boolean }>, limitN: null as number | null, selectCols: '', update: null as Row | null, upsertRow: null as Row | null, insertRow: null as Row | null, isDelete: false };
    const reset = (table: string) => {
        state.table = table;
        state.filters = [];
        state.order = [];
        state.limitN = null;
        state.update = null;
        state.upsertRow = null;
        state.insertRow = null;
        state.isDelete = false;
    };
    const applyFilters = (rows: Row[]) => {
        let out = rows.filter((r) => state.filters.every((f) => f(r)));
        for (const o of state.order) {
            out = [...out].sort((a, b) => (String(a[o.col] ?? '') < String(b[o.col] ?? '') ? (o.asc ? -1 : 1) : String(a[o.col] ?? '') > String(b[o.col] ?? '') ? (o.asc ? 1 : -1) : 0));
        }
        // Multi-key order stability: apply in reverse for correctness.
        return out;
    };
    // Re-sort with combined comparator (stable multi-key).
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
    void applyFilters;
    Object.assign(api, {
        from: (table: string) => (reset(table), api),
        select: () => api,
        eq: (col: string, val: unknown) => (state.filters.push((r) => r[col] === val), api),
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
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        single: async () => {
            if (state.update) {
                const rows = run();
                if (rows.length === 0) return { data: null, error: { message: 'none' } };
                Object.assign(rows[0], state.update);
                return { data: rows[0], error: null };
            }
            if (state.upsertRow) {
                tables[state.table].push({ ...state.upsertRow });
                return { data: state.upsertRow, error: null };
            }
            const rows = run();
            return { data: rows[0] ?? null, error: null };
        },
        update: (patch: Row) => (state.update = patch, api),
        upsert: (row: Row) => (state.upsertRow = row, api),
        insert: (row: Row) => (tables[state.table].push({ ...row }), { data: row, error: null }),
        delete: () => (state.isDelete = true, api),
        then: (resolve: (v: unknown) => void) => {
            if (state.isDelete) {
                tables[state.table] = tables[state.table].filter((r) => !state.filters.every((f) => f(r)));
                resolve({ data: null, error: null });
                return;
            }
            if (state.upsertRow) {
                const row = state.upsertRow as Row;
                const key = JSON.stringify([row.installation_id, row.knowledge_base_id ?? row.connection_id]);
                const exists = tables[state.table].some(
                    (r) => JSON.stringify([r.installation_id, r.knowledge_base_id ?? r.connection_id]) === key,
                );
                if (!exists) tables[state.table].push({ ...row });
                resolve({ data: row, error: null });
                return;
            }
            resolve({ data: run(), error: null });
        },
    });
    return { db: { from: api.from }, tables };
}

function req(url: string, body?: unknown) {
    return { url, json: async () => body } as never;
}

const insulated = (rows: Row[]) => rows;

// ---- Tests ----------------------------------------------------------------
describe('installation listing pagination', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('honors agent_id, limit, and keyset cursors without skipping', async () => {
        const { GET } = await import('@/app/api/v1/agent-installations/route');
        // 5 rows for agent-a (same timestamp on two rows exercises the tiebreaker), 2 for agent-b.
        const rows = [
            { id: 'i5', project_id: 'proj-1', tenant_id: 't1', agent_id: 'agent-a', status: 'active', created_at: '2026-09-25T00:00:05Z' },
            { id: 'i4', project_id: 'proj-1', tenant_id: 't1', agent_id: 'agent-a', status: 'active', created_at: '2026-09-25T00:00:04Z' },
            { id: 'i3', project_id: 'proj-1', tenant_id: 't1', agent_id: 'agent-a', status: 'active', created_at: '2026-09-25T00:00:04Z' },
            { id: 'i2', project_id: 'proj-1', tenant_id: 't1', agent_id: 'agent-a', status: 'active', created_at: '2026-09-25T00:00:03Z' },
            { id: 'i1', project_id: 'proj-1', tenant_id: 't1', agent_id: 'agent-a', status: 'active', created_at: '2026-09-25T00:00:02Z' },
            { id: 'j1', project_id: 'proj-1', tenant_id: 't1', agent_id: 'agent-b', status: 'active', created_at: '2026-09-25T00:00:09Z' },
            { id: 'j2', project_id: 'proj-1', tenant_id: 't1', agent_id: 'agent-b', status: 'active', created_at: '2026-09-25T00:00:01Z' },
        ];
        const { db } = makeDb({ agent_installations: insulated(rows), installation_knowledge_bases: [], installation_connections: [] });
        (globalThis as Record<string, unknown>).__fakeDb = db;

        const seen: string[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < 4; page++) {
            const params = new URLSearchParams({ agent_id: 'agent-a', limit: '2' });
            if (cursor) params.set('cursor', cursor);
            const res = (await GET(req(`http://x/v1/agent-installations?${params}`))) as { __body: { data: Array<{ id: string }>; next_cursor: string | null } };
            for (const r of res.__body.data) seen.push(r.id);
            cursor = res.__body.next_cursor;
            if (!cursor) break;
        }
        // All 5 agent-a rows exactly once (i4/i3 share a timestamp — the tiebreaker matters).
        expect(seen.sort()).toEqual(['ins_i1', 'ins_i2', 'ins_i3', 'ins_i4', 'ins_i5'].sort());
        expect(new Set(seen).size).toBe(5);
    });

    it('rejects invalid cursors', async () => {
        const { GET } = await import('@/app/api/v1/agent-installations/route');
        const { db } = makeDb({ agent_installations: [], installation_knowledge_bases: [], installation_connections: [] });
        (globalThis as Record<string, unknown>).__fakeDb = db;
        const res = (await GET(req('http://x/v1/agent-installations?cursor=!!!'))) as { status: number; __body: unknown };
        expect(res.status).toBe(400);
    });
});

describe('installation PATCH grants', () => {
    it('pins versions and replaces grants (empty clears = revocation proof)', async () => {
        const { PATCH } = await import('@/app/api/v1/agent-installations/[installationId]/route');
        const { db, tables } = makeDb({
            agent_installations: [{ id: 'ins1', project_id: 'proj-1', tenant_id: 't1', agent_id: 'agent-a', agent_version_id: 'v1', status: 'active' }],
            agent_versions: [
                { id: 'v1', agent_id: 'agent-a', version: '1', status: 'published' },
                { id: 'v2', agent_id: 'agent-a', version: '2', status: 'published' },
                { id: 'vd', agent_id: 'agent-a', version: 'draft', status: 'draft' },
            ],
            installation_connections: [{ installation_id: 'ins1', connection_id: 'old-conn' }],
            installation_knowledge_bases: [{ installation_id: 'ins1', knowledge_base_id: 'old-kb' }],
        });
        (globalThis as Record<string, unknown>).__fakeDb = db;

        const res = (await PATCH(
            req('http://x/v1/agent-installations/ins_ins1', { version: '2', connection_ids: [], knowledge_base_ids: ['kb_new'] }),
            { params: Promise.resolve({ installationId: 'ins_ins1' }) },
        )) as { status: number; __body: Record<string, unknown> };

        expect(res.status).toBe(200);
        expect(res.__body.agent_version_id).toBe('v2');
        // Revoked: old joins gone; kb stored de-prefixed exactly like POST,
        // conns stored raw exactly like POST; response echoes stored grants.
        expect(tables.installation_connections).toEqual([]);
        expect(tables.installation_knowledge_bases).toEqual([{ installation_id: 'ins1', knowledge_base_id: 'new' }]);
        expect(res.__body.connection_ids).toEqual([]);
        expect(res.__body.knowledge_base_ids).toEqual(['new']);
    });

    it('rejects unpublished and unknown versions', async () => {
        const { PATCH } = await import('@/app/api/v1/agent-installations/[installationId]/route');
        const { db } = makeDb({
            agent_installations: [{ id: 'ins1', project_id: 'proj-1', tenant_id: 't1', agent_id: 'agent-a', agent_version_id: 'v1', status: 'active' }],
            agent_versions: [{ id: 'vd', agent_id: 'agent-a', version: 'draft', status: 'draft' }],
            installation_connections: [],
            installation_knowledge_bases: [],
        });
        (globalThis as Record<string, unknown>).__fakeDb = db;

        const draft = (await PATCH(
            req('http://x', { version: 'draft' }),
            { params: Promise.resolve({ installationId: 'ins1' }) },
        )) as { status: number };
        expect(draft.status).toBe(409);

        const missing = (await PATCH(
            req('http://x', { version: 'nope' }),
            { params: Promise.resolve({ installationId: 'ins1' }) },
        )) as { status: number };
        expect(missing.status).toBe(404);
    });

    it('rejects empty patches and non-array grants', async () => {
        const { PATCH } = await import('@/app/api/v1/agent-installations/[installationId]/route');
        const { db } = makeDb({
            agent_installations: [{ id: 'ins1', project_id: 'proj-1', tenant_id: 't1', agent_id: 'agent-a', agent_version_id: 'v1', status: 'active' }],
            agent_versions: [],
            installation_connections: [],
            installation_knowledge_bases: [],
        });
        (globalThis as Record<string, unknown>).__fakeDb = db;

        const empty = (await PATCH(req('http://x', {}), { params: Promise.resolve({ installationId: 'ins1' }) })) as { status: number };
        expect(empty.status).toBe(400);
        const bad = (await PATCH(req('http://x', { connection_ids: 'x' }), { params: Promise.resolve({ installationId: 'ins1' }) })) as { status: number };
        expect(bad.status).toBe(400);
    });
});
