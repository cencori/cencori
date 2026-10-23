/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const embedForMemory = vi.hoisted(() => vi.fn());
vi.mock('@/lib/memory/embeddings', () => ({ embedForMemory }));

import { retrieveKnowledge, TURN_KNOWLEDGE_MAX_CITATIONS } from '@/lib/embedded/turn-knowledge';

const EMBEDDING = {
    embeddings: [[0.1, 0.2]],
    totalTokens: 7,
    providerCostUsd: 0.000001,
    cencoriChargeUsd: 0.000001,
    markupPercentage: 0,
    model: 'gemini-embedding-001',
    provider: 'google' as const,
};

function hit(kb: string, n: number, similarity: number) {
    return { id: `${kb}-chunk-${n}`, source_id: `${kb}-src`, ord: n, page: null, content: `${kb} fact ${n}`, similarity };
}

function supabaseWith(hitsByKb: Record<string, unknown[] | Error>) {
    return {
        rpc: vi.fn(async (_fn: string, args: { p_knowledge_base_id: string }) => {
            const hits = hitsByKb[args.p_knowledge_base_id];
            return hits instanceof Error ? { data: null, error: hits } : { data: hits ?? [], error: null };
        }),
    };
}

const base = { projectId: 'p1', organizationId: 'o1', queryText: 'How long do refunds take?' };

describe('retrieveKnowledge', () => {
    beforeEach(() => {
        embedForMemory.mockReset();
        embedForMemory.mockResolvedValue(EMBEDDING);
    });

    it('keeps the best hits across bases, not the first base to fill up', async () => {
        const supabase = supabaseWith({
            a: [1, 2, 3, 4, 5].map((n) => hit('a', n, 0.5 - n / 100)),
            b: [hit('b', 1, 0.95), hit('b', 2, 0.9)],
        });
        const result = await retrieveKnowledge(supabase as never, { ...base, knowledgeBaseIds: ['a', 'b'] });

        expect(result.citations).toHaveLength(TURN_KNOWLEDGE_MAX_CITATIONS);
        expect(result.citations.slice(0, 2).map((c) => c.chunk_id)).toEqual(['b-chunk-1', 'b-chunk-2']);
        expect(result.block).toContain('[1] b fact 1');
    });

    it('sends whole passages to the model, not a truncated prefix', async () => {
        const passage = `${'Shift rules. '.repeat(45)}Ada already worked a double shift on Monday.`;
        expect(passage.length).toBeGreaterThan(500);
        const result = await retrieveKnowledge(
            supabaseWith({ a: [{ ...hit('a', 1, 0.9), content: passage }] }) as never,
            { ...base, knowledgeBaseIds: ['a'] },
        );
        expect(result.block).toContain('Ada already worked a double shift on Monday.');
    });

    it('reports embedding usage so the query can be billed', async () => {
        const onEmbeddingUsage = vi.fn();
        await retrieveKnowledge(supabaseWith({ a: [hit('a', 1, 0.8)] }) as never, { ...base, knowledgeBaseIds: ['a'], onEmbeddingUsage });
        expect(onEmbeddingUsage).toHaveBeenCalledWith(EMBEDDING);
    });

    it('skips a failing base and fails open on embedding errors', async () => {
        const partial = await retrieveKnowledge(
            supabaseWith({ a: new Error('rpc down'), b: [hit('b', 1, 0.7)] }) as never,
            { ...base, knowledgeBaseIds: ['a', 'b'] },
        );
        expect(partial.citations.map((c) => c.chunk_id)).toEqual(['b-chunk-1']);

        embedForMemory.mockRejectedValue(new Error('embedding provider 503'));
        const failed = await retrieveKnowledge(supabaseWith({ a: [hit('a', 1, 0.8)] }) as never, { ...base, knowledgeBaseIds: ['a'] });
        expect(failed).toEqual({ block: null, citations: [] });
    });

    it('does nothing without bases or query text', async () => {
        const supabase = supabaseWith({});
        expect(await retrieveKnowledge(supabase as never, { ...base, knowledgeBaseIds: [] })).toEqual({ block: null, citations: [] });
        expect(await retrieveKnowledge(supabase as never, { ...base, queryText: '  ', knowledgeBaseIds: ['a'] })).toEqual({ block: null, citations: [] });
        expect(embedForMemory).not.toHaveBeenCalled();
    });
});
