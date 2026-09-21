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
}

/**
 * Load published skill contents pinned to the session's installed agent
 * version. Tenant-private skills load only for their own tenant. Best-effort:
 * empty on any failure. Skills are passive procedures — never credentials.
 */
export async function retrieveTurnSkills(
    supabase: Admin,
    opts: { installationId: string | null; tenantId: string | null },
): Promise<TurnSkills> {
    const empty: TurnSkills = { block: null, skill_version_ids: [] };
    if (!opts.installationId) return empty;
    try {
        const { data: ins } = await supabase
            .from('agent_installations')
            .select('agent_version_id')
            .eq('id', opts.installationId)
            .maybeSingle();
        const versionId = (ins as { agent_version_id?: string | null } | null)?.agent_version_id;
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
            .select('id, content, status, skills!inner(id, tenant_id, status)')
            .in('id', ids)
            .eq('status', 'published');
        const usable = ((versions ?? []) as unknown as Array<{ id: string; content: string; skills: { tenant_id: string | null; status: string } | Array<{ tenant_id: string | null; status: string }> }>)
            .map((v) => ({ ...v, skills: Array.isArray(v.skills) ? v.skills[0] : v.skills }))
            .filter((v) => v.skills && (v.skills.status ?? 'active') !== 'archived')
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
    } catch {
        return empty;
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
