/**
 * GET /api/projects/:projectId/memory/graph/map — everything the dashboard's
 * graph canvas draws, across every end-user (or one, with ?userId=):
 *
 *   memories   — the user's facts, active and superseded (newest first, capped)
 *   updates    — superseded memory → the memory that replaced it
 *   entities   — what extraction found in those facts
 *   mentions   — memory → entity it names
 *   relations  — typed entity → entity edges
 *
 * Read-only. Every row carries its end-user, and edges only ever join rows of
 * the same end-user, so each user is drawn as their own cluster.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { createAdminClient } from '@/lib/supabaseAdmin';

/** Enough to read at a glance; a force layout past this turns into a hairball. */
const MAX_MEMORIES = 300;
const MAX_ENTITIES = 300;
const MENTION_ID_CHUNK = 100;

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    const url = new URL(req.url);
    const scopeKey = url.searchParams.get('userId')?.trim() || '';

    const supabase = createAdminClient();
    const scoped = (table: string, columns: string) => {
        const query = supabase.from(table)
            .select(columns)
            .eq('organization_id', access.organizationId)
            .eq('project_id', projectId)
            .eq('scope', 'user');
        return scopeKey ? query.eq('scope_key', scopeKey) : query;
    };

    try {
        const [memoryResult, entityResult, edgeResult] = await Promise.all([
            scoped('gateway_memories', 'id, scope_key, content, namespace, importance, access_count, status, superseded_by, created_at')
                .in('status', ['active', 'superseded'])
                .order('created_at', { ascending: false })
                .limit(MAX_MEMORIES),
            scoped('memory_entities', 'id, scope_key, name, entity_type, mention_count')
                .order('mention_count', { ascending: false })
                .limit(MAX_ENTITIES),
            scoped('memory_entity_edges', 'src_entity_id, dst_entity_id, relation'),
        ]);
        if (memoryResult.error) throw memoryResult.error;
        if (entityResult.error) throw entityResult.error;
        if (edgeResult.error) throw edgeResult.error;

        type MemoryRow = { id: string; scope_key: string; content: string; namespace: string | null; importance: number; access_count: number; status: string; superseded_by: string | null; created_at: string };
        type EntityRow = { id: string; scope_key: string; name: string; entity_type: string; mention_count: number };
        type EdgeRow = { src_entity_id: string; dst_entity_id: string; relation: string };

        const memoryRows = (memoryResult.data ?? []) as unknown as MemoryRow[];
        const entityRows = (entityResult.data ?? []) as unknown as EntityRow[];
        const memoryIds = new Set(memoryRows.map(m => m.id));
        const entityIds = new Set(entityRows.map(e => e.id));

        // Mentions only for the memories and entities on the canvas, fetched in
        // chunks so the id list never pushes the request URL past its limit.
        const mentionRows: { memory_id: string; entity_id: string }[] = [];
        if (entityIds.size > 0) {
            const ids = [...memoryIds];
            for (let i = 0; i < ids.length; i += MENTION_ID_CHUNK) {
                const { data: rows, error } = await scoped('memory_entity_mentions', 'memory_id, entity_id')
                    .in('memory_id', ids.slice(i, i + MENTION_ID_CHUNK));
                if (error) throw error;
                mentionRows.push(...((rows ?? []) as unknown as { memory_id: string; entity_id: string }[]));
            }
        }

        return NextResponse.json({
            truncated: memoryRows.length === MAX_MEMORIES,
            memories: memoryRows.map(m => ({
                id: m.id,
                userId: m.scope_key,
                content: m.content,
                namespace: m.namespace,
                importance: Number(m.importance ?? 0),
                accessCount: m.access_count ?? 0,
                status: m.status,
                createdAt: m.created_at,
            })),
            updates: memoryRows
                .filter(m => m.superseded_by && memoryIds.has(m.superseded_by))
                .map(m => ({ from: m.id, to: m.superseded_by as string })),
            entities: entityRows.map(e => ({
                id: e.id,
                userId: e.scope_key,
                name: e.name,
                type: e.entity_type ?? 'entity',
                mentions: Number(e.mention_count ?? 0),
            })),
            mentions: mentionRows
                .filter(m => entityIds.has(m.entity_id))
                .map(m => ({ memory: m.memory_id, entity: m.entity_id })),
            relations: ((edgeResult.data ?? []) as unknown as EdgeRow[])
                .filter(e => entityIds.has(e.src_entity_id) && entityIds.has(e.dst_entity_id))
                .map(e => ({ source: e.src_entity_id, target: e.dst_entity_id, relation: e.relation })),
        });
    } catch (error) {
        console.error('[Memory] Graph map error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
