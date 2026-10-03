/**
 * Ops enforcement at the retrieval/write choke points.
 *
 * - retrieveMemories skips ([]) by default on denial (chat fail-open) and
 *   throws MemoryOpsExceededError with ops:'throw' (direct endpoints → 429).
 * - Session scope never consults the ops limiter (Redis-only, no spend).
 * - writeMemories surfaces opsExceeded without burning embeddings.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ops-quota', async importOriginal => {
    const actual = await importOriginal<typeof import('../ops-quota')>();
    return { ...actual, checkMemoryOpsQuota: vi.fn() };
});

vi.mock('../embeddings', () => ({
    MEMORY_EMBEDDING_MODEL: 'text-embedding-3-small',
    embedForMemory: vi.fn(async () => {
        throw new Error('embeddings must not run when ops deny');
    }),
}));

import { checkMemoryOpsQuota } from '../ops-quota';
import { MemoryOpsExceededError } from '../ops-quota';
import { retrieveMemories } from '../retrieval';
import { writeMemories } from '../writeback';

const mockedOps = vi.mocked(checkMemoryOpsQuota);

const SUPABASE = {} as never;

function userDirective(scopeKey = 'user_a') {
    return {
        scope: 'user' as const,
        scopeKey,
        retrieve: true,
        write: false,
        topK: 5,
        threshold: 0.7,
        thresholdExplicit: false,
        namespace: null,
        extract: null,
        asOf: null,
        mode: 'inject' as const,
        graph: false,
    };
}

describe('retrieveMemories ops enforcement', () => {
    beforeEach(() => {
        mockedOps.mockReset();
        mockedOps.mockResolvedValue({ allowed: true, used: 0, limit: 10_000, resetMs: 0, scope: null });
    });

    it('skips retrieval (fail-open) on denial by default', async () => {
        mockedOps.mockResolvedValue({ allowed: false, used: 10, limit: 10, resetMs: 1000, scope: 'project' });
        const out = await retrieveMemories({
            supabase: SUPABASE,
            organizationId: 'org_1',
            projectId: 'proj_1',
            directive: userDirective(),
            queryText: 'what do I use?',
            tier: 'free',
        });
        expect(out).toEqual([]);
    });

    it('throws MemoryOpsExceededError with ops:throw', async () => {
        const status = { allowed: false, used: 10, limit: 10, resetMs: 1000, scope: 'project' as const };
        mockedOps.mockResolvedValue(status);
        await expect(
            retrieveMemories({
                supabase: SUPABASE,
                organizationId: 'org_1',
                projectId: 'proj_1',
                directive: userDirective(),
                queryText: 'what do I use?',
                tier: 'free',
                ops: 'throw',
            })
        ).rejects.toBeInstanceOf(MemoryOpsExceededError);
    });

    it('session scope never consults the limiter', async () => {
        const out = await retrieveMemories({
            supabase: SUPABASE,
            organizationId: 'org_1',
            projectId: 'proj_1',
            directive: { ...userDirective('sess_1'), scope: 'session' },
            queryText: 'anything',
            tier: 'free',
            ops: 'throw',
        });
        // No Redis configured in test env → session store degrades to [].
        expect(out).toEqual([]);
        expect(mockedOps).not.toHaveBeenCalled();
    });
});

describe('writeMemories ops enforcement', () => {
    function mockSupabaseQuotaAllowed() {
        return {
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        eq: vi.fn(async () => ({ count: 0, error: null })),
                    })),
                })),
            })),
            rpc: vi.fn(async () => ({ data: [], error: null })),
        } as never;
    }

    beforeEach(() => {
        mockedOps.mockReset();
    });

    it('returns opsExceeded without embedding when denied', async () => {
        mockedOps.mockResolvedValue({ allowed: false, used: 5, limit: 5, resetMs: 1000, scope: 'user' });
        const result = await writeMemories({
            supabase: mockSupabaseQuotaAllowed(),
            organizationId: 'org_1',
            projectId: 'proj_1',
            tier: 'free',
            scope: 'user',
            scopeKey: 'user_a',
            namespace: null,
            facts: [{ content: 'Prefers dark mode.', importance: 0.7 }],
        });
        expect(result.opsExceeded).toBe(true);
        expect(result.written).toEqual([]);
        expect(result.opsStatus?.scope).toBe('user');
        expect(mockedOps).toHaveBeenCalledWith('proj_1', 'free', 'user_a', 'write');
    });
});
