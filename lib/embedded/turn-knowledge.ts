import type { createAdminClient } from '@/lib/supabaseAdmin';
import type { MemoryEmbeddingResult } from '@/lib/memory/embeddings';
// Passages go to the model whole. Cutting them shorter than they were
// chunked drops facts the search matched on (it used to keep 500 of 1000).
import { KNOWLEDGE_CHUNK_SIZE } from './knowledge';
import { agentKnowledgeBaseId } from './agent-knowledge';

type Admin = ReturnType<typeof createAdminClient>;

export interface TurnCitation {
    chunk_id: string;
    source_id: string;
    ord?: number | null;
    page?: number | null;
    score: number;
}

interface KnowledgeHit {
    id: string;
    source_id: string;
    ord?: number | null;
    page?: number | null;
    content: string;
    similarity: number;
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
 * Retrieve cited chunks from caller-named knowledge bases (chat completions'
 * `knowledge_bases` field). The caller has already checked the ids belong to
 * the project. All bases are searched in parallel and the best hits overall
 * are kept, so one large base can't crowd out a better match in another.
 * Fail-open like memory: any failure yields an empty result.
 */
export async function retrieveKnowledge(
    supabase: Admin,
    opts: {
        projectId: string;
        organizationId: string;
        knowledgeBaseIds: string[];
        queryText: string;
        onEmbeddingUsage?: (usage: MemoryEmbeddingResult) => void;
    },
): Promise<TurnKnowledge> {
    return searchKnowledgeBases(supabase, { ...opts, knowledgeBaseIds: opts.knowledgeBaseIds.slice(0, TURN_KNOWLEDGE_MAX_KBS) });
}

/** Search every base in parallel and keep the best hits overall. Fail-open. */
async function searchKnowledgeBases(
    supabase: Admin,
    opts: {
        projectId: string;
        organizationId: string;
        knowledgeBaseIds: string[];
        queryText: string;
        onEmbeddingUsage?: (usage: MemoryEmbeddingResult) => void;
    },
): Promise<TurnKnowledge> {
    const empty: TurnKnowledge = { block: null, citations: [] };
    const kbIds = opts.knowledgeBaseIds;
    if (kbIds.length === 0 || !opts.queryText.trim()) return empty;
    try {
        const { embedForMemory } = await import('@/lib/memory/embeddings');
        const embedded = await embedForMemory(supabase as never, opts.projectId, opts.organizationId, opts.queryText.slice(0, 2000));
        opts.onEmbeddingUsage?.(embedded);
        const vector = `[${embedded.embeddings[0].join(',')}]`;

        const results = await Promise.all(kbIds.map(async (kbId) => {
            const { data, error } = await supabase.rpc('match_knowledge_chunks', {
                p_knowledge_base_id: kbId,
                p_query_embedding: vector,
                p_match_count: TURN_KNOWLEDGE_MAX_CITATIONS,
            });
            return error ? [] : ((data ?? []) as KnowledgeHit[]);
        }));
        const hits = results.flat()
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, TURN_KNOWLEDGE_MAX_CITATIONS);

        return {
            block: buildKnowledgeBlock(hits.map((h) => h.content.slice(0, KNOWLEDGE_CHUNK_SIZE))),
            citations: hits.map((h) => ({
                chunk_id: h.id,
                source_id: h.source_id,
                ord: h.ord ?? null,
                page: h.page ?? null,
                score: h.similarity,
            })),
        };
    } catch {
        return empty;
    }
}

/**
 * Knowledge for one agent turn: the agent's own knowledge base (shared by all
 * its customers) plus whatever is bound to the customer's installation.
 * Best-effort: any failure yields an empty result so retrieval never blocks
 * the turn. Tenant isolation holds because installation bindings are
 * installation-scoped (verified at session creation) and the agent's base
 * holds no customer data.
 */
/**
 * Messages that are only a greeting, thanks or a one-word acknowledgement.
 * Nothing in a knowledge base answers them, so the turn skips the lookup and
 * its embedding call. Only a whole-message match counts: "hi, what does it
 * cost?" still searches.
 */
const SMALL_TALK = /^(hi+|hello+|hey+|hiya|howdy|yo|sup|what'?s up|good (morning|afternoon|evening|day)|how are you( doing)?|thanks?( you)?( so much| a lot)?|thx|ty|ok(ay)?|k|cool|great|nice|awesome|perfect|got it|sounds good|bye|goodbye|see you|cheers|yes|yeah|yep|no|nope|sure)( there| again| team| all| everyone)?$/;

export function isSmallTalk(text: string): boolean {
    const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
    return normalized.length > 0 && SMALL_TALK.test(normalized);
}

/**
 * Which knowledge bases a turn searches barely changes, so it's reused for a
 * short while instead of costing database calls on every turn. A base added
 * or removed shows up within the TTL.
 */
const KB_IDS_TTL_MS = 30_000;
const kbIdsCache = new Map<string, { ids: string[]; expiresAt: number }>();

export function clearKnowledgeBaseIdsCacheForTests(): void {
    kbIdsCache.clear();
}

async function turnKnowledgeBaseIds(supabase: Admin, agentId: string | null | undefined, installationId: string | null): Promise<string[]> {
    const key = `${agentId ?? ''}:${installationId ?? ''}`;
    const cached = kbIdsCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.ids;
    const [agentKbId, bindings] = await Promise.all([
        agentKnowledgeBaseId(supabase, agentId),
        installationId
            ? supabase.from('installation_knowledge_bases').select('knowledge_base_id').eq('installation_id', installationId).limit(TURN_KNOWLEDGE_MAX_KBS)
            : Promise.resolve({ data: [] as Array<{ knowledge_base_id: string }> }),
    ]);
    const bound = ((bindings.data ?? []) as Array<{ knowledge_base_id: string }>).map((b) => b.knowledge_base_id);
    const ids = [...new Set([...(agentKbId ? [agentKbId] : []), ...bound])];
    kbIdsCache.set(key, { ids, expiresAt: Date.now() + KB_IDS_TTL_MS });
    if (kbIdsCache.size > 5_000) {
        const oldest = kbIdsCache.keys().next().value;
        if (oldest !== undefined) kbIdsCache.delete(oldest);
    }
    return ids;
}

export async function retrieveTurnKnowledge(
    supabase: Admin,
    opts: { projectId: string; organizationId: string; installationId: string | null; agentId?: string | null; queryText: string },
): Promise<TurnKnowledge> {
    const empty: TurnKnowledge = { block: null, citations: [] };
    if ((!opts.installationId && !opts.agentId) || !opts.queryText.trim() || isSmallTalk(opts.queryText)) return empty;
    try {
        const kbIds = await turnKnowledgeBaseIds(supabase, opts.agentId, opts.installationId);
        // Nothing to search: skip the embedding call, which is billed work.
        if (kbIds.length === 0) return empty;
        return await searchKnowledgeBases(supabase, { ...opts, knowledgeBaseIds: kbIds });
    } catch {
        return empty;
    }
}
