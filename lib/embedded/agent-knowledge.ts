import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

/** True when the live database hasn't had the agent knowledge migration yet. */
export function isMissingAgentKnowledgeColumn(error: { code?: string; message?: string } | null | undefined) {
    return Boolean(error && (error.code === '42703' || error.code === 'PGRST204' || /knowledge_bases\.agent_id|'agent_id' column|column .*agent_id.* does not exist/i.test(error.message ?? '')));
}

/**
 * The agent's own knowledge base (shared by every customer it runs for), or
 * null when it has none. Never throws: retrieval is best-effort, so a missing
 * migration or a failed read just means no agent knowledge this turn.
 */
export async function agentKnowledgeBaseId(supabase: Admin, agentId: string | null | undefined): Promise<string | null> {
    if (!agentId) return null;
    try {
        const { data, error } = await supabase
            .from('knowledge_bases')
            .select('id')
            .eq('agent_id', agentId)
            .is('tenant_id', null)
            .eq('status', 'active')
            .maybeSingle();
        if (error) return null;
        return (data as { id: string } | null)?.id ?? null;
    } catch {
        return null;
    }
}

/** The agent's knowledge base, made on first use. Throws on database errors. */
export async function ensureAgentKnowledgeBase(supabase: Admin, opts: { projectId: string; agentId: string; agentName: string }): Promise<string> {
    const find = () => supabase.from('knowledge_bases').select('id').eq('agent_id', opts.agentId).is('tenant_id', null).maybeSingle();
    const { data: existing, error: findError } = await find();
    if (findError) throw findError;
    if (existing) return (existing as { id: string }).id;
    const { data, error } = await supabase
        .from('knowledge_bases')
        .insert({ project_id: opts.projectId, agent_id: opts.agentId, tenant_id: null, scope_type: 'platform', name: `${opts.agentName} knowledge`.slice(0, 200), retention_policy: {} })
        .select('id')
        .single();
    if (error) {
        // Two first uploads at once: the other one made it.
        if (error.code === '23505') {
            const { data: raced } = await find();
            if (raced) return (raced as { id: string }).id;
        }
        throw error;
    }
    return (data as { id: string }).id;
}
