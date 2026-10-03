/**
 * @vitest-environment node
 *
 * Contract tests for the Phase-2 memory surface: batch write, forget by
 * filter, GDPR export. Validation, quota/ops mapping, pagination caps, and
 * org/project/scope isolation on every query.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createMockGatewayContext } from '@/lib/gateway/__tests__/fixtures';

const routeMocks = vi.hoisted(() => ({
    validateGatewayRequest: vi.fn(),
    logGatewayRequest: vi.fn(),
    incrementUsage: vi.fn(),
    addGatewayHeaders: vi.fn((res: Response) => res),
    getProjectMemorySettings: vi.fn(),
    checkMemoryQuota: vi.fn(),
    checkMemoryOpsQuota: vi.fn(),
    writeMemories: vi.fn(),
    appendSessionMemories: vi.fn(),
    clearSessionMemories: vi.fn(),
    redactFact: vi.fn(),
}));

vi.mock('@/lib/gateway-middleware', () => ({
    validateGatewayRequest: (...args: unknown[]) => routeMocks.validateGatewayRequest(...args),
    handleCorsPreFlight: vi.fn(),
    addGatewayHeaders: (...args: unknown[]) => (routeMocks.addGatewayHeaders as never as (...a: unknown[]) => unknown)(...args),
    logGatewayRequest: (...args: unknown[]) => routeMocks.logGatewayRequest(...args),
    incrementUsage: (...args: unknown[]) => routeMocks.incrementUsage(...args),
}));

vi.mock('@/lib/memory/settings', () => ({
    getProjectMemorySettings: (...args: unknown[]) => routeMocks.getProjectMemorySettings(...args),
}));

vi.mock('@/lib/memory/quota', async importOriginal => {
    const original = await importOriginal<typeof import('@/lib/memory/quota')>();
    return { ...original, checkMemoryQuota: (...args: unknown[]) => routeMocks.checkMemoryQuota(...args) };
});

vi.mock('@/lib/memory/ops-quota', async importOriginal => {
    const original = await importOriginal<typeof import('@/lib/memory/ops-quota')>();
    return {
        ...original,
        checkMemoryOpsQuota: (...args: unknown[]) => routeMocks.checkMemoryOpsQuota(...args),
    };
});

vi.mock('@/lib/memory/writeback', () => ({
    writeMemories: (...args: unknown[]) => routeMocks.writeMemories(...args),
    runChatMemoryWriteback: vi.fn(),
}));

vi.mock('@/lib/memory/session-store', async importOriginal => {
    const original = await importOriginal<typeof import('@/lib/memory/session-store')>();
    return {
        ...original,
        appendSessionMemories: (...args: unknown[]) => routeMocks.appendSessionMemories(...args),
        clearSessionMemories: (...args: unknown[]) => routeMocks.clearSessionMemories(...args),
    };
});

vi.mock('@/lib/memory/redact', () => ({
    redactFact: (...args: unknown[]) => routeMocks.redactFact(...args),
}));

import { POST as batchPost } from '@/app/api/v1/memory/write/batch/route';
import { POST as forgetPost } from '@/app/api/v1/memory/forget/route';
import { POST as exportPost } from '@/app/api/v1/memory/export/route';

const ENABLED_SETTINGS = {
    enabled: true,
    extractionModel: 'openai/gpt-oss-20b',
    extractionPrompt: null,
    minImportance: 0.5,
    maxMemoriesPerExchange: 5,
    sessionTtlSeconds: 86400,
    graphEnabled: true,
};

/** Recursive query-builder mock: every filter returns the chain. */
function chainMock(finalResult: unknown) {
    const self: Record<string, unknown> = {};
    self.eq = vi.fn(() => self);
    self.lt = vi.fn(() => self);
    self.gt = vi.fn(() => self);
    self.in = vi.fn(() => self);
    self.order = vi.fn(() => self);
    self.limit = vi.fn(async () => finalResult);
    self.select = vi.fn(() => self);
    self.delete = vi.fn(() => self);
    return { chain: self as unknown as { eq: ReturnType<typeof vi.fn> }, from: vi.fn(() => self) };
}

