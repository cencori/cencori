import type { createAdminClient } from '@/lib/supabaseAdmin';
import { buildUnifiedModelRegistry } from './model-registry';

type Admin = ReturnType<typeof createAdminClient>;

export const REASONING_EFFORTS = ['low', 'medium', 'high'] as const;

export interface CapabilityManifest {
    model?: string;
    reasoning_effort?: string;
    fallback_policy?: { model?: string; on?: string[] };
    instructions?: string;
    skills: Array<{ skill_version_id: string }>;
    tools: Array<{ type: string; name: string }>;
    connection_requirements: Array<{ connector: string; scopes: string[] }>;
    mcp_tools: Array<{ server_id: string; tool: string }>;
    subagents: Array<{ agent_version_id: string; max_calls?: number }>;
    policy: {
        browser: { enabled: boolean };
        network: { mode: 'none' | 'allowlist'; allowed_hosts: string[] };
        max_delegation_depth: number;
        require_approval: string[];
    };
    input_schema?: Record<string, unknown>;
    output_schema?: Record<string, unknown>;
}

/** Normalize legacy + manifest configs into one canonical manifest. */
export function normalizeManifest(config: Record<string, unknown>): CapabilityManifest {
    const c = config as Record<string, unknown> & {
        instructions?: string; system_prompt?: string; skills?: unknown; tools?: unknown;
        connection_requirements?: unknown; mcp_tools?: unknown; subagents?: unknown; policy?: unknown;
    };
    const tools = Array.isArray(c.tools)
        ? (c.tools as unknown[]).map((t) => typeof t === 'string' ? { type: 'builtin', name: t } : (t as { type?: string; name?: string })).filter((t) => t.name).map((t) => ({ type: t.type ?? 'builtin', name: t.name as string }))
        : [];
    const policy = (c.policy ?? {}) as Record<string, unknown>;
    const browser = (policy.browser ?? {}) as { enabled?: boolean };
    const network = (policy.network ?? {}) as { mode?: string; allowed_hosts?: string[] };
    return {
        model: c.model as string | undefined,
        reasoning_effort: c.reasoning_effort as string | undefined,
        fallback_policy: c.fallback_policy as CapabilityManifest['fallback_policy'],
        instructions: (c.instructions ?? c.system_prompt) as string | undefined,
        skills: Array.isArray(c.skills) ? (c.skills as Array<{ skill_version_id?: string }>).filter((s) => s?.skill_version_id).map((s) => ({ skill_version_id: s.skill_version_id as string })) : [],
        tools,
        connection_requirements: Array.isArray(c.connection_requirements)
            ? (c.connection_requirements as Array<{ connector?: string; scopes?: string[] }>).filter((r) => r?.connector).map((r) => ({ connector: r.connector as string, scopes: r.scopes ?? [] }))
            : [],
        mcp_tools: Array.isArray(c.mcp_tools)
            ? (c.mcp_tools as Array<{ server_id?: string; tool?: string }>).filter((m) => m?.server_id && m?.tool).map((m) => ({ server_id: m.server_id as string, tool: m.tool as string }))
            : [],
        subagents: Array.isArray(c.subagents)
            ? (c.subagents as Array<{ agent_version_id?: string; max_calls?: number }>).filter((s) => s?.agent_version_id).map((s) => ({ agent_version_id: s.agent_version_id as string, max_calls: s.max_calls ?? 1 }))
            : [],
        policy: {
            browser: { enabled: browser.enabled ?? false },
            network: {
                mode: network.mode === 'allowlist' ? 'allowlist' : 'none',
                allowed_hosts: Array.isArray(network.allowed_hosts) ? network.allowed_hosts : [],
            },
            max_delegation_depth: typeof policy.max_delegation_depth === 'number' ? policy.max_delegation_depth : 0,
            require_approval: Array.isArray(policy.require_approval) ? (policy.require_approval as string[]) : [],
        },
        input_schema: c.input_schema as Record<string, unknown> | undefined,
        output_schema: (c.output_schema ?? c.response_format) as Record<string, unknown> | undefined,
    };
}

export interface ManifestValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

const dePrefix = (v: string) => v.replace(/^(mcp_|con_|agv_)/, '');

/**
 * Deterministic manifest validation: no external side effects (no DNS, no
 * inference, no credential use). Returns errors (blocking) + warnings.
 */
