import { describe, expect, it, vi } from 'vitest';
import { checkAgentActivity, executionVersionInputs } from '@/lib/embedded/agents';
import { abortRun, isRunAborted, registerRunController, unregisterRunController } from '@/lib/embedded/run-abort';
import { encodeRunRequest } from '@/lib/embedded/run-request';

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

function fakeDb(tables: Record<string, Array<Record<string, unknown>>>) {
    const state = { table: '', filters: [] as Array<(r: Record<string, unknown>) => boolean> };
    const api: Record<string, unknown> = {};
    Object.assign(api, {
        from: (table: string) => (state.table = table, state.filters = [], api),
        select: () => api,
        eq: (col: string, val: unknown) => (state.filters.push((r) => r[col] === val), api),
        order: () => api,
        limit: () => api,
        maybeSingle: async () => ({
            data: tables[state.table].find((r) => state.filters.every((f) => f(r))) ?? null,
            error: null,
        }),
    });
    return { from: api.from };
}

describe('executionVersionInputs', () => {
    it('prefers the submission pin over live installation state', () => {
        expect(
            executionVersionInputs(
                { agent_version_id: 'v-submitted' },
                { agent_version_id: 'v-upgraded', update_channel: 'pinned' },
            ),
        ).toEqual({ runVersionId: 'v-submitted', installationVersionId: 'v-submitted', updateChannel: null });
    });

    it('falls back to live resolution for rows without a pin', () => {
        expect(
            executionVersionInputs(
                { agent_version_id: null },
                { agent_version_id: 'v-live', update_channel: 'stable' },
            ),
        ).toEqual({ runVersionId: null, installationVersionId: 'v-live', updateChannel: 'stable' });
    });

    it('handles unbound runs with no installation', () => {
        expect(executionVersionInputs({ agent_version_id: null }, null)).toEqual({
            runVersionId: null,
            installationVersionId: null,
            updateChannel: null,
        });
    });
});

describe('run admission', () => {
    it('refuses new runs for disabled agents', async () => {
        const { POST } = await import('@/app/api/v1/agents/[agentId]/runs/route');
        (globalThis as Record<string, unknown>).__fakeDb = fakeDb({
            agents: [{ id: 'agent-1', project_id: 'proj-1', is_active: false }],
        });
        const res = (await POST(
            { url: 'http://x/v1/agents/agent-1/runs', json: async () => ({ input: { task: 'hi' } }) } as never,
            { params: Promise.resolve({ agentId: 'agent-1' }) },
        )) as { status: number; __body: { error: { code: string } } };
        expect(res.status).toBe(403);
        expect(res.__body.error.code).toBe('agent_disabled');
    });
});

describe('checkAgentActivity', () => {
    const activityDb = (rows: Array<Record<string, unknown>>) => ({
        from: () => ({
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows[0] ?? null, error: null }) }) }) }),
        }),
    });
    const throwingDb = () => ({
        from: () => { throw new Error('db down'); },
    });

    it('blocks explicitly disabled agents', async () => {
        await expect(checkAgentActivity(activityDb([{ is_active: false }]) as never, 'p', 'a')).resolves.toEqual({ active: false, found: true });
    });

    it('allows active and unset flags', async () => {
        await expect(checkAgentActivity(activityDb([{ is_active: true }]) as never, 'p', 'a')).resolves.toEqual({ active: true, found: true });
        await expect(checkAgentActivity(activityDb([{}]) as never, 'p', 'a')).resolves.toEqual({ active: true, found: true });
    });

    it('fails open on lookup errors so admission never wedges', async () => {
        await expect(checkAgentActivity(throwingDb() as never, 'p', 'a')).resolves.toEqual({ active: true, found: false });
    });
});

describe('run abort registry', () => {
    it('aborts registered controllers once and cleans up', () => {
        const c = new AbortController();
        registerRunController('run-1', c);
        expect(isRunAborted('run-1')).toBe(false);
        expect(abortRun('run-1')).toBe(true);
        expect(c.signal.aborted).toBe(true);
        expect(isRunAborted('run-1')).toBe(true);
        expect(abortRun('run-1')).toBe(false);
        expect(abortRun('missing')).toBe(false);
        unregisterRunController('run-1');
        expect(isRunAborted('run-1')).toBe(false);
    });
});

