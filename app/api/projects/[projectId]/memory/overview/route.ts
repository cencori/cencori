/**
 * GET /api/projects/:projectId/memory/overview — dashboard stats for the
 * project's gateway memory (the `memory` field / `/v1/memory/*` store), NOT the
 * legacy namespace RAG store that the sibling routes serve.
 *
 * Session-authenticated: requireProjectAccess is the access control, and every
 * query is filtered by the organization it returns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getMemoryQuota, type SubscriptionTier } from '@/lib/entitlements';
import { getCache, saveCache } from '@/lib/cache';
import { getProjectMemorySettings } from '@/lib/memory';

const STATS_WINDOW_DAYS = 14;
/**
 * Stats are aggregates over every memory in the project — distinct users, a
 * daily series, top users. On a large project that is real work, and the
 * numbers do not need to be current to the second. A short cache keeps a
 * dashboard refresh from re-counting a million rows.
 */
const STATS_CACHE_TTL_SECONDS = 60;

interface MemoryStats {
    activeCount: number;
    supersededCount: number;
    distinctUsers: number;
    distinctNamespaces: number;
    avgImportance: number;
    recalledTotal: number;
    neverRecalled: number;
    entityCount: number;
    edgeCount: number;
    mentionCount: number;
    daily: { date: string; count: number }[];
    topUsers: { scopeKey: string; count: number }[];
}

interface SearchActivity {
    total: number;
    daily: { date: string; count: number }[];
    recent: {
        id: string;
        createdAt: string;
        status: string;
        query: string;
        scopeKey: string | null;
        results: number | null;
        latencyMs: number | null;
    }[];
}

/** Rows read to build the daily series; past this the chart undercounts, which the cache makes rare. */
const SEARCH_SERIES_ROW_CAP = 20_000;
const RECENT_SEARCHES = 5;

function utcDay(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/**
 * Recall activity, read from the gateway's own request log: every
 * /v1/memory/search call is logged as `memory/search`. Recalls made inside a
 * chat request (the `memory` field) are not logged separately, so this counts
 * explicit searches only.
 */
async function searchActivity(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string
): Promise<SearchActivity> {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (STATS_WINDOW_DAYS - 1));

    const [series, recent] = await Promise.all([
        supabase.from('ai_requests')
            .select('created_at')
            .eq('project_id', projectId)
            .eq('endpoint', 'memory/search')
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false })
            .limit(SEARCH_SERIES_ROW_CAP),
        supabase.from('ai_requests')
            .select('id, created_at, status, latency_ms, metadata, request_payload')
            .eq('project_id', projectId)
            .eq('endpoint', 'memory/search')
            .order('created_at', { ascending: false })
            .limit(RECENT_SEARCHES),
    ]);

    if (series.error) console.warn('[Memory] Search series unavailable:', series.error.message);
    if (recent.error) console.warn('[Memory] Recent searches unavailable:', recent.error.message);

    const counts = new Map<string, number>();
    for (const row of series.data ?? []) {
        const day = utcDay(new Date(row.created_at as string));
        counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    const daily: SearchActivity['daily'] = [];
    for (let i = 0; i < STATS_WINDOW_DAYS; i++) {
        const day = new Date(since);
        day.setUTCDate(since.getUTCDate() + i);
        const key = utcDay(day);
        daily.push({ date: key, count: counts.get(key) ?? 0 });
    }

    return {
        total: series.data?.length ?? 0,
        daily,
        recent: (recent.data ?? []).map(row => {
            const metadata = (row.metadata ?? {}) as Record<string, unknown>;
            const payload = (row.request_payload ?? {}) as { messages?: { content?: unknown }[] };
            const content = payload.messages?.[0]?.content;
            return {
                id: row.id as string,
                createdAt: row.created_at as string,
                status: row.status as string,
                query: typeof content === 'string' ? content : '',
                scopeKey: typeof metadata.scopeKey === 'string' ? metadata.scopeKey : null,
                results: typeof metadata.results === 'number' ? metadata.results : null,
                latencyMs: typeof row.latency_ms === 'number' ? row.latency_ms : null,
            };
        }),
    };
}

