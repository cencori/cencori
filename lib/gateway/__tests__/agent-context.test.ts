/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { loadAgentKeyContext } from '@/lib/gateway/agent-context';

function createAgentSupabase(options: {
    agentId?: string | null;
    agentActive?: boolean;
    agentModel?: string | null;
}) {
    const agentId = options.agentId ?? 'agent-1';
    return {
        from: vi.fn((table: string) => {
            if (table === 'api_keys') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: async () => ({
                                data: {
                                    agent_id: options.agentId === null ? null : agentId,
                                    key_type: 'secret',
                                    agents: {
                                        id: agentId,
                                        name: 'Test Agent',
                                        is_active: options.agentActive ?? true,
                                    },
                                },
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            if (table === 'agent_configs') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: async () => ({
                                data: options.agentModel ? { model: options.agentModel } : null,
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            return {
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: null, error: null }),
                    }),
                }),
            };
        }),
    };
}

describe('loadAgentKeyContext', () => {
    it('returns null agent fields for non-agent keys', async () => {
        const supabase = createAgentSupabase({ agentId: null });
        const ctx = await loadAgentKeyContext(supabase as never, 'key-1');
        expect(ctx).toEqual({
            agentId: null,
            agentConfigModel: null,
            agentName: null,
        });
    });

    it('loads agent model from agent_configs', async () => {
        const supabase = createAgentSupabase({ agentModel: 'claude-sonnet-4' });
        const ctx = await loadAgentKeyContext(supabase as never, 'key-agent');
        expect(ctx.agentId).toBe('agent-1');
        expect(ctx.agentConfigModel).toBe('claude-sonnet-4');
        expect(ctx.agentName).toBe('Test Agent');
    });

    it('throws when agent is disabled', async () => {
        const supabase = createAgentSupabase({ agentActive: false });
        await expect(loadAgentKeyContext(supabase as never, 'key-agent')).rejects.toThrow(
            'AGENT_DISABLED'
        );
    });
});
