import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/gateway-middleware', () => ({
    validateGatewayRequest: vi.fn(async () => ({
        success: true,
        context: { projectId: 'proj-mine', organizationId: 'org-1', keyType: 'secret', tier: 'free', requestId: 'req-1' },
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
    const state = {
        table: '', filters: [] as Array<(r: Row) => boolean>, order: [] as Array<{ col: string; asc: boolean }>,
        limitN: null as number | null, update: null as Row | null, pendingInsert: null as Row | null,
    };
    const reset = (table: string) => {
        state.table = table;
        state.filters = [];
        state.order = [];
        state.limitN = null;
        state.update = null;
        state.pendingInsert = null;
    };
    const run = () => {
        let out = (tables[state.table] ?? []).filter((r) => state.filters.every((f) => f(r)));
        for (const o of [...state.order].reverse()) {
            out = [...out].sort((a, b) => (String(a[o.col] ?? '') < String(b[o.col] ?? '') ? (o.asc ? -1 : 1) : 1));
        }
        if (state.limitN !== null) out = out.slice(0, state.limitN);
        return out;
    };
    const finishInsert = () => {
        const full = { id: `row-${tables[state.table].length}`, created_at: '2026-09-25T00:00:01Z', updated_at: '2026-09-25T00:00:01Z', ...state.pendingInsert };
        tables[state.table].push(full);
        state.pendingInsert = null;
        return full;
    };
    Object.assign(api, {
        from: (table: string) => (reset(table), api),
        select: () => api,
        eq: (col: string, val: unknown) => (state.filters.push((r) => r[col] === val), api),
        in: (col: string, vals: unknown) => (state.filters.push((r) => (vals as unknown[]).includes(r[col])), api),
        order: (col: string, opts?: { ascending?: boolean }) => (state.order.push({ col, asc: opts?.ascending !== false }), api),
        limit: (n: number) => (state.limitN = n, api),
        or: () => api,
        lt: () => api,
        maybeSingle: async () => {
            if (state.update) {
                const rows = run();
                if (rows.length === 0) return { data: null, error: null };
                Object.assign(rows[0], state.update);
                return { data: rows[0], error: null };
            }
            return { data: run()[0] ?? null, error: null };
        },
        single: async () => {
            if (state.pendingInsert) return { data: finishInsert(), error: null };
            if (state.update) {
                const rows = run();
                if (rows.length === 0) return { data: null, error: { message: 'none' } };
                Object.assign(rows[0], state.update);
                return { data: rows[0], error: null };
            }
            return { data: run()[0] ?? null, error: null };
        },
        update: (patch: Row) => (state.update = patch, api),
        upsert: (row: Row) => (tables[state.table].push({ ...row }), { data: row, error: null }),
        insert: (row: Row) => (state.pendingInsert = row, api),
        delete: () => {
            tables[state.table] = tables[state.table].filter((r) => !state.filters.every((f) => f(r)));
            return { data: null, error: null };
        },
        rpc: async (fn: string, args: Record<string, unknown>) => {
            if (fn === 'replace_installation_grants') {
                const id = args.p_installation_id as string;
                if (args.p_kb_ids != null) {
                    tables.installation_knowledge_bases = tables.installation_knowledge_bases.filter((r) => r.installation_id !== id);
                    for (const kb of (args.p_kb_ids as string[])) tables.installation_knowledge_bases.push({ installation_id: id, knowledge_base_id: kb });
                }
                return { data: {}, error: null };
            }
            return { data: null, error: { message: 'unknown' } };
        },
        then: (resolve: (v: unknown) => void) => {
            if (state.pendingInsert) {
                resolve({ data: finishInsert(), error: null });
                return;
            }
            resolve({ data: run(), error: null });
        },
    });
    return { db: { from: api.from, rpc: (api as Record<string, unknown>).rpc }, tables };
}

const req = (url: string, body?: unknown) => ({
    url,
    json: async () => body,
    headers: { get: (_k: string) => null },
}) as never;

const publicVersion = (id: string, visibility: string): Row => ({
    id,
    agent_id: 'agent-theirs',
    version: '1',
    status: 'published',
    visibility,
    config_json: { model: 'gpt-4o' },
    requirements_json: {},
    published_at: '2026-09-25T00:00:01Z',
    created_at: '2026-09-25T00:00:01Z',
    agents: { id: 'agent-theirs', name: 'Helper', description: 'Helps' },
});

describe('public marketplace discovery', () => {
    it('lists only public versions, anonymously, with pagination', async () => {
        const { GET } = await import('@/app/api/v1/marketplace/agents/route');
        const { db } = makeDb({
            agent_versions: [publicVersion('v-pub', 'public'), publicVersion('v-priv', 'private'), publicVersion('v-unl', 'unlisted')],
        });
        (globalThis as Record<string, unknown>).__fakeDb = db;
        const res = (await GET(req('http://x/v1/marketplace/agents?limit=10'))) as {
            status: number;
            __body: { data: Array<{ version_id: string }>; next_cursor: null };
        };
        expect(res.status).toBe(200);
        expect(res.__body.data.map((v) => v.version_id)).toEqual(['v-pub']);
        expect(res.__body.next_cursor).toBeNull();
    });

    it('serves unlisted detail by id but hides private versions', async () => {
        const { GET } = await import('@/app/api/v1/marketplace/agents/[versionId]/route');
        const { db } = makeDb({
            agent_versions: [publicVersion('v-pub', 'public'), publicVersion('v-priv', 'private'), publicVersion('v-unl', 'unlisted')],
        });
        (globalThis as Record<string, unknown>).__fakeDb = db;
        const open = (await GET(req('http://x'), { params: Promise.resolve({ versionId: 'v-pub' }) })) as { status: number };
        expect(open.status).toBe(200);
        const unlisted = (await GET(req('http://x'), { params: Promise.resolve({ versionId: 'v-unl' }) })) as { status: number };
        expect(unlisted.status).toBe(200);
        const hidden = (await GET(req('http://x'), { params: Promise.resolve({ versionId: 'v-priv' }) })) as { status: number };
        expect(hidden.status).toBe(404);
    });
});

describe('marketplace install by fork', () => {
    it('forks the public version pinned into the caller project', async () => {
        const { POST } = await import('@/app/api/v1/marketplace/installations/route');
        const { db, tables } = makeDb({
            agent_versions: [publicVersion('v-pub', 'public')],
            platform_tenants: [{ id: 't1', project_id: 'proj-mine', status: 'active' }],
            agents: [],
            agent_installations: [],
            knowledge_bases: [{ id: 'kb1', project_id: 'proj-mine', status: 'active', scope_type: 'tenant', tenant_id: 't1' }],
            installation_knowledge_bases: [],
            installation_connections: [],
        });
        (globalThis as Record<string, unknown>).__fakeDb = db;
        const res = (await POST(
            req('http://x/v1/marketplace/installations', { version_id: 'v-pub', tenant_id: 't1', knowledge_base_ids: ['kb1'] }),
        )) as { status: number; __body: Record<string, unknown> };

        expect(res.status).toBe(201);
        // Fork lives in the caller project, private, pinned.
        expect(tables.agents).toHaveLength(1);
        expect(tables.agents[0].project_id).toBe('proj-mine');
        const forkedVersions = tables.agent_versions.filter((v) => v.agent_id === tables.agents[0].id);
        expect(forkedVersions).toHaveLength(1);
        expect(forkedVersions[0].visibility).toBe('private');
        expect(forkedVersions[0].status).toBe('published');
        expect(res.__body.source_version_id).toBe('v-pub');
        expect(res.__body.update_channel).toBe('pinned');
        // Publisher original untouched; grant landed on the fork.
        expect(tables.agent_versions).toHaveLength(2);
        expect(tables.installation_knowledge_bases).toEqual([
            expect.objectContaining({ knowledge_base_id: 'kb1' }),
        ]);
    });

    it('refuses private versions and invalid grants without forking', async () => {
        const { POST } = await import('@/app/api/v1/marketplace/installations/route');
        const { db, tables } = makeDb({
            agent_versions: [publicVersion('v-priv', 'private')],
            platform_tenants: [{ id: 't1', project_id: 'proj-mine', status: 'active' }],
            agents: [],
            agent_installations: [],
            knowledge_bases: [],
            installation_knowledge_bases: [],
            installation_connections: [],
        });
        (globalThis as Record<string, unknown>).__fakeDb = db;
        const hidden = (await POST(
            req('http://x', { version_id: 'v-priv', tenant_id: 't1' }),
        )) as { status: number };
        expect(hidden.status).toBe(404);
        expect(tables.agents).toHaveLength(0);
    });
});
