/**
 * Knowledge bases (RAG) on chat: shared by /v1/chat/completions and the
 * native /api/ai/chat so both validate, retrieve, bill and cite the same way.
 *
 * Only project-wide (platform) bases are readable on chat. Tenant-scoped
 * bases stay behind Sessions/agent installations, where the tenant binding is
 * checked. Publishable keys ship to browsers, so they can't pull knowledge
 * into a prompt anyone could then ask to repeat.
 */

import { waitUntil } from '@vercel/functions';
import { incrementUsage, logGatewayRequest, type GatewayContext } from '@/lib/gateway-middleware';
import { promptPayload } from '@/lib/gateway/log-payload';
import { dePrefixId, withPrefix } from '@/lib/embedded/http';
import { retrieveKnowledge, TURN_KNOWLEDGE_MAX_KBS, type TurnKnowledge } from '@/lib/embedded/turn-knowledge';
import type { UnifiedMessage } from '@/lib/providers/base';
import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export interface KnowledgeCitation {
    /** Matches the `[n]` marker the model is told to cite with. */
    n: number;
    chunk_id: string;
    source_id: string;
    ord: number | null;
    page: number | null;
    score: number;
}

export type KnowledgeRequest =
    | { ok: true; ids: string[] }
    | { ok: false; status: number; code: string; message: string };

export const EMPTY_KNOWLEDGE: TurnKnowledge = { block: null, citations: [] };

/** Validate a request's knowledge base ids against the calling project. */
export async function resolveRequestedKnowledgeBases(
    supabase: Admin,
    ctx: Pick<GatewayContext, 'projectId' | 'keyType'>,
    value: unknown,
): Promise<KnowledgeRequest> {
    if (!Array.isArray(value) || value.length === 0 || !value.every((id) => typeof id === 'string' && id.trim())) {
        return { ok: false, status: 400, code: 'invalid_knowledge_bases', message: 'knowledge_bases must be a non-empty array of knowledge base ids.' };
    }
    if (value.length > TURN_KNOWLEDGE_MAX_KBS) {
        return { ok: false, status: 400, code: 'invalid_knowledge_bases', message: `knowledge_bases accepts at most ${TURN_KNOWLEDGE_MAX_KBS} ids.` };
    }
    if (ctx.keyType === 'publishable') {
        return { ok: false, status: 403, code: 'secret_key_required', message: 'knowledge_bases requires a secret project key.' };
    }

    const ids = [...new Set((value as string[]).map((id) => dePrefixId(id.trim())))];
    const { data, error } = await supabase
        .from('knowledge_bases')
        .select('id, tenant_id')
        .eq('project_id', ctx.projectId)
        .in('id', ids);
    if (error) {
        return { ok: false, status: 500, code: 'knowledge_bases_unavailable', message: 'Failed to load knowledge bases.' };
    }
    const found = new Map(((data ?? []) as Array<{ id: string; tenant_id: string | null }>).map((kb) => [kb.id, kb]));
    const missing = ids.find((id) => !found.has(id));
    if (missing) {
        return { ok: false, status: 404, code: 'knowledge_base_not_found', message: `Knowledge base '${withPrefix('kb', missing)}' not found.` };
    }
    const tenantScoped = ids.find((id) => found.get(id)?.tenant_id);
    if (tenantScoped) {
        return {
            ok: false,
            status: 403,
            code: 'tenant_scope_mismatch',
            message: `Knowledge base '${withPrefix('kb', tenantScoped)}' is tenant-scoped; query it through a session on its agent installation.`,
        };
    }
    return { ok: true, ids };
}

/**
 * Search the bases with the user's latest message, billing the query
 * embedding like memory retrieval does. Fail-open: no hits means the request
 * runs ungrounded.
 */
export function startKnowledgeRetrieval(
    supabase: Admin,
    ctx: GatewayContext,
    knowledgeBaseIds: string[],
    queryText: string,
): Promise<TurnKnowledge> {
    if (knowledgeBaseIds.length === 0) return Promise.resolve(EMPTY_KNOWLEDGE);
    return retrieveKnowledge(supabase, {
        projectId: ctx.projectId,
        organizationId: ctx.organizationId,
        knowledgeBaseIds,
        queryText,
        onEmbeddingUsage: (usage) => {
            waitUntil(Promise.all([
                logGatewayRequest(ctx, {
                    endpoint: 'knowledge/search',
                    model: usage.model,
                    provider: usage.provider,
                    status: 'success',
                    promptTokens: usage.totalTokens,
                    completionTokens: 0,
                    totalTokens: usage.totalTokens,
                    costUsd: usage.cencoriChargeUsd,
                    providerCostUsd: usage.providerCostUsd,
                    cencoriChargeUsd: usage.cencoriChargeUsd,
                    markupPercentage: usage.markupPercentage,
                    metadata: { source: 'chat_knowledge_retrieval' },
                    requestPayload: promptPayload(queryText, { model: usage.model }),
                }),
                incrementUsage(ctx, usage.cencoriChargeUsd),
            ]).then(() => undefined));
        },
    });
}

/**
 * Insert the cited block after the leading system messages (which include
 * any memory block), before the first non-system turn. Mutates `messages`.
 */
export function injectKnowledge(messages: UnifiedMessage[], knowledge: TurnKnowledge): void {
    if (!knowledge.block) return;
    let insertAt = 0;
    while (insertAt < messages.length && messages[insertAt].role === 'system') insertAt++;
    messages.splice(insertAt, 0, { role: 'system', content: knowledge.block });
}

export function knowledgeCitations(knowledge: TurnKnowledge): KnowledgeCitation[] {
    return knowledge.citations.map((c, i) => ({
        n: i + 1,
        chunk_id: c.chunk_id,
        source_id: withPrefix('src', c.source_id),
        ord: c.ord ?? null,
        page: c.page ?? null,
        score: c.score,
    }));
}

/** The `knowledge` object returned on non-streaming responses. */
export function knowledgeResponseField(knowledgeBaseIds: string[], citations: KnowledgeCitation[]) {
    return {
        knowledge_bases: knowledgeBaseIds.map((id) => withPrefix('kb', id)),
        citations,
    };
}

/** Streaming responses carry citations in this header, sent before the first token. */
export const KNOWLEDGE_CITATIONS_HEADER = 'X-Cencori-Knowledge-Citations';
