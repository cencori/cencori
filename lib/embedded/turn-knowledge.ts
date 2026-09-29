import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export interface TurnCitation {
    chunk_id: string;
    source_id: string;
    ord?: number | null;
    score: number;
}

export interface TurnKnowledge {
    block: string | null;
    citations: TurnCitation[];
}

export const TURN_KNOWLEDGE_MAX_KBS = 3;
export const TURN_KNOWLEDGE_TOP_K = 3;
export const TURN_KNOWLEDGE_MAX_CITATIONS = 5;
export const TURN_SKILLS_MAX_CHARS = 4000;
export const TURN_SKILLS_MAX_COUNT = 5;

export function buildKnowledgeBlock(snippets: string[]): string | null {
    if (snippets.length === 0) return null;
    return (
        `Company knowledge relevant to this request. Ground factual claims in these sources and cite them with [#] markers matching the numbers below.\n\n` +
        snippets.map((s, i) => `[${i + 1}] ${s}`).join('\n')
    );
}

export interface TurnSkills {
    block: string | null;
    skill_version_ids: string[];
    /** True when the read failed as opposed to finding no skills. */
    failed?: boolean;
}

async function liveInstallationVersionId(supabase: Admin, installationId: string): Promise<string | null> {
    const { data: ins } = await supabase
        .from('agent_installations')
        .select('agent_version_id')
        .eq('id', installationId)
        .maybeSingle();
    return (ins as { agent_version_id?: string | null } | null)?.agent_version_id ?? null;
}

/**
 * Load published skill contents pinned to the session's installed agent
 * version. Tenant-private skills load only for their own tenant. Best-effort:
 * empty on any failure. Skills are passive procedures — never credentials.
 *
 * Pass the run's submitted version id when one exists: the installation's
 * live version may have moved since the run was queued, and queued work must
 * execute the configuration it was submitted with.
 */
export async function retrieveTurnSkills(
    supabase: Admin,
    opts: { installationId: string | null; tenantId: string | null; versionId?: string | null },
): Promise<TurnSkills> {
    const empty: TurnSkills = { block: null, skill_version_ids: [] };
    if (!opts.installationId) return empty;
    const failed = (cause: unknown): TurnSkills => {
        console.warn('[TurnSkills] Skill read failed (returning empty, flagged):', cause instanceof Error ? cause.message : cause);
        return { block: null, skill_version_ids: [], failed: true };
    };
    try {
        const versionId = opts.versionId ?? await liveInstallationVersionId(supabase, opts.installationId);
        if (!versionId) return empty;
        const { data: pins } = await supabase
            .from('agent_version_skills')
            .select('skill_version_id')
            .eq('agent_version_id', versionId)
            .limit(TURN_SKILLS_MAX_COUNT);
        const ids = ((pins ?? []) as Array<{ skill_version_id: string }>).map((p) => p.skill_version_id);
        if (ids.length === 0) return empty;
        const { data: versions } = await supabase
            .from('skill_versions')
            .select('id, content, status, skill_id')
            .in('id', ids)
            .eq('status', 'published');
        // Two queries, never an embedded join: skills links skill_versions
        // both ways, which PostgREST rejects as ambiguous.
        const skillIds = [...new Set(((versions ?? []) as Array<{ skill_id?: string }>).map((v) => v.skill_id).filter(Boolean))] as string[];
        const { data: parents } = skillIds.length > 0
            ? await supabase.from('skills').select('id, tenant_id, status').in('id', skillIds)
            : { data: [] as Array<Record<string, unknown>> };
        const parentById = new Map(((parents ?? []) as Array<{ id: string; tenant_id: string | null; status: string }>).map((s) => [s.id, s]));
        interface UsableSkill {
            id: string;
            content: string;
            skills: { tenant_id: string | null; status: string };
        }
        const usable: UsableSkill[] = (
            ((versions ?? []) as unknown as Array<{ id: string; content: string; skill_id: string }>).map((v) => ({
                ...v,
                skills: parentById.get(v.skill_id) ?? null,
            })) as Array<{ id: string; content: string; skills: { tenant_id: string | null; status: string } | null }>
        )
            .filter((v): v is { id: string; content: string; skills: { tenant_id: string | null; status: string } } => v.skills !== null)
            .filter((v) => (v.skills.status ?? 'active') !== 'archived')
            // Fail closed: a tenant-private skill loads only on exact tenant
            // match. Missing session tenant context loads nothing private.
            .filter((v) => !v.skills.tenant_id || (opts.tenantId !== null && v.skills.tenant_id === opts.tenantId));
        if (usable.length === 0) return empty;
        let chars = 0;
        const parts: string[] = [];
        const used: string[] = [];
        for (const v of usable.slice(0, TURN_SKILLS_MAX_COUNT)) {
            const text = (v.content ?? '').slice(0, TURN_SKILLS_MAX_CHARS - chars);
            if (!text) continue;
            parts.push(text);
            used.push(v.id);
            chars += text.length;
            if (chars >= TURN_SKILLS_MAX_CHARS) break;
        }
        if (parts.length === 0) return empty;
        return {
            block: `Agent skills (passive procedures to follow when relevant):\n\n${parts.join('\n\n---\n\n')}`,
            skill_version_ids: used,
        };
    } catch (e) {
        return failed(e);
    }
}

/**
 * Retrieve installation-bound knowledge for a session turn. Best-effort:
 * returns empty citations on any failure so retrieval never blocks the turn.
 * Tenant isolation holds because chunks are filtered by knowledge_base_id,
 * and bindings are installation-scoped (verified at session creation).
 */
export async function retrieveTurnKnowledge(
    supabase: Admin,
    opts: { projectId: string; organizationId: string; installationId: string | null; queryText: string },
): Promise<TurnKnowledge> {
    const empty: TurnKnowledge = { block: null, citations: [] };
    if (!opts.installationId || !opts.queryText.trim()) return empty;
    try {
        const { data: bindings } = await supabase
            .from('installation_knowledge_bases')
            .select('knowledge_base_id')
            .eq('installation_id', opts.installationId)
            .limit(TURN_KNOWLEDGE_MAX_KBS);
        const kbIds = ((bindings ?? []) as Array<{ knowledge_base_id: string }>).map((b) => b.knowledge_base_id);
        if (kbIds.length === 0) return empty;

        const { embedForMemory } = await import('@/lib/memory/embeddings');
        const embedded = await embedForMemory(supabase as never, opts.projectId, opts.organizationId, opts.queryText.slice(0, 2000));
        const vector = `[${embedded.embeddings[0].join(',')}]`;

        const citations: TurnCitation[] = [];
        const snippets: string[] = [];
        for (const kbId of kbIds) {
            const { data: hits, error } = await supabase.rpc('match_knowledge_chunks', {
                p_knowledge_base_id: kbId,
                p_query_embedding: vector,
                p_match_count: TURN_KNOWLEDGE_TOP_K,
            });
            if (error) continue;
            for (const h of (hits ?? []) as Array<{ id: string; source_id: string; ord?: number | null; content: string; similarity: number }>) {
                citations.push({ chunk_id: h.id, source_id: h.source_id, ord: h.ord ?? null, score: h.similarity });
                snippets.push(h.content.slice(0, 500));
                if (citations.length >= TURN_KNOWLEDGE_MAX_CITATIONS) break;
            }
            if (citations.length >= TURN_KNOWLEDGE_MAX_CITATIONS) break;
        }
        return { block: buildKnowledgeBlock(snippets), citations };
    } catch {
        return empty;
    }
}
