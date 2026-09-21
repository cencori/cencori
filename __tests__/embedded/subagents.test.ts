import { describe, expect, it } from 'vitest';
import { delegationReachesAgent } from '@/lib/embedded/agents';

// NOTE: delegationReachesAgent queries versions by child IDs; the stub answers
// version rows from the agentOf map instead.
function stubSupabase(edges: Array<[string, string]>, agentOf: Record<string, string>) {
    return {
        from: (table: string) => {
            if (table === 'agent_version_subagents') {
                return {
                    select: () => ({
                        in: (_col: string, parents: string[]) =>
                            Promise.resolve({
                                data: edges.filter(([p]) => parents.includes(p)).map(([, c]) => ({ child_agent_version_id: c })),
                            }),
                    }),
                };
            }
            return {
                select: () => ({
                    in: (_col: string, ids: string[]) =>
                        Promise.resolve({ data: ids.filter((id) => agentOf[id]).map((id) => ({ id, agent_id: agentOf[id] })) }),
                }),
            };
        },
    };
}

describe('delegation cycle detection', () => {
    it('detects an indirect cycle A → B → A', async () => {
        // vA1 (agent A) allows vB1; vB1 (agent B) allows vA2 (agent A).
        const supabase = stubSupabase(
            [['vA1', 'vB1'], ['vB1', 'vA2']],
            { vB1: 'agentB', vA2: 'agentA', vA1: 'agentA' },
        );
        // Publishing a new version of A referencing vB1 must detect the cycle back to A.
        await expect(delegationReachesAgent(supabase as never, 'vB1', 'agentA')).resolves.toBe(true);
    });

    it('allows acyclic delegation', async () => {
        const supabase = stubSupabase(
            [['vA1', 'vB1'], ['vB1', 'vC1']],
            { vB1: 'agentB', vC1: 'agentC' },
        );
        await expect(delegationReachesAgent(supabase as never, 'vB1', 'agentA')).resolves.toBe(false);
    });

    it('returns false with no edges', async () => {
        const supabase = stubSupabase([], {});
        await expect(delegationReachesAgent(supabase as never, 'vX', 'agentA')).resolves.toBe(false);
    });
});
