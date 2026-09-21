import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { embedForMemory } from '@/lib/memory/embeddings';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/knowledge-bases/:id/search — grant-filtered vector search with chunk citations.
export async function POST(req: NextRequest, ctx: { params: Promise<{ knowledgeBaseId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { knowledgeBaseId } = await ctx.params;
    const supabase = createAdminClient();

    let body: { query?: string; top_k?: number; installation_id?: string };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.query?.trim()) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'query is required', { requestId }), { requestId });

    const { data: kb } = await supabase.from('knowledge_bases').select('id, project_id, tenant_id').eq('project_id', validation.context.projectId).eq('id', dePrefixId(knowledgeBaseId)).maybeSingle();
    if (!kb) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Knowledge base not found', { requestId }), { requestId });
    const kbId = (kb.id as string);
    const kbTenant = (kb.tenant_id as string | null) ?? null;

    // Grant check: platform KBs are open within project; tenant KBs require installation binding or explicit grant.
    if (kbTenant) {
        let authorized = false;
        if (body.installation_id) {
            const { data: binding } = await supabase.from('installation_knowledge_bases').select('installation_id').eq('installation_id', dePrefixId(body.installation_id)).eq('knowledge_base_id', kbId).maybeSingle();
            if (binding) {
                const { data: ins } = await supabase.from('agent_installations').select('id, tenant_id').eq('id', dePrefixId(body.installation_id)).eq('project_id', validation.context.projectId).maybeSingle();
                if (ins && (ins.tenant_id as string) === kbTenant) authorized = true;
            }
        }
        if (!authorized) {
            const { data: grants } = await supabase.from('knowledge_grants').select('id').eq('knowledge_base_id', kbId).limit(1);
            // M1: any grant on the KB + same-project caller counts when installation binding absent but caller asserts tenant scope.
            // Strict installation binding remains the recommended path; grants cover group/role/user cases in M2.
            if ((grants ?? []).length === 0) {
                return addGatewayHeaders(embeddedError(403, 'tenant_scope_mismatch', 'Knowledge base is not granted to this installation', { requestId }), { requestId });
            }
        }
    }

    const topK = Math.min(20, Math.max(1, body.top_k ?? 5));
    let queryEmbedding: number[];
    try {
        const embedded = await embedForMemory(supabase as never, validation.context.projectId, validation.context.organizationId, body.query.trim());
        queryEmbedding = embedded.embeddings[0];
    } catch (e) {
        return addGatewayHeaders(embeddedError(502, 'invalid_request_error', e instanceof Error ? e.message : 'Embedding failed', { requestId }), { requestId });
    }

    // Cosine similarity in SQL (mirrors gateway memory retrieval; tenant filter in final WHERE).
    const { data: chunks, error } = await supabase.rpc('match_knowledge_chunks', {
        p_knowledge_base_id: kbId,
        p_query_embedding: `[${queryEmbedding.join(',')}]`,
        p_match_count: topK,
    });
    if (error) {
        // Fallback when the RPC is not yet deployed (migration pending): keyword overlap.
        const { data: fallback } = await supabase.from('knowledge_chunks').select('id, source_id, ord, page, content').eq('knowledge_base_id', kbId).limit(50);
        const terms = body.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
        const scored = ((fallback ?? []) as Array<{ id: string; source_id: string; ord: number; page: number | null; content: string }>)
            .map((c) => ({ ...c, score: terms.reduce((s, t) => s + (c.content.toLowerCase().includes(t) ? 1 : 0), 0) / Math.max(1, terms.length) }))
            .filter((c) => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
        return addGatewayHeaders(
            NextResponse.json({ data: scored.map((c) => ({ chunk_id: c.id, source_id: withPrefix('src', c.source_id), ord: c.ord, page: c.page, score: c.score, content: c.content.slice(0, 1000) })), fallback: true }),
            { requestId },
        );
    }
    return addGatewayHeaders(
        NextResponse.json({
            data: ((chunks ?? []) as Array<{ id: string; source_id: string; ord: number; page: number | null; content: string; similarity: number }>).map((c) => ({
                chunk_id: c.id,
                source_id: withPrefix('src', c.source_id),
                ord: c.ord,
                page: c.page,
                score: c.similarity,
                content: c.content?.slice(0, 1000) ?? '',
            })),
        }),
        { requestId },
    );
}
