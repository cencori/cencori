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
    NextResponse: class {
        status: number;
        headers: Headers;
        body: unknown;
        __body?: unknown;
        static json(body: unknown, init?: { status?: number }) {
            const res = new (this as unknown as new () => {
                status: number;
                __body?: unknown;
            })();
            res.__body = body;
            res.status = init?.status ?? 200;
            return res;
        }
        constructor(body?: unknown, init?: { status?: number; headers?: Record<string, string> }) {
            this.body = body;
            this.status = init?.status ?? 200;
            this.headers = new Headers(init?.headers);
        }
    },
}));

vi.mock('@/lib/gateway/chat-executor', () => ({
    executeGatewayChat: (...args: unknown[]) => (globalThis as Record<string, unknown>).__gatewayScript?.(...args),
    streamGatewayChat: (...args: unknown[]) => (globalThis as Record<string, unknown>).__gatewayStream?.(...args),
}));

vi.mock('@/lib/gateway/providers-setup', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    resolveGatewayProvider: async () => ({
        providerName: 'openai',
        model: 'gpt-4o',
        provider: {
            getPricing: async () => ({ inputPer1KTokens: 0, outputPer1KTokens: 0, cencoriMarkupPercentage: 0 }),
            countTokens: async () => 5,
        },
        router: {},
        billingMode: 'standard',
    }),
}));

vi.mock('@/lib/project-credit-billing', () => ({ chargeProjectUsageCredits: async () => true }));

vi.mock('@/lib/embedded/limits', () => ({
    checkRunRate: async () => ({ ok: true }),
    checkRunConcurrency: async () => ({ ok: true }),
}));

vi.mock('@/lib/embedded/budgets', () => ({
    checkSpendBudgets: async () => ({ ok: true }),
    enforceSpendGate: async () => ({ ok: true }),
    pauseBreachedScope: async () => undefined,
}));

vi.mock('@/lib/embedded/net-policy', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    resolveActionNetworkPolicy: async () => ({ mode: 'allowlist', allowed_hosts: ['mcp.example.com'] }),
    checkEgress: async () => ({ allowed: true, host: 'mcp.example.com', reason: 'allowlisted' }),
}));

const mcpCalls: Array<Record<string, unknown>> = [];
vi.mock('@/lib/embedded/mcp', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    mcpAuthHeaders: async () => ({}),
    callMcpTool: async (opts: Record<string, unknown>) => {
        mcpCalls.push(opts);
        return { answer: 42 };
    },
}));

vi.mock('@/lib/embedded/dispatch-webhook', () => ({ scheduleEmbeddedWebhook: () => undefined }));

vi.mock('@/lib/embedded/runs', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    emitEmbeddedEvent: async () => undefined,
}));

type Row = Record<string, unknown>;

function makeDb(seed: Record<string, Row[]>) {
    const tables: Record<string, Row[]> = Object.fromEntries(
        Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]),
    );
    const api: Record<string, unknown> = {};
    const state = {
        table: '', filters: [] as Array<(r: Row) => boolean>, order: [] as Array<{ col: string; asc: boolean }>,
        limitN: null as number | null, update: null as Row | null, upsertRow: null as Row | null,
        pendingInsert: null as Row | null,
    };
    const reset = (table: string) => {
        state.table = table;
        state.filters = [];
        state.order = [];
        state.limitN = null;
        state.update = null;
        state.upsertRow = null;
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
    Object.assign(api, {
        from: (table: string) => (reset(table), api),
        select: () => api,
        eq: (col: string, val: unknown) => (state.filters.push((r) => r[col] === val), api),
        in: (col: string, vals: unknown) => (state.filters.push((r) => (vals as unknown[]).includes(r[col])), api),
        order: (col: string, opts?: { ascending?: boolean }) => (state.order.push({ col, asc: opts?.ascending !== false }), api),
        limit: (n: number) => (state.limitN = n, api),
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
            if (state.pendingInsert) {
                const full = {
                    id: `row-${tables[state.table].length}`, created_at: '2026-09-25T00:00:01Z',
                    updated_at: '2026-09-25T00:00:01Z', ...state.pendingInsert,
                };
                tables[state.table].push(full);
                state.pendingInsert = null;
                return { data: full, error: null };
            }
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
        delete: () => api,
        then: (resolve: (v: unknown) => void) => {
            if (state.pendingInsert) {
                const full = {
                    id: `row-${tables[state.table].length}`, created_at: '2026-09-25T00:00:01Z',
                    updated_at: '2026-09-25T00:00:01Z', ...state.pendingInsert,
                };
                tables[state.table].push(full);
                state.pendingInsert = null;
                resolve({ data: full, error: null });
                return;
            }
            resolve({ data: run(), error: null });
        },
    });
    return { db: { from: api.from }, tables };
}

