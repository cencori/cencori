import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/memory/embeddings', () => ({
    embedForMemory: vi.fn(async () => ({ embeddings: [[0.1, 0.2]] })),
}));

import { clearKnowledgeBaseIdsCacheForTests, retrieveTurnKnowledge } from '@/lib/embedded/turn-knowledge';
import { isMissingAgentKnowledgeColumn } from '@/lib/embedded/agent-knowledge';

type Hit = { id: string; source_id: string; content: string; similarity: number };

/** Just enough of the Supabase client for agent + installation knowledge lookups. */
/** Knowledge too big to send whole (more chunks than TURN_KNOWLEDGE_WHOLE_MAX_CHUNKS), so turns search it. */
const BIG = Array.from({ length: 17 }, (_, i) => ({ id: `big${i}`, source_id: 's', ord: i, page: null, content: `Chunk ${i}` }));

function fakeDb(opts: { agentKbId: string | null; boundKbIds: string[]; hits: Record<string, Hit[]>; chunks?: Array<{ id: string; source_id: string; ord: number; page: null; content: string }> }) {
    const searched: string[] = [];
    const chain = (result: unknown) => {
        const query: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'is', 'in', 'not', 'order']) query[method] = () => query;
        query.maybeSingle = async () => result;
        query.limit = async () => result;
        return query;
    };
    return {
        searched,
        db: {
            from: (table: string) => table === 'knowledge_bases'
                ? chain({ data: opts.agentKbId ? { id: opts.agentKbId } : null, error: null })
                : table === 'knowledge_chunks'
                    ? chain({ data: opts.chunks ?? BIG, error: null })
                    : chain({ data: opts.boundKbIds.map((id) => ({ knowledge_base_id: id })), error: null }),
            rpc: async (_name: string, args: { p_knowledge_base_id: string }) => {
                searched.push(args.p_knowledge_base_id);
                return { data: opts.hits[args.p_knowledge_base_id] ?? [], error: null };
            },
        },
    };
}

describe('agent knowledge in turns', () => {
    beforeEach(() => clearKnowledgeBaseIdsCacheForTests());

    it("searches the agent's own knowledge without an installation", async () => {
        const { db, searched } = fakeDb({ agentKbId: 'kb_agent', boundKbIds: [], hits: { kb_agent: [{ id: 'c1', source_id: 's1', content: 'Refunds take 30 days.', similarity: 0.9 }] } });
        const result = await retrieveTurnKnowledge(db as never, { projectId: 'p', organizationId: 'o', installationId: null, agentId: 'agent_1', queryText: 'refunds?' });
        expect(searched).toEqual(['kb_agent']);
        expect(result.block).toContain('[1] Refunds take 30 days.');
        expect(result.citations).toHaveLength(1);
    });

    it('sends small knowledge whole, without searching', async () => {
        const chunks = [
            { id: 'm1', source_id: 'menu', ord: 0, page: null, content: 'Jollof rice — ₦6,500' },
            { id: 'm2', source_id: 'menu', ord: 1, page: null, content: 'Suya — ₦4,000' },
        ];
        const { db, searched } = fakeDb({ agentKbId: 'kb_agent', boundKbIds: [], hits: {}, chunks });
        const result = await retrieveTurnKnowledge(db as never, { projectId: 'p', organizationId: 'o', installationId: null, agentId: 'agent_1', queryText: 'how much is suya?' });
        expect(searched).toEqual([]);
        expect(result.block).toContain('[1] Jollof rice — ₦6,500');
        expect(result.block).toContain('[2] Suya — ₦4,000');
        expect(result.citations.map((citation) => citation.chunk_id)).toEqual(['m1', 'm2']);
    });

    it('combines agent and installation knowledge, best matches first', async () => {
        const { db, searched } = fakeDb({
            agentKbId: 'kb_agent',
            boundKbIds: ['kb_customer'],
            hits: {
                kb_agent: [{ id: 'c1', source_id: 's1', content: 'General policy.', similarity: 0.5 }],
                kb_customer: [{ id: 'c2', source_id: 's2', content: 'Customer-specific policy.', similarity: 0.8 }],
            },
        });
        const result = await retrieveTurnKnowledge(db as never, { projectId: 'p', organizationId: 'o', installationId: 'ins_1', agentId: 'agent_1', queryText: 'policy' });
        expect(searched.sort()).toEqual(['kb_agent', 'kb_customer']);
        expect(result.citations.map((citation) => citation.chunk_id)).toEqual(['c2', 'c1']);
    });

    it('skips the embedding call when there is nothing to search', async () => {
        const { embedForMemory } = await import('@/lib/memory/embeddings');
        vi.mocked(embedForMemory).mockClear();
        const { db } = fakeDb({ agentKbId: null, boundKbIds: [], hits: {} });
        const result = await retrieveTurnKnowledge(db as never, { projectId: 'p', organizationId: 'o', installationId: 'ins_1', agentId: 'agent_1', queryText: 'anything' });
        expect(result).toEqual({ block: null, citations: [] });
        expect(embedForMemory).not.toHaveBeenCalled();
    });

    it('recognises a database without the migration', () => {
        expect(isMissingAgentKnowledgeColumn({ code: '42703', message: 'column knowledge_bases.agent_id does not exist' })).toBe(true);
        expect(isMissingAgentKnowledgeColumn({ code: 'PGRST204', message: "Could not find the 'agent_id' column" })).toBe(true);
        expect(isMissingAgentKnowledgeColumn({ code: '23505', message: 'duplicate key' })).toBe(false);
    });
});
