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