export async function validateManifest(
    supabase: Admin,
    opts: { projectId: string; agentId: string; manifest: CapabilityManifest },
): Promise<ManifestValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const m = opts.manifest;

    // Model: must resolve in the unified registry and be available.
    if (!m.model?.trim()) {
        errors.push('manifest.model is required');
    } else {
        try {
            const registry = await buildUnifiedModelRegistry(supabase, { projectId: opts.projectId });
            const match = registry.models.find((row) => row.id === m.model || `${row.provider}/${row.id}` === m.model || row.id === (m.model as string).split('/').pop());
            if (!match) {
                errors.push(`model '${m.model}' is not in the project registry`);
            } else {
                if (!match.available) {
                    errors.push(`model '${m.model}' is not available: ${match.unavailable_reason ?? 'unknown'}`);
                }
                if (m.reasoning_effort !== undefined) {
                    if (!REASONING_EFFORTS.includes(m.reasoning_effort as never)) {
                        errors.push(`reasoning_effort must be one of ${REASONING_EFFORTS.join('|')}`);
                    } else if (!match.reasoning_supported) {
                        errors.push(`reasoning_effort requires a reasoning-capable model; '${m.model}' does not advertise reasoning`);
                    }
                }
            }
        } catch (e) {
            errors.push(`model registry lookup failed: ${e instanceof Error ? e.message : 'unknown'}`);
        }
    }

    // Skills: references must resolve to published, non-archived skill versions.
    for (const s of m.skills) {
        if (!s.skill_version_id.trim()) {
            errors.push('skill reference missing skill_version_id');
            continue;
        }
        const { data: sv } = await supabase
            .from('skill_versions')
            .select('id, status, skills!inner(id, project_id, status)')
            .eq('id', s.skill_version_id.replace(/^(skv_)/, ''))
            .maybeSingle();
        const row = sv as { id?: string; status?: string; skills?: { project_id?: string; status?: string } } | null;
        if (!row || row.skills?.project_id !== opts.projectId) {
            errors.push(`skill version '${s.skill_version_id}' not found in this project`);
        } else if (row.status !== 'published') {
            errors.push(`skill version '${s.skill_version_id}' is not published`);
        } else if (row.skills?.status === 'archived') {
            errors.push(`skill for version '${s.skill_version_id}' is archived`);
        }
    }

    // Connection requirements: connector must exist.
    for (const req of m.connection_requirements) {
        const { data: connector } = await supabase.from('connectors').select('slug').eq('slug', req.connector.toLowerCase()).maybeSingle();
        if (!connector) {
            errors.push(`unknown connector '${req.connector}'`);
        } else if (req.scopes.length === 0) {
            warnings.push(`connection requirement '${req.connector}' declares no scopes`);
        }
    }

    // MCP tools: server must exist in-project and the tool should be in a fresh snapshot.
    for (const ref of m.mcp_tools) {
        const { data: server } = await supabase.from('mcp_servers').select('id, status, tool_snapshot').eq('project_id', opts.projectId).eq('id', dePrefix(ref.server_id)).maybeSingle();
        if (!server) {
            errors.push(`MCP server '${ref.server_id}' not found in this project`);
            continue;
        }
        if ((server.status as string) !== 'active') {
            warnings.push(`MCP server '${ref.server_id}' is ${(server.status as string) ?? 'not active'}`);
        }
        const snapshot = ((server.tool_snapshot ?? {}) as { tools?: Array<{ name: string }> }).tools ?? [];
        if (snapshot.length > 0 && !snapshot.some((t) => t.name === ref.tool)) {
            errors.push(`MCP tool '${ref.tool}' is not in the discovery snapshot of '${ref.server_id}'`);
        } else if (snapshot.length === 0) {
            warnings.push(`MCP server '${ref.server_id}' has an empty tool snapshot; refresh discovery before publishing`);
        }
    }

    // Subagents: referenced versions must exist, be published, and not self-cycle.
    // Indirect cycles are detected against the pinned edge graph.
    for (const sub of m.subagents) {
        if (sub.max_calls !== undefined && (sub.max_calls < 1 || sub.max_calls > 25)) {
            errors.push(`subagent max_calls must be 1–25`);
        }
        const { data: child } = await supabase.from('agent_versions').select('id, agent_id, status').eq('id', dePrefix(sub.agent_version_id)).maybeSingle();
        if (!child) {
            errors.push(`subagent version '${sub.agent_version_id}' not found`);
            continue;
        }
        if ((child.status as string) !== 'published') {
            errors.push(`subagent version '${sub.agent_version_id}' is not published`);
        }
        if ((child.agent_id as string) === opts.agentId) {
            errors.push('subagent reference creates a direct self-cycle');
        }
    }
    if (m.subagents.length > 0) {
        const { delegationReachesAgent } = await import('./agents');
        for (const sub of m.subagents) {
            try {
                const reaches = await delegationReachesAgent(supabase, dePrefix(sub.agent_version_id), opts.agentId);
                if (reaches) {
                    errors.push(`subagent reference '${sub.agent_version_id}' creates an indirect delegation cycle`);
                    break;
                }
            } catch {
                warnings.push('delegation cycle check unavailable; runtime ancestry guard remains active');
                break;
            }
        }
    }
    if (m.subagents.length > 0 && m.policy.max_delegation_depth < 1) {
        warnings.push('subagents declared but max_delegation_depth is 0; delegation will be denied at runtime');
    }

    // Network policy: syntactic only (DNS rebinding enforced at runtime).
    if (m.policy.network.mode === 'allowlist') {
        if (m.policy.network.allowed_hosts.length === 0) {
            errors.push('network allowlist mode requires at least one allowed host');
        }
        for (const host of m.policy.network.allowed_hosts) {
            try {
                const url = new URL(host.includes('://') ? host : `https://${host}`);
                if (url.username || url.password) {
                    errors.push(`allowed host '${host}' must not embed credentials`);
                } else if (!['https:', 'http:'].includes(url.protocol)) {
                    errors.push(`allowed host '${host}' must be http(s)`);
                }
            } catch {
                errors.push(`allowed host '${host}' is not a valid hostname or URL`);
            }
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}
