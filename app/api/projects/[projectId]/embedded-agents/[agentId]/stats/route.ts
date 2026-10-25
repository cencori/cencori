/**
 * GET /api/projects/:projectId/embedded-agents/:agentId/stats?days=30
 *
 * One agent's activity per UTC day over the last `days` days (7, 30 or 90):
 * runs (completed / failed), average run duration, and the gateway cost and
 * tokens it used. A run is an API run (embedded_runs) or one conversation turn
 * (widget, share link, Sessions API), read from the gateway's own request log
 * (ai_requests.agent_id), which also gives cost and tokens. Console Preview
 * tests cost money but aren't runs.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { CONVERSATION_TURN_ENDPOINT } from '@/lib/embedded/conversation-runs';

const ALLOWED_DAYS = [7, 30, 90];
/** Rows read per range. Far above what the chart needs to be right; past it the totals undercount. */
const ROW_CAP = 20_000;

type RunRow = { status: string; tenant_id: string | null; started_at: string | null; completed_at: string | null; created_at: string };
type RequestRow = { endpoint: string | null; status: string | null; latency_ms: number | null; tenant_id: string | null; cost_usd: number | string | null; total_tokens: number | null; created_at: string };

export async function GET(request: Request, ctx: { params: Promise<{ projectId: string; agentId: string }> }) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    const requested = Number(new URL(request.url).searchParams.get('days'));
    const days = ALLOWED_DAYS.includes(requested) ? requested : 30;
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const since = start.toISOString();

    const db = createAdminClient();
    const { data: agent } = await db.from('agents').select('id').eq('project_id', projectId).eq('id', agentId).maybeSingle();
    if (!agent) return NextResponse.json({ error: 'Agent not found in this project.' }, { status: 404 });

    const [runsResult, requestsResult] = await Promise.all([
        db.from('embedded_runs')
            .select('status,tenant_id,started_at,completed_at,created_at')
            .eq('project_id', projectId)
            .eq('agent_id', agentId)
            .gte('created_at', since)
            .limit(ROW_CAP),
        db.from('ai_requests')
            .select('endpoint,status,latency_ms,tenant_id,cost_usd,total_tokens,created_at')
            .eq('project_id', projectId)
            .eq('agent_id', agentId)
            .gte('created_at', since)
            .limit(ROW_CAP),
    ]);
    if (runsResult.error) {
        console.error('[Agent stats] Runs read failed:', runsResult.error.message);
        return NextResponse.json({ error: 'We could not load this agent\'s activity.' }, { status: 500 });
    }
    // Cost is a nice-to-have: a failed read shows zero spend rather than no page.
    if (requestsResult.error) console.warn('[Agent stats] Cost read failed:', requestsResult.error.message);

    const keys: string[] = [];
    for (let i = 0; i < days; i++) {
        const day = new Date(start);
        day.setUTCDate(start.getUTCDate() + i);
        keys.push(day.toISOString().slice(0, 10));
    }
    const byDay = new Map(keys.map((key) => [key, { completed: 0, failed: 0, other: 0, costUsd: 0, tokens: 0, durationMs: 0, timed: 0 }]));

    const customers = new Set<string>();
    let durationTotal = 0;
    let durationCount = 0;
    for (const run of (runsResult.data ?? []) as RunRow[]) {
        const point = byDay.get(run.created_at.slice(0, 10));
        if (!point) continue;
        if (run.status === 'completed') point.completed++;
        else if (run.status === 'failed') point.failed++;
        else point.other++;
        if (run.tenant_id) customers.add(run.tenant_id);
        if (run.started_at && run.completed_at) {
            const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
            if (ms >= 0) {
                point.durationMs += ms;
                point.timed++;
                durationTotal += ms;
                durationCount++;
            }
        }
    }
    for (const row of (requestsResult.data ?? []) as RequestRow[]) {
        const point = byDay.get(row.created_at.slice(0, 10));
        if (!point) continue;
        point.costUsd += Number(row.cost_usd) || 0;
        point.tokens += Number(row.total_tokens) || 0;
        if (row.endpoint !== CONVERSATION_TURN_ENDPOINT) continue;
        if (row.status === 'success') point.completed++;
        else point.failed++;
        if (row.tenant_id) customers.add(row.tenant_id);
        if (typeof row.latency_ms === 'number' && row.latency_ms >= 0) {
            point.durationMs += row.latency_ms;
            point.timed++;
            durationTotal += row.latency_ms;
            durationCount++;
        }
    }

    const daily = keys.map((date) => {
        const point = byDay.get(date)!;
        return {
            date,
            runs: point.completed + point.failed + point.other,
            completed: point.completed,
            failed: point.failed,
            costUsd: point.costUsd,
            tokens: point.tokens,
            avgDurationMs: point.timed ? Math.round(point.durationMs / point.timed) : 0,
        };
    });
    const runs = daily.reduce((sum, point) => sum + point.runs, 0);
    const failed = daily.reduce((sum, point) => sum + point.failed, 0);
    const finished = daily.reduce((sum, point) => sum + point.completed + point.failed, 0);

    return NextResponse.json({
        days,
        totals: {
            runs,
            failed,
            // Of runs that finished; in-flight runs don't count either way.
            successRate: finished ? (finished - failed) / finished : null,
            avgDurationMs: durationCount ? Math.round(durationTotal / durationCount) : null,
            costUsd: daily.reduce((sum, point) => sum + point.costUsd, 0),
            tokens: daily.reduce((sum, point) => sum + point.tokens, 0),
            customers: customers.size,
        },
        daily,
        truncated: (runsResult.data?.length ?? 0) >= ROW_CAP || (requestsResult.data?.length ?? 0) >= ROW_CAP,
    });
}