const req = (url: string, body?: unknown) => ({
    url,
    json: async () => body,
    headers: { get: (_k: string) => null },
}) as never;

const usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };
const cost = { providerCostUsd: 0.01, cencoriChargeUsd: 0.01, markupPercentage: 0 };

function seedDb(manifestTools: Array<{ server_id: string; tool: string }>, snapshotTools: Row[]) {
    return makeDb({
        agents: [{ id: 'agent-1', project_id: 'proj-1', is_active: true }],
        projects: [{ id: 'proj-1', organization_id: 'org-1', organizations: { subscription_tier: 'free' } }],
        agent_versions: [{
            id: 'v1', agent_id: 'agent-1', project_id: 'proj-1', version: '1', status: 'published',
            config_json: { model: 'gpt-4o', mcp_tools: manifestTools },
        }],
        mcp_servers: [{
            id: 'srv1', project_id: 'proj-1', name: 'Wiki', url: 'https://mcp.example.com/mcp',
            transport: 'streamable-http', status: 'active', auth_connection_id: null,
            tool_snapshot: { tools: snapshotTools },
        }],
        embedded_runs: [],
        embedded_run_events: [],
        ai_requests: [],
        actions: [],
        agent_installations: [],
    });
}

describe('direct-run hosted MCP loop', () => {
    it('executes read-classified tools and feeds results back to the model', async () => {
        const { POST } = await import('@/app/api/v1/agents/[agentId]/runs/route');
        const { db, tables } = seedDb(
            [{ server_id: 'mcp_srv1', tool: 'search' }],
            [{ name: 'search', description: 'Search docs', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } }],
        );
        (globalThis as Record<string, unknown>).__fakeDb = db;
        mcpCalls.length = 0;

        const calls: Array<Record<string, unknown>> = [];
        (globalThis as Record<string, unknown>).__gatewayScript = async (params: {
            request: { messages: Array<{ role: string }> };
        }) => {
            calls.push(params.request as Record<string, unknown>);
            if (calls.length === 1) {
                return {
                    content: '', model: 'gpt-4o', provider: 'openai', usage, cost,
                    toolCalls: [{ id: 'c1', type: 'function', function: { name: 'mcp__srv1__search', arguments: '{"q":"x"}' } }],
                };
            }
            return { content: 'answer: 42', model: 'gpt-4o', provider: 'openai', usage, cost };
        };

        const res = (await POST(
            req('http://x/v1/agents/agent-1/runs', { input: { task: 'what?' }, mode: 'sync' }),
            { params: Promise.resolve({ agentId: 'agent-1' }) },
        )) as { status: number; __body: { output: unknown; error: unknown } };

        expect(res.status).toBe(201);
        expect(res.__body.output.output).toBe('answer: 42');
        expect(res.__body.error).toBeNull();
        // Usage/cost accumulate across both model turns.
        expect(res.__body.output.cost).toMatchObject({ providerCostUsd: 0.02, cencoriChargeUsd: 0.02 });
        // Executed once against the granting server…
        expect(mcpCalls).toHaveLength(1);
        expect(mcpCalls[0]).toMatchObject({ tool: 'search', args: { q: 'x' } });
        // …and the second model turn saw the tool result.
        expect(calls).toHaveLength(2);
        const second = calls[1].messages as Array<{ role: string; toolCallId?: string }>;
        expect(second.some((m) => m.role === 'tool' && m.toolCallId === 'c1')).toBe(true);
        // Audited + metered once with accumulated usage.
        const completed = tables.embedded_run_events.filter((e) => e.event_type === 'tool_call.completed');
        expect(completed).toHaveLength(1);
        expect(tables.ai_requests).toHaveLength(1);
        expect(tables.actions).toHaveLength(0);
    });

    it('fails loudly with pending actions for approval-gated tools', async () => {        const { POST } = await import('@/app/api/v1/agents/[agentId]/runs/route');
        const { db, tables } = seedDb(
            [{ server_id: 'srv1', tool: 'deleteIndex' }],
            [{ name: 'deleteIndex', description: 'Drop it', inputSchema: { type: 'object' }, annotations: { destructiveHint: true } }],
        );
        (globalThis as Record<string, unknown>).__fakeDb = db;
        mcpCalls.length = 0;

        (globalThis as Record<string, unknown>).__gatewayScript = async () => ({
            content: '', model: 'gpt-4o', provider: 'openai', usage, cost,
            toolCalls: [{ id: 'c9', type: 'function', function: { name: 'mcp__srv1__deleteIndex', arguments: '{}' } }],
        });

        const res = (await POST(
            req('http://x/v1/agents/agent-1/runs', { input: { task: 'drop it' }, mode: 'sync' }),
            { params: Promise.resolve({ agentId: 'agent-1' }) },
        )) as { status: number; __body: { error: string } };

        expect(res.status).toBe(201);
        expect(String(res.__body.error)).toContain('Approval required');
        expect(mcpCalls).toHaveLength(0);
        expect(tables.actions).toHaveLength(1);
        expect(tables.actions[0].status).toBe('pending');
        expect(tables.actions[0].tool_name).toBe('mcp__srv1__deleteIndex');
    });

    it('streams word-by-word deltas, tool events, and completion over SSE', async () => {
        const { POST } = await import('@/app/api/v1/agents/[agentId]/runs/route');
        const { db, tables } = seedDb(
            [{ server_id: 'mcp_srv1', tool: 'search' }],
            [{ name: 'search', description: 'Search docs', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } }],
        );
        (globalThis as Record<string, unknown>).__fakeDb = db;
        mcpCalls.length = 0;

        let calls = 0;
        (globalThis as Record<string, unknown>).__gatewayStream = async function* () {
            calls++;
            if (calls === 1) {
                yield { delta: 'hel' };
                yield { delta: 'lo', toolCalls: [{ id: 'c1', type: 'function', function: { name: 'mcp__srv1__search', arguments: '{}' } }] };
                return;
            }
            yield { delta: 'done' };
            yield { delta: '', usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 } };
        };

        const res = (await POST(
            req('http://x/v1/agents/agent-1/runs', { input: { task: 'what?' }, mode: 'streaming' }),
            { params: Promise.resolve({ agentId: 'agent-1' }) },
        )) as { headers: Headers; body: ReadableStream<Uint8Array> };

        expect(res.headers.get('Content-Type')).toBe('text/event-stream');
        let text = '';
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
        }
        const events = text.split('\n\n').filter(Boolean).map((block) => {
            const event = (/^event: (.+)$/m.exec(block)?.[1] ?? 'data').trim();
            const data = (/^data: (.+)$/m.exec(block)?.[1] ?? '').trim();
            return { event, data: data === '[DONE]' ? null : JSON.parse(data) };
        });
        const kinds = events.map((e) => e.event);
        expect(kinds[0]).toBe('run.queued');
        expect(kinds).toContain('run.started');
        expect(kinds).toContain('text.delta');
        expect(kinds).toContain('tool_call.completed');
        expect(kinds[kinds.length - 2]).toBe('run.completed');
        expect(events[kinds.length - 1]).toEqual({ event: 'data', data: null });
        // Word-by-word: the model text arrived as deltas, not one blob.
        const deltas = events.filter((e) => e.event === 'text.delta').map((e) => (e.data as { delta: string }).delta).join('');
        expect(deltas).toBe('hellodone');
        // Terminal state matches sync semantics: completed row, one metering row.
        expect(tables.embedded_runs[0].status).toBe('completed');
        expect(tables.ai_requests).toHaveLength(1);
        expect(mcpCalls).toHaveLength(1);
    });
});