function jsonRequest(url: string, body: unknown): NextRequest {
    return new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('memory contract routes', () => {
    let ctx: ReturnType<typeof createMockGatewayContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        ctx = createMockGatewayContext();
        routeMocks.validateGatewayRequest.mockResolvedValue({ success: true, context: ctx });
        routeMocks.getProjectMemorySettings.mockResolvedValue(ENABLED_SETTINGS);
        routeMocks.checkMemoryQuota.mockResolvedValue({ allowed: true, used: 1, limit: 1000 });
        routeMocks.checkMemoryOpsQuota.mockResolvedValue({
            allowed: true,
            used: 0,
            limit: 2000,
            resetMs: 0,
            scope: null,
        });
        routeMocks.logGatewayRequest.mockResolvedValue(undefined);
        routeMocks.incrementUsage.mockResolvedValue(undefined);
    });

    function unauthenticated() {
        routeMocks.validateGatewayRequest.mockResolvedValue({
            success: false,
            response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
        });
    }

    describe('POST /v1/memory/write/batch', () => {
        const memories = [{ content: 'Prefers dark mode' }, { content: 'Uses TypeScript', importance: 0.9 }];

        it('rejects unauthenticated requests', async () => {
            unauthenticated();
            const res = await batchPost(jsonRequest('http://x/v1/memory/write/batch', { userId: 'u', memories }));
            expect(res.status).toBe(401);
            expect(routeMocks.writeMemories).not.toHaveBeenCalled();
        });

        it('403s when the kill switch is off', async () => {
            routeMocks.getProjectMemorySettings.mockResolvedValue({ ...ENABLED_SETTINGS, enabled: false });
            const res = await batchPost(jsonRequest('http://x/v1/memory/write/batch', { userId: 'u', memories }));
            expect(res.status).toBe(403);
        });

        it('400s on empty / oversized / invalid items', async () => {
            const base = { userId: 'u' };
            expect((await batchPost(jsonRequest('http://x/batch', { ...base, memories: [] }))).status).toBe(400);
            const big = Array.from({ length: 51 }, (_, i) => ({ content: `fact ${i}` }));
            expect((await batchPost(jsonRequest('http://x/batch', { ...base, memories: big }))).status).toBe(400);
            const bad = await batchPost(
                jsonRequest('http://x/batch', { ...base, memories: [{ content: 'ok' }, { nope: 1 }] })
            );
            expect(bad.status).toBe(400);
        });

        it('429s on stored-count and ops quota with distinct codes', async () => {
            routeMocks.checkMemoryQuota.mockResolvedValue({ allowed: false, used: 1000, limit: 1000 });
            const q = await batchPost(jsonRequest('http://x/batch', { userId: 'u', memories }));
            expect(q.status).toBe(429);
            expect((await q.json()).error.code).toBe('memory_quota_exceeded');

            routeMocks.checkMemoryQuota.mockResolvedValue({ allowed: true, used: 1, limit: 1000 });
            routeMocks.checkMemoryOpsQuota.mockResolvedValue({
                allowed: false,
                used: 2000,
                limit: 2000,
                resetMs: 1000,
                scope: 'project',
            });
            const o = await batchPost(jsonRequest('http://x/batch', { userId: 'u', memories }));
            expect(o.status).toBe(429);
            expect((await o.json()).error.code).toBe('memory_ops_quota_exceeded');
        });

        it('writes the whole batch in one writeMemories call', async () => {
            routeMocks.writeMemories.mockResolvedValue({
                written: [
                    { id: 'mem_1', content: 'Prefers dark mode', importance: 0.5 },
                    { id: 'mem_2', content: 'Uses TypeScript', importance: 0.9 },
                ],
                quotaExceeded: false,
                embeddingCostUsd: 0.001,
                embeddingModel: 'gemini-embedding-001',
                embeddingProvider: 'google',
            });
            const res = await batchPost(
                jsonRequest('http://x/batch', { userId: 'u', namespace: 'prefs', memories })
            );
            expect(res.status).toBe(201);
            expect(routeMocks.writeMemories).toHaveBeenCalledTimes(1);
            const args = routeMocks.writeMemories.mock.calls[0][0] as Record<string, unknown>;
            expect(args.scope).toBe('user');
            expect(args.scopeKey).toBe('u');
            expect(args.namespace).toBe('prefs');
            expect(args.facts).toEqual([
                { content: 'Prefers dark mode', importance: 0.5 },
                { content: 'Uses TypeScript', importance: 0.9 },
            ]);
            const body = await res.json();
            expect(body.count).toBe(2);
            expect(body.requested).toBe(2);
        });
    });

    describe('POST /v1/memory/forget', () => {
        it('400s without a scope key and on bad filters', async () => {
            expect((await forgetPost(jsonRequest('http://x/forget', {}))).status).toBe(400);
            expect(
                (await forgetPost(jsonRequest('http://x/forget', { userId: 'u', before: 'not-a-date' }))).status
            ).toBe(400);
            const many = Array.from({ length: 1001 }, (_, i) => `mem_${i}`);
            expect((await forgetPost(jsonRequest('http://x/forget', { userId: 'u', ids: many }))).status).toBe(
                400
            );
        });

        it('clears session scope via Redis without touching Postgres', async () => {
            routeMocks.clearSessionMemories.mockResolvedValue(undefined);
            const res = await forgetPost(jsonRequest('http://x/forget', { scope: 'session', sessionId: 's1' }));
            expect(res.status).toBe(200);
            expect(routeMocks.clearSessionMemories).toHaveBeenCalledWith(
                ctx.organizationId,
                ctx.projectId,
                's1'
            );
            expect((await res.json()).clearedSession).toBe(true);
        });

        it('429s when the write ops allowance is exhausted', async () => {
            routeMocks.checkMemoryOpsQuota.mockResolvedValue({
                allowed: false,
                used: 1,
                limit: 1,
                resetMs: 1000,
                scope: 'user',
            });
            const res = await forgetPost(jsonRequest('http://x/forget', { userId: 'u' }));
            expect(res.status).toBe(429);
            expect((await res.json()).error.code).toBe('memory_ops_quota_exceeded');
        });

        it('deletes by scope filter with org/project isolation and audits', async () => {
            const { chain, from } = chainMock({ data: [{ id: 'a' }, { id: 'b' }], error: null });
            // delete() path resolves { error: null }.
            (chain.delete as ReturnType<typeof vi.fn>).mockImplementation(() => ({
                eq: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(async () => ({ error: null })) })) })),
            }));
            ctx.supabase = { from } as never;

            const res = await forgetPost(
                jsonRequest('http://x/forget', { userId: 'u', namespace: 'prefs', before: '2026-01-01T00:00:00Z' })
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toMatchObject({ forgotten: 2, truncated: false, scope: 'user', scopeKey: 'u' });
            expect(chain.eq).toHaveBeenCalledWith('organization_id', ctx.organizationId);
            expect(chain.eq).toHaveBeenCalledWith('project_id', ctx.projectId);
            expect(chain.eq).toHaveBeenCalledWith('scope', 'user');
            expect(chain.eq).toHaveBeenCalledWith('scope_key', 'u');
            expect(routeMocks.logGatewayRequest).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({ endpoint: 'memory/forget', status: 'success' })
            );
        });

        it('flags truncation past the row cap', async () => {
            const ids = Array.from({ length: 1001 }, (_, i) => ({ id: `id-${i}` }));
            const { from } = chainMock({ data: ids, error: null });
            ctx.supabase = { from } as never;
            const res = await forgetPost(jsonRequest('http://x/forget', { userId: 'u' }));
            const body = await res.json();
            expect(body.forgotten).toBe(1000);
            expect(body.truncated).toBe(true);
        });
    });

    describe('POST /v1/memory/export', () => {
        it('400s without a scope key and on a bad cursor', async () => {
            expect((await exportPost(jsonRequest('http://x/export', {}))).status).toBe(400);
            expect(
                (await exportPost(jsonRequest('http://x/export', { userId: 'u', cursor: 'whenever' }))).status
            ).toBe(400);
        });

        it('reports session scope as ephemeral without querying', async () => {
            const { from } = chainMock({ data: [], error: null });
            ctx.supabase = { from } as never;
            const res = await exportPost(
                jsonRequest('http://x/export', { scope: 'session', sessionId: 's1' })
            );
            expect(res.status).toBe(200);
            expect(await res.json()).toMatchObject({ scope: 'session', ephemeral: true, count: 0 });
            expect(from).not.toHaveBeenCalled();
        });

        it('429s when the search ops allowance is exhausted', async () => {
            routeMocks.checkMemoryOpsQuota.mockResolvedValue({
                allowed: false,
                used: 1,
                limit: 1,
                resetMs: 1000,
                scope: 'project',
            });
            const res = await exportPost(jsonRequest('http://x/export', { userId: 'u' }));
            expect(res.status).toBe(429);
        });

        it('returns a portable page and isolates by org/project/scope', async () => {
            const { chain, from } = chainMock({
                data: [
                    {
                        id: 'a',
                        scope: 'user',
                        namespace: null,
                        content: 'Prefers dark mode',
                        importance: 0.7,
                        metadata: {},
                        status: 'active',
                        created_at: '2026-01-02T00:00:00Z',
                    },
                ],
                error: null,
            });
            ctx.supabase = { from } as never;
            const res = await exportPost(jsonRequest('http://x/export', { userId: 'u', limit: 200 }));
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.count).toBe(1);
            expect(body.truncated).toBe(false);
            expect(body.nextCursor).toBeNull();
            expect(body.memories[0]).toMatchObject({ id: 'mem_a', scope: 'user', content: 'Prefers dark mode' });
            expect(chain.eq).toHaveBeenCalledWith('organization_id', ctx.organizationId);
            expect(chain.eq).toHaveBeenCalledWith('project_id', ctx.projectId);
            expect(chain.eq).toHaveBeenCalledWith('scope_key', 'u');
            expect(routeMocks.checkMemoryOpsQuota).toHaveBeenCalledWith(
                ctx.projectId,
                ctx.tier,
                'u',
                'search'
            );
        });

        it('paginates with nextCursor past the page', async () => {
            const rows = [
                { id: 'a', scope: 'user', namespace: null, content: 'one', importance: 0.5, metadata: {}, status: 'active', created_at: '2026-01-02T00:00:00Z' },
                { id: 'b', scope: 'user', namespace: null, content: 'two', importance: 0.5, metadata: {}, status: 'active', created_at: '2026-01-03T00:00:00Z' },
            ];
            const { from } = chainMock({ data: rows, error: null });
            ctx.supabase = { from } as never;
            const res = await exportPost(jsonRequest('http://x/export', { userId: 'u', limit: 1 }));
            const body = await res.json();
            expect(body.count).toBe(1);
            expect(body.truncated).toBe(true);
            expect(body.nextCursor).toBe('2026-01-02T00:00:00Z');
        });

        it('500s when the dump query fails', async () => {
            const { from } = chainMock({ data: null, error: { message: 'db down' } });
            ctx.supabase = { from } as never;
            const res = await exportPost(jsonRequest('http://x/export', { userId: 'u' }));
            expect(res.status).toBe(500);
        });
    });
});