/**
 * Counts without the stats function — used when the migration hasn't been
 * applied yet. Loses the distinct/aggregate figures (they need SQL), but the
 * gauge still works rather than the page erroring out.
 */
async function fallbackStats(
    supabase: ReturnType<typeof createAdminClient>,
    organizationId: string,
    projectId: string
): Promise<MemoryStats> {
    const scoped = (table: string) =>
        supabase.from(table).select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('project_id', projectId);

    const [active, superseded, entities, edges, mentions] = await Promise.all([
        scoped('gateway_memories').eq('status', 'active'),
        scoped('gateway_memories').eq('status', 'superseded'),
        scoped('memory_entities'),
        scoped('memory_entity_edges'),
        scoped('memory_entity_mentions'),
    ]);

    return {
        activeCount: active.count ?? 0,
        supersededCount: superseded.count ?? 0,
        distinctUsers: 0,
        distinctNamespaces: 0,
        avgImportance: 0,
        recalledTotal: 0,
        neverRecalled: 0,
        entityCount: entities.count ?? 0,
        edgeCount: edges.count ?? 0,
        mentionCount: mentions.count ?? 0,
        daily: [],
        topUsers: [],
    };
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    const supabase = createAdminClient();

    try {
        const { data: org } = await supabase
            .from('organizations')
            .select('subscription_tier')
            .eq('id', access.organizationId)
            .single();
        const tier = (org?.subscription_tier || 'free') as SubscriptionTier;

        const cacheKey = `memory:stats:${projectId}:${STATS_WINDOW_DAYS}`;
        const cached = await getCache(cacheKey);
        let stats: MemoryStats | null = cached
            // Upstash deserializes JSON for us on read; older entries may still
            // arrive as a string.
            ? (typeof cached === 'string' ? JSON.parse(cached) : cached) as MemoryStats
            : null;

        if (!stats) {
            const { data: rpcStats, error: rpcError } = await supabase.rpc('memory_project_stats', {
                p_org_id: access.organizationId,
                p_project_id: projectId,
                p_days: STATS_WINDOW_DAYS,
            });

            if (rpcError) {
                console.warn('[Memory] Stats RPC unavailable, falling back to counts:', rpcError.message);
            }

            stats = rpcError || !rpcStats
                ? await fallbackStats(supabase, access.organizationId, projectId)
                : (rpcStats as MemoryStats);

            await saveCache(cacheKey, stats, STATS_CACHE_TTL_SECONDS);
        }

        const searchesKey = `memory:searches:${projectId}:${STATS_WINDOW_DAYS}`;
        const cachedSearches = await getCache(searchesKey);
        let searches: SearchActivity | null = cachedSearches
            ? (typeof cachedSearches === 'string' ? JSON.parse(cachedSearches) : cachedSearches) as SearchActivity
            : null;
        if (!searches) {
            searches = await searchActivity(supabase, projectId);
            await saveCache(searchesKey, searches, STATS_CACHE_TTL_SECONDS);
        }

        const settings = await getProjectMemorySettings(supabase, projectId);
        const limit = getMemoryQuota(tier);
        const isUnlimited = !Number.isFinite(limit);

        return NextResponse.json({
            quota: {
                used: stats.activeCount,
                limit: isUnlimited ? null : limit,
                // Superseded history doesn't count against the tier limit — the
                // metering unit is what's active.
                percent: isUnlimited ? 0 : Math.min(100, Math.round((stats.activeCount / limit) * 100)),
                tier,
            },
            memories: {
                active: stats.activeCount,
                superseded: stats.supersededCount,
                users: stats.distinctUsers,
                namespaces: stats.distinctNamespaces,
                avgImportance: Number(stats.avgImportance ?? 0),
                recalls: Number(stats.recalledTotal ?? 0),
                neverRecalled: stats.neverRecalled,
            },
            graph: {
                entities: stats.entityCount,
                edges: stats.edgeCount,
                mentions: stats.mentionCount,
            },
            daily: stats.daily ?? [],
            topUsers: stats.topUsers ?? [],
            searches,
            settings,
        });
    } catch (error) {
        console.error('[Memory] Overview error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
