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
    const status = sp.get('status');
    const source = sp.get('source');
    const search = (sp.get('search') || '').trim();

    const tier = (await getProjectTier(projectId)) || 'free';
    const requested = sp.get('time_range') || '7d';
    const timeRange = clampTimeRange(tier, requested);
    const since = RANGE_MS[timeRange] ? new Date(Date.now() - (RANGE_MS[timeRange] as number)).toISOString() : null;

    const admin = createAdminClient();
    let query = admin
        .from('sessions')
        .select('id, status, agent_id, metadata, tenant_id, installation_id, last_turn_number, total_cost_usd, created_at, updated_at')
        .eq('project_id', projectId);
    if (since) query = query.gte('updated_at', since);
    if (status && STATUSES.has(status)) query = query.eq('status', status);
    switch (source) {
        case 'sdk': query = query.eq('metadata->>sdk', 'cencori/agents'); break;
        case 'widget': query = query.in('metadata->>source', ['widget', 'link']); break;
        case 'whatsapp': query = query.eq('metadata->>source', 'whatsapp'); break;
        case 'embedded': query = query.not('installation_id', 'is', null); break;
        case 'arcie': query = query.or('metadata->>subagent.not.is.null,and(metadata->>name.not.is.null,metadata->>instructions.not.is.null)'); break;
        default: break;
    }
    if (search) {
        if (!UUID.test(search)) return NextResponse.json({ sessions: [], has_more: false, meta: { applied_time_range: timeRange } });
        query = query.eq('id', search);
    }

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

    return NextResponse.json({
        sessions,
        has_more: (data ?? []).length > limit,
        meta: {
            requested_time_range: requested,
            applied_time_range: timeRange,
            tier_max_time_range: LOG_RETENTION_RANGE[tier] ?? LOG_RETENTION_RANGE.free,
            time_range_clamped: requested !== timeRange,
        },
    });
}
