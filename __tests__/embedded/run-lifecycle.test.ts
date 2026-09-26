import { describe, expect, it, vi } from 'vitest';
import { executionVersionInputs } from '@/lib/embedded/agents';

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
