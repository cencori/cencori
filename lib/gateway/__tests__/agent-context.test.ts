/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { loadAgentKeyContext, resolveAgentContext } from '@/lib/gateway/agent-context';

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

    it('returns nulls when apiKeyId is null', async () => {
        const supabase = createAgentSupabase({});
        const ctx = await loadAgentKeyContext(supabase as never, null);
        expect(ctx).toEqual({ agentId: null, agentConfigModel: null, agentName: null });
    });
});

describe('resolveAgentContext', () => {
    it('returns missing_agent_id_dashboard_auth when no X-Agent-ID and no API key route', async () => {
        const supabase = createAgentSupabase({});
        const req = new NextRequest('https://api.cencori.com/v1/responses');
        const result = await resolveAgentContext({
            supabase: supabase as never,
            req,
            gatewayCtx: null,
            authenticatedProjectId: null,
            authenticatedUserId: null,
            startedAt: Date.now(),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errorCode).toBe('missing_agent_id_dashboard_auth');
            expect(result.response!.status).toBe(400);
        }
    });

    it('returns agent_not_found when no X-Agent-ID with dashboard auth', async () => {
        const supabase = createAgentSupabase({});
        const req = new NextRequest('https://api.cencori.com/v1/responses');
        const result = await resolveAgentContext({
            supabase: supabase as never,
            req,
            gatewayCtx: null,
            authenticatedProjectId: null,
            authenticatedUserId: 'user-1',
            startedAt: Date.now(),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.response!.status).toBe(400);
            expect(result.errorCode).toBe('missing_agent_id_dashboard_auth');
        }
    });

    it('returns agent_not_found for API key requests without agent (no X-Agent-ID, has project)', async () => {
        const supabase = createAgentSupabase({});
        const req = new NextRequest('https://api.cencori.com/v1/responses');
        const result = await resolveAgentContext({
            supabase: supabase as never,
            req,
            gatewayCtx: null,
            authenticatedProjectId: 'project-1',
            authenticatedUserId: null,
            startedAt: Date.now(),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errorCode).toBe('agent_not_found');
            expect(result.response).toBeUndefined();
        }
    });
});
