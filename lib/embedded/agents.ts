import crypto from 'crypto';
import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export interface AgentVersionConfig {
    model?: string;
    instructions?: string;
    system_prompt?: string;
    tools?: string[];
    temperature?: number;
    max_output_tokens?: number;
    approval_defaults?: Record<string, unknown>;
    memory_defaults?: Record<string, unknown>;
    knowledge_refs?: string[];
    [key: string]: unknown;
}

export function checksumConfig(config: AgentVersionConfig): string {
    return crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

/**
 * Pin an agent version's skill references as durable join rows (used for
 * turn-time loading and audit). Refs must already be validated as published.
 */
export async function syncAgentVersionSkills(
    supabase: Admin,
    agentVersionId: string,
    skillVersionIds: string[],
): Promise<void> {
    await supabase.from('agent_version_skills').delete().eq('agent_version_id', agentVersionId);
    const clean = [...new Set(skillVersionIds.map((id) => id.replace(/^(skv_)/, '')))];
    for (const skillVersionId of clean) {
        const { error } = await supabase.from('agent_version_skills').insert({ agent_version_id: agentVersionId, skill_version_id: skillVersionId });
        if (error) throw new Error(`Failed to pin skill reference: ${error.message}`);
    }
}

/**
 * Pin an agent version's allowed subagent edges. Every child is re-verified
 * in-project and published here so edges can never smuggle a foreign version
 * even if validation was bypassed.
 */
export async function syncAgentVersionSubagents(
    supabase: Admin,
    agentVersionId: string,
    subagents: Array<{ agent_version_id: string; max_calls?: number }>,
    projectId?: string,
): Promise<void> {
    const clean: Array<{ id: string; max_calls: number }> = [];
    const seen = new Set<string>();
    for (const sub of subagents) {
        const childId = sub.agent_version_id.replace(/^(agv_)/, '');
        if (seen.has(childId)) continue;
        seen.add(childId);
        if (projectId) {
            const { data: child } = await supabase
                .from('agent_versions')
                .select('id, status, agents!inner(id, project_id)')
                .eq('id', childId)
                .eq('agents.project_id', projectId)
                .maybeSingle();
            if (!child || (child.status as string) !== 'published') {
                throw new Error(`Subagent version '${sub.agent_version_id}' is not published in this project`);
            }
        }
        clean.push({ id: childId, max_calls: Math.min(25, Math.max(1, sub.max_calls ?? 1)) });
    }
    await supabase.from('agent_version_subagents').delete().eq('parent_agent_version_id', agentVersionId);
    for (const { id, max_calls } of clean) {
        const { error } = await supabase.from('agent_version_subagents').insert({
            parent_agent_version_id: agentVersionId,
            child_agent_version_id: id,
            max_calls,
        });
        if (error) throw new Error(`Failed to pin subagent edge: ${error.message}`);
    }
}

/** BFS over delegation edges for indirect cycles (bounded, project-scoped, read-only). */
export async function delegationReachesAgent(
    supabase: Admin,
    fromVersionId: string,
    targetAgentId: string,
    maxDepth = 8,
    projectId?: string,
): Promise<boolean> {
    let frontier = [fromVersionId];
    const visited = new Set<string>([fromVersionId]);
    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
        const { data: edges } = await supabase
            .from('agent_version_subagents')
            .select('child_agent_version_id')
            .in('parent_agent_version_id', frontier);
        const children = ((edges ?? []) as Array<{ child_agent_version_id: string }>).map((e) => e.child_agent_version_id).filter((id) => !visited.has(id));
        if (children.length === 0) return false;
        let query = supabase.from('agent_versions').select('id, agent_id').in('id', children);
        if (projectId) query = query.eq('project_id', projectId) as typeof query;
        const { data: versions } = await query;
        for (const v of (versions ?? []) as Array<{ id: string; agent_id: string }>) {
            visited.add(v.id);
            if (v.agent_id === targetAgentId) return true;
        }
        frontier = children;
    }
    return false;
}

export function validateVersionConfig(config: AgentVersionConfig): { ok: true } | { ok: false; message: string } {
    if (config.model !== undefined && (typeof config.model !== 'string' || !config.model.trim())) {
        return { ok: false, message: 'config.model must be a non-empty string' };
    }
    const instructions = config.instructions ?? config.system_prompt;
    if (instructions !== undefined && typeof instructions !== 'string') {
        return { ok: false, message: 'config.instructions must be a string' };
    }
    if (config.tools !== undefined && (!Array.isArray(config.tools) || !config.tools.every((t) => typeof t === 'string'))) {
        return { ok: false, message: 'config.tools must be a string array' };
    }
    if (config.temperature !== undefined && (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)) {
        return { ok: false, message: 'config.temperature must be 0–2' };
    }
    return { ok: true };
}

/** Resolve runtime config: installation pin → stable → latest published → legacy agent_configs. */
export async function resolveAgentRuntimeConfig(
    supabase: Admin,
    opts: { agentId: string; installationVersionId?: string | null; updateChannel?: string | null },
): Promise<{ versionId: string | null; version: string | null; config: AgentVersionConfig | null; source: 'installation' | 'stable' | 'latest' | 'legacy' | 'none' }> {
    if (opts.installationVersionId) {
        const { data } = await supabase.from('agent_versions').select('id, version, config_json').eq('id', opts.installationVersionId).maybeSingle();
        if (data) return { versionId: data.id as string, version: data.version as string, config: (data.config_json ?? {}) as AgentVersionConfig, source: 'installation' };
    }
    if (opts.updateChannel === 'stable') {
        const { data: agent } = await supabase.from('agents').select('stable_version_id').eq('id', opts.agentId).maybeSingle();
        const stableId = (agent?.stable_version_id as string | null) ?? null;
        if (stableId) {
            const { data } = await supabase.from('agent_versions').select('id, version, config_json').eq('id', stableId).maybeSingle();
            if (data) return { versionId: data.id as string, version: data.version as string, config: (data.config_json ?? {}) as AgentVersionConfig, source: 'stable' };
        }
    }
    const { data: latest } = await supabase
        .from('agent_versions')
        .select('id, version, config_json')
        .eq('agent_id', opts.agentId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (latest) return { versionId: latest.id as string, version: latest.version as string, config: (latest.config_json ?? {}) as AgentVersionConfig, source: 'latest' };
    const { data: legacy } = await supabase.from('agent_configs').select('model, system_prompt, tools, temperature').eq('agent_id', opts.agentId).maybeSingle();
    if (legacy) {
        return {
            versionId: null,
            version: null,
            config: {
                model: (legacy.model as string) ?? 'gpt-4o',
                instructions: (legacy.system_prompt as string) ?? undefined,
                tools: (legacy.tools as string[]) ?? [],
                temperature: (legacy.temperature as number) ?? 0.7,
            },
            source: 'legacy',
        };
    }
    return { versionId: null, version: null, config: null, source: 'none' };
}
