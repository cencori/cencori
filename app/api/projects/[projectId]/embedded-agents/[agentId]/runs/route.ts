/**
 * GET /api/projects/:projectId/embedded-agents/:agentId/runs?limit=50&offset=0&status=failed
 *
 * One agent's runs, newest first, a page at a time: API runs (embedded_runs)
 * and conversation turns (widget, share link, Sessions API) merged by time.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { CONVERSATION_TURN_ENDPOINT, runText, turnAsRun, turnText, type ConversationTurnRow } from '@/lib/embedded/conversation-runs';

const STATUSES = ['queued', 'running', 'requires_action', 'completed', 'failed', 'cancelled', 'expired'];

export async function GET(request: Request, ctx: { params: Promise<{ projectId: string; agentId: string }> }) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    const params = new URL(request.url).searchParams;
    const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 50));
    const offset = Math.max(0, Number(params.get('offset')) || 0);
    const status = params.get('status');
    const filter = status && STATUSES.includes(status) ? status : null;

    // Both sources are read up to the end of the page, then merged and cut.
    const pageEnd = offset + limit;
    const db = createAdminClient();
    let runsQuery = db.from('embedded_runs')
        .select('id,agent_id,tenant_id,status,error,started_at,completed_at,created_at')
        .eq('project_id', projectId)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(pageEnd);
    if (filter) runsQuery = runsQuery.eq('status', filter);

    // Turns only ever complete or fail.
    const wantTurns = !filter || filter === 'completed' || filter === 'failed';
    let turnsQuery = db.from('ai_requests')
        .select('id,agent_id,tenant_id,status,error_message,latency_ms,created_at')
        .eq('project_id', projectId)
        .eq('agent_id', agentId)
        .eq('endpoint', CONVERSATION_TURN_ENDPOINT)
        .order('created_at', { ascending: false })
        .limit(pageEnd);
    if (filter === 'completed') turnsQuery = turnsQuery.eq('status', 'success');
    if (filter === 'failed') turnsQuery = turnsQuery.neq('status', 'success');

    const [runsResult, turnsResult] = await Promise.all([runsQuery, wantTurns ? turnsQuery : Promise.resolve({ data: [], error: null })]);
    if (runsResult.error) {
        console.error('[Agent runs] Read failed:', runsResult.error.message);
        return NextResponse.json({ error: 'We could not load this agent\'s runs.' }, { status: 500 });
    }
    // Conversations are additive: a failed read still shows the API runs.
    if (turnsResult.error) console.warn('[Agent runs] Conversation read failed:', turnsResult.error.message);

    const runs = [
        ...(runsResult.data ?? []).map((run) => ({ ...run, kind: 'api' as const })),
        ...((turnsResult.data ?? []) as ConversationTurnRow[]).map((row) => turnAsRun(row, agentId)),
    ]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(offset, pageEnd);

    // The prompt and reply are already stored with each run; read them only for
    // the rows on this page, so a long history costs the same as a short one.
    const turnIds = runs.filter((run) => run.kind === 'conversation').map((run) => run.id);
    const apiIds = runs.filter((run) => run.kind === 'api').map((run) => run.id);
    const [turnPayloads, runPayloads] = await Promise.all([
        turnIds.length
            ? db.from('ai_requests').select('id,model,request_payload,response_payload').eq('project_id', projectId).in('id', turnIds)
            : Promise.resolve({ data: [], error: null }),
        apiIds.length
            ? db.from('embedded_runs').select('id,input_ref,output_ref').eq('project_id', projectId).in('id', apiIds)
            : Promise.resolve({ data: [], error: null }),
    ]);
    if (turnPayloads.error || runPayloads.error) {
        console.warn('[Agent runs] Prompt read failed:', (turnPayloads.error ?? runPayloads.error)?.message);
    }
    const text = new Map<string, { prompt: string | null; reply: string | null; model: string | null }>();
    for (const row of (turnPayloads.data ?? []) as Array<{ id: string; model: string | null; request_payload: unknown; response_payload: unknown }>) {
        text.set(row.id, { ...turnText(row), model: row.model ?? null });
    }
    for (const row of (runPayloads.data ?? []) as Array<{ id: string; input_ref: unknown; output_ref: unknown }>) {
        const model = (row.output_ref as { model?: unknown } | null)?.model;
        text.set(row.id, { ...runText(row), model: typeof model === 'string' ? model : null });
    }
    return NextResponse.json({
        runs: runs.map((run) => ({ ...run, ...(text.get(run.id) ?? { prompt: null, reply: null, model: null }) })),
        limit,
        offset,
    });
}
