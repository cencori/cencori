import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getProjectTier } from '@/lib/require-tier-feature';
import { clampTimeRange, LOG_RETENTION_RANGE } from '@/lib/entitlements';
import { sessionAgentLabel, sessionSource, type SessionSource } from '@/lib/sessions/observability';

/**
 * Sessions for the console's Observability page: every agent conversation in
 * the project (cencori/agents, Arcie, widget, WhatsApp, embedded, API),
 * newest activity first. History depth follows the plan, as for Logs.
 */

const RANGE_MS: Record<string, number | null> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    all: null,
};
const STATUSES = new Set(['active', 'paused', 'completed', 'failed']);
/** PostgREST filters per source, OR-ed together when several are picked. */
const SOURCE_FILTERS: Record<string, string> = {
    sdk: 'metadata->>sdk.eq.cencori/agents',
    widget: 'metadata->>source.in.(widget,link)',
    whatsapp: 'metadata->>source.eq.whatsapp',
    embedded: 'installation_id.not.is.null',
    arcie: 'metadata->>subagent.not.is.null,and(metadata->>name.not.is.null,metadata->>instructions.not.is.null)',
};
const HISTOGRAM_BUCKETS = 60;

/** The query-builder methods the filters use (PostgREST via supabase-js). */
interface FilterBuilder {
    gte(column: string, value: string): FilterBuilder;
    in(column: string, values: string[]): FilterBuilder;
    or(filters: string): FilterBuilder;
    eq(column: string, value: string): FilterBuilder;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SessionListItem {
    id: string;
    status: string;
    source: SessionSource;
    agent: string | null;
    turns: number;
    cost_usd: number;
    preview: string | null;
    parent_session_id: string | null;
    created_at: string;
    updated_at: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '25', 10) || 25, 1), 100);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);
    // Several statuses or sources at once: status=paused,failed&source=sdk,arcie
    const statuses = (sp.get('status') || '').split(',').filter((v) => STATUSES.has(v));
    const sources = (sp.get('source') || '').split(',').filter((v) => SOURCE_FILTERS[v]);
    const search = (sp.get('search') || '').trim();

    const tier = (await getProjectTier(projectId)) || 'free';
    const requested = sp.get('time_range') || '7d';
    const timeRange = clampTimeRange(tier, requested);
    const since = RANGE_MS[timeRange] ? new Date(Date.now() - (RANGE_MS[timeRange] as number)).toISOString() : null;

    const admin = createAdminClient();
    // The same filters for the page of rows and for the activity histogram.
    const filtered = <Q,>(q: Q): Q => {
        let out = q as unknown as FilterBuilder;
        if (since) out = out.gte('updated_at', since);
        if (statuses.length) out = out.in('status', statuses);
        if (sources.length) out = out.or(sources.map((v) => SOURCE_FILTERS[v]).join(','));
        if (search) {
            if (UUID.test(search)) out = out.eq('id', search);
            else {
                const term = search.replace(/[,()*%\\"]/g, ' ').trim();
                out = out.or(`metadata->>agent.ilike.*${term}*,metadata->>name.ilike.*${term}*`);
            }
        }
        return out as unknown as Q;
    };
    const query = filtered(admin
        .from('sessions')
        .select('id, status, agent_id, metadata, tenant_id, installation_id, last_turn_number, total_cost_usd, created_at, updated_at')
        .eq('project_id', projectId));

    const { data, error } = await query
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit); // one extra row tells us there's a next page
    if (error) {
        console.error('[Sessions] list failed', error);
        return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
    }

    const rows = (data ?? []).slice(0, limit);
    const ids = rows.map((r) => r.id as string);
    const agentIds = [...new Set(rows.map((r) => r.agent_id).filter(Boolean))] as string[];

    const [previewsResult, agentsResult] = await Promise.all([
        ids.length
            ? admin.from('session_events').select('session_id, input:payload->>input_text')
                .in('session_id', ids).eq('turn_number', 1).eq('event_type', 'turn.started')
            : Promise.resolve({ data: [] as Array<{ session_id: string; input: string | null }> }),
        agentIds.length
            ? admin.from('agents').select('id, name').in('id', agentIds)
            : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);
    const previews = new Map((previewsResult.data ?? []).map((p) => [p.session_id as string, (p.input as string | null) ?? null]));
    const agentNames = new Map((agentsResult.data ?? []).map((a) => [a.id as string, a.name as string]));

    const sessions: SessionListItem[] = rows.map((r) => {
        const metadata = (r.metadata ?? {}) as Record<string, unknown>;
        const preview = previews.get(r.id as string);
        return {
            id: r.id as string,
            status: r.status as string,
            source: sessionSource(r),
            agent: sessionAgentLabel(r, agentNames, r.agent_id as string | null),
            turns: (r.last_turn_number as number | null) ?? 0,
            cost_usd: Number(r.total_cost_usd ?? 0),
            preview: preview ? preview.slice(0, 200) : null,
            parent_session_id: typeof metadata.parent_session_id === 'string' ? metadata.parent_session_id : null,
            created_at: r.created_at as string,
            updated_at: r.updated_at as string,
        };
    });

    // Activity over the range, for the timeline strip (first page only).
    let histogram: { start: string; end: string; buckets: number[] } | null = null;
    if (offset === 0) {
        const { data: times } = await filtered(admin.from('sessions').select('updated_at').eq('project_id', projectId))
            .order('updated_at', { ascending: false })
            .limit(5000);
        const stamps = (times ?? []).map((t) => Date.parse(t.updated_at as string)).filter(Number.isFinite);
        const end = Date.now();
        const start = since ? Date.parse(since) : (stamps.length ? Math.min(...stamps) : end - 7 * 864e5);
        const width = Math.max(1, (end - start) / HISTOGRAM_BUCKETS);
        const buckets = new Array(HISTOGRAM_BUCKETS).fill(0);
        for (const t of stamps) buckets[Math.min(HISTOGRAM_BUCKETS - 1, Math.max(0, Math.floor((t - start) / width)))]++;
        histogram = { start: new Date(start).toISOString(), end: new Date(end).toISOString(), buckets };
    }

    return NextResponse.json({
        sessions,
        histogram,
        has_more: (data ?? []).length > limit,
        meta: {
            requested_time_range: requested,
            applied_time_range: timeRange,
            tier_max_time_range: LOG_RETENTION_RANGE[tier] ?? LOG_RETENTION_RANGE.free,
            time_range_clamped: requested !== timeRange,
        },
    });
}
