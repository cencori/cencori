/**
 * POST /api/projects/:projectId/embedded-agents/:agentId/knowledge/search
 *
 * "Test retrieval": the passages a question would pull from the agent's
 * knowledge, with their scores, so you can see what the agent will be given.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { embedForMemory } from '@/lib/memory/embeddings';
import { isMissingAgentKnowledgeColumn } from '@/lib/embedded/agent-knowledge';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const TOP_K = 5;

type Hit = { id: string; source_id: string; ord: number | null; page: number | null; content: string; similarity: number };

export async function POST(request: Request, ctx: { params: Promise<{ projectId: string; agentId: string }> }) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const body = await request.json().catch(() => null) as { query?: unknown } | null;
    const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 2000) : '';
    if (!query) return fail('Type a question to test.');

    const db = createAdminClient();
    const { data: kb, error } = await db.from('knowledge_bases').select('id').eq('project_id', projectId).eq('agent_id', agentId).is('tenant_id', null).maybeSingle();
    if (error) return isMissingAgentKnowledgeColumn(error) ? fail('Agent knowledge needs a database update.', 503) : fail('Could not search knowledge.', 502);
    if (!kb) return NextResponse.json({ results: [] });
    const kbId = (kb as { id: string }).id;

    let vector: string;
    try {
        const embedded = await embedForMemory(db as never, projectId, access.organizationId, query);
        vector = `[${embedded.embeddings[0].join(',')}]`;
    } catch (cause) {
        return fail(cause instanceof Error ? cause.message : 'Search is unavailable right now.', 502);
    }
    const { data: hits, error: matchError } = await db.rpc('match_knowledge_chunks', { p_knowledge_base_id: kbId, p_query_embedding: vector, p_match_count: TOP_K });
    if (matchError) return fail('Search is unavailable right now.', 502);

    const rows = (hits ?? []) as Hit[];
    const sourceIds = [...new Set(rows.map((hit) => hit.source_id))];
    const { data: sources } = sourceIds.length
        ? await db.from('knowledge_sources').select('id,metadata').in('id', sourceIds)
        : { data: [] };
    const names = new Map(((sources ?? []) as Array<{ id: string; metadata: { name?: string; filename?: string } | null }>)
        .map((source) => [source.id, source.metadata?.name ?? source.metadata?.filename ?? 'Untitled']));

    return NextResponse.json({
        results: rows.map((hit) => ({
            id: hit.id,
            source_id: hit.source_id,
            source_name: names.get(hit.source_id) ?? 'Untitled',
            page: hit.page ?? null,
            score: hit.similarity,
            content: hit.content,
        })),
    });
}