describe('run cancellation', () => {    it('marks cancelled and aborts the in-flight controller', async () => {
        const { POST } = await import('@/app/api/v1/runs/[runId]/cancel/route');
        const tables: Record<string, Array<Record<string, unknown>>> = {
            embedded_runs: [{ id: 'r1', project_id: 'proj-1', status: 'running' }],
            embedded_run_events: [],
        };
        const api: Record<string, unknown> = {};
        const state = { table: '', filters: [] as Array<(r: Record<string, unknown>) => boolean>, update: null as Record<string, unknown> | null };
        Object.assign(api, {
            from: (table: string) => (state.table = table, state.filters = [], state.update = null, api),
            select: () => api,
            eq: (col: string, val: unknown) => (state.filters.push((r) => r[col] === val), api),
            in: (col: string, vals: unknown) => (state.filters.push((r) => (vals as unknown[]).includes(r[col])), api),
            not: (col: string, op: string, val: unknown) => {
                if (op === 'in' && typeof val === 'string') {
                    const list = val.replace(/[()]/g, '').split(',');
                    state.filters.push((r) => !list.includes(String(r[col])));
                }
                return api;
            },
            update: (patch: Record<string, unknown>) => (state.update = patch, api),
            insert: (row: Record<string, unknown>) => (tables[state.table].push({ ...row }), { data: row, error: null }),
            maybeSingle: async () => {
                const rows = tables[state.table].filter((r) => state.filters.every((f) => f(r)));
                if (state.update && rows[0]) Object.assign(rows[0], state.update);
                return { data: rows[0] ?? null, error: null };
            },
        });
        (globalThis as Record<string, unknown>).__fakeDb = { from: api.from };
        const controller = new AbortController();
        registerRunController('r1', controller);
        const res = (await POST(
            { url: 'http://x/v1/runs/r1/cancel', json: async () => ({}) } as never,
            { params: Promise.resolve({ runId: 'r1' }) },
        )) as { status: number; __body: { status: string } };
        expect(res.status).toBe(200);
        expect(res.__body.status).toBe('cancelled');
        expect(controller.signal.aborted).toBe(true);
        expect(tables.embedded_runs[0].status).toBe('cancelled');
        unregisterRunController('r1');
    });
});

describe('run history', () => {
    const historyDb = (runs: Array<Record<string, unknown>>) => {
        const tables: Record<string, Array<Record<string, unknown>>> = {
            agents: [{ id: 'agent-1', project_id: 'proj-1', is_active: true }],
            embedded_runs: runs,
        };
        const api: Record<string, unknown> = {};
        const state = { table: '', filters: [] as Array<(r: Record<string, unknown>) => boolean>, order: [] as Array<{ col: string; asc: boolean }>, limitN: null as number | null };
        const run = () => {
            let out = tables[state.table].filter((r) => state.filters.every((f) => f(r)));
            for (const o of [...state.order].reverse()) {
                out = [...out].sort((a, b) => (String(a[o.col] ?? '') < String(b[o.col] ?? '') ? (o.asc ? -1 : 1) : 1));
            }
            if (state.limitN !== null) out = out.slice(0, state.limitN);
            return out;
        };
        Object.assign(api, {
            from: (table: string) => (state.table = table, state.filters = [], state.order = [], state.limitN = null, api),
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
            then: (resolve: (v: unknown) => void) => resolve({ data: run(), error: null }),
        });
        return { from: api.from };
    };

    const historyRow = (id: string, createdAt: string, status: string): Record<string, unknown> => ({
        id,
        project_id: 'proj-1',
        agent_id: 'agent-1',
        agent_version_id: 'v1',
        installation_id: null,
        tenant_id: null,
        external_user_id: null,
        session_id: null,
        status,
        input_ref: encodeRunRequest({ task: id }, undefined, 'background'),
        output_ref: null,
        error: null,
        started_at: createdAt,
        completed_at: null,
        created_at: createdAt,
        updated_at: createdAt,
    });

    it('lists queued, cancelled, and failed runs with keyset pagination', async () => {
        const { GET } = await import('@/app/api/v1/agents/[agentId]/runs/route');
        (globalThis as Record<string, unknown>).__fakeDb = historyDb([
            historyRow('r5', '2026-09-25T00:00:05Z', 'completed'),
            historyRow('r4', '2026-09-25T00:00:04Z', 'cancelled'),
            historyRow('r3', '2026-09-25T00:00:04Z', 'failed'),
            historyRow('r2', '2026-09-25T00:00:03Z', 'queued'),
            historyRow('r1', '2026-09-25T00:00:02Z', 'completed'),
        ]);

        const seen: string[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < 4; page++) {
            const params = new URLSearchParams({ limit: '2' });
            if (cursor) params.set('cursor', cursor);
            const res = (await GET(
                { url: `http://x/v1/agents/agent-1/runs?${params}` } as never,
                { params: Promise.resolve({ agentId: 'agent-1' }) },
            )) as { status: number; __body: { data: Array<{ id: string; status: string }>; next_cursor: string | null } };
            expect(res.status).toBe(200);
            for (const r of res.__body.data) seen.push(r.id);
            cursor = res.__body.next_cursor;
            if (!cursor) break;
        }
        // Prefixed ids, every status represented, nothing skipped or repeated.
        expect(seen.sort()).toEqual(['run_r1', 'run_r2', 'run_r3', 'run_r4', 'run_r5'].sort());
        expect(new Set(seen).size).toBe(5);
    });

    it('rejects other-project agents and invalid cursors', async () => {
        const { GET } = await import('@/app/api/v1/agents/[agentId]/runs/route');
        (globalThis as Record<string, unknown>).__fakeDb = historyDb([]);
        const missing = (await GET(
            { url: 'http://x/v1/agents/nope/runs' } as never,
            { params: Promise.resolve({ agentId: 'nope' }) },
        )) as { status: number };
        expect(missing.status).toBe(404);
        const bad = (await GET(
            { url: 'http://x/v1/agents/agent-1/runs?cursor=!!!' } as never,
            { params: Promise.resolve({ agentId: 'agent-1' }) },
        )) as { status: number };
        expect(bad.status).toBe(400);
    });
});
