import type { createAdminClient } from '@/lib/supabaseAdmin';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type AgentKeyContext = {
    agentId: string | null;
    agentConfigModel: string | null;
    agentName: string | null;
};

/**
 * Load agent metadata for agent-scoped API keys (after gateway validation).
 */
export async function loadAgentKeyContext(
    supabase: SupabaseAdmin,
    apiKeyId: string | null
): Promise<AgentKeyContext> {
    const { data, error } = await supabase
        .from('api_keys')
        .select(`
            agent_id,
            key_type,
            agents (
                id,
                name,
                is_active
            )
        `)
        .eq('id', apiKeyId)
        .single();

    if (error || !data) {
        return { agentId: null, agentConfigModel: null, agentName: null };
    }

    const agentId = data.agent_id as string | null;
    if (!agentId) {
        return { agentId: null, agentConfigModel: null, agentName: null };
    }

    const rawAgent = data.agents;
    const agent = Array.isArray(rawAgent) ? rawAgent[0] : rawAgent;
    if (agent && !agent.is_active) {
        throw new Error('AGENT_DISABLED');
    }

    let agentConfigModel: string | null = null;
    const { data: agentConfig } = await supabase
        .from('agent_configs')
        .select('model')
        .eq('agent_id', agentId)
        .single();

    if (agentConfig?.model) {
        agentConfigModel = agentConfig.model;
    }

    return {
        agentId,
        agentConfigModel,
        agentName: agent?.name ?? null,
    };
}
