import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { buildTimeline, sessionAgentLabel, sessionSource, type SessionEventRow } from '@/lib/sessions/observability';

/**
 * One session for the console: its summary, its timeline (built here, so the
 * full message history stored on every turn never reaches the browser), and
 * the sessions it started or was started by (cencori/agents agent-as-tool).
 */

const MAX_EVENTS = 5000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string; sessionId: string }> }) {
    const { projectId, sessionId } = await params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    const admin = createAdminClient();
    const { data: session, error } = await admin
        .from('sessions')
        .select('id, status, agent_id, metadata, tenant_id, installation_id, external_user_id, last_turn_number, total_cost_usd, created_at, updated_at, expires_at')
        .eq('project_id', projectId)
        .eq('id', sessionId)
        .maybeSingle();
    if (error) {
        console.error('[Sessions] detail failed', error);
        return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
    }
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const metadata = (session.metadata ?? {}) as Record<string, unknown>;
    const parentId = typeof metadata.parent_session_id === 'string' ? metadata.parent_session_id : null;

    const [eventsResult, childrenResult, agentResult] = await Promise.all([
        admin.from('session_events')
            .select('turn_number, sequence, event_type, payload, created_at')
            .eq('session_id', sessionId)
            .order('turn_number', { ascending: true })
            .order('sequence', { ascending: true })
            .limit(MAX_EVENTS),
        admin.from('sessions')
            .select('id, status, metadata, last_turn_number, total_cost_usd, created_at, updated_at')
            .eq('project_id', projectId)
            .eq('metadata->>parent_session_id', sessionId)
            .order('created_at', { ascending: true })
            .limit(50),
        session.agent_id
            ? admin.from('agents').select('id, name').eq('id', session.agent_id).maybeSingle()
            : Promise.resolve({ data: null as { id: string; name: string } | null }),
    ]);

    const agentNames = new Map(agentResult.data ? [[agentResult.data.id as string, agentResult.data.name as string]] : []);
    const timeline = buildTimeline((eventsResult.data ?? []) as SessionEventRow[]);

    // Each model call's row in the gateway log (Logs), by the request id its turn recorded.
    const requestIds = [...new Set(timeline.map((t) => t.trace.requestId).filter(Boolean))] as string[];
    const logs = new Map<string, { id: string; latency_ms: number | null; status: string | null; fallback_provider: string | null; fallback_model: string | null }>();
    if (requestIds.length) {
        const { data: rows } = await admin.from('ai_requests')
            .select('id, request_id, latency_ms, status, fallback_provider, fallback_model')
            .eq('project_id', projectId)
            .in('request_id', requestIds)
            .limit(500);
        for (const row of rows ?? []) logs.set(row.request_id as string, row as never);
    }
    const turns = timeline.map((t) => {
        const log = t.trace.requestId ? logs.get(t.trace.requestId) : undefined;
        return {
            ...t,
            log: log ? { id: log.id, latencyMs: log.latency_ms, status: log.status, fallbackProvider: log.fallback_provider, fallbackModel: log.fallback_model } : null,
        };
    });
    const firstStart = timeline[0]?.startedAt ?? null;
    const lastEnd = [...timeline].reverse().find((t) => t.endedAt)?.endedAt ?? null;
    const usage = turns.reduce(
        (sum, t) => ({ inputTokens: sum.inputTokens + (t.usage?.inputTokens ?? 0), outputTokens: sum.outputTokens + (t.usage?.outputTokens ?? 0) }),
        { inputTokens: 0, outputTokens: 0 },
    );

    return NextResponse.json({
        session: {
            id: session.id,
            status: session.status,
            source: sessionSource(session),
            agent: sessionAgentLabel(session, agentNames, session.agent_id as string | null),
            user: (session.external_user_id as string | null) ?? (typeof metadata.end_user_id === 'string' ? metadata.end_user_id : null),
            turns: (session.last_turn_number as number | null) ?? 0,
            cost_usd: Number(session.total_cost_usd ?? 0),
            usage,
            parent_session_id: parentId,
            duration_ms: firstStart && lastEnd ? Math.max(0, Date.parse(lastEnd) - Date.parse(firstStart)) : null,
            tool_calls: timeline.reduce((n, t) => n + t.toolCalls.length, 0),
            models: [...new Set(timeline.map((t) => t.trace.model ?? t.model).filter(Boolean))],
            agents: [...new Set(timeline.map((t) => t.agent).filter(Boolean))],
            metadata,
            created_at: session.created_at,
            updated_at: session.updated_at,
            expires_at: session.expires_at ?? null,
        },
        turns,
        truncated: (eventsResult.data ?? []).length >= MAX_EVENTS,
        children: (childrenResult.data ?? []).map((c) => ({
            id: c.id,
            status: c.status,
            agent: sessionAgentLabel(c),
            turns: (c.last_turn_number as number | null) ?? 0,
            cost_usd: Number(c.total_cost_usd ?? 0),
            created_at: c.created_at,
            updated_at: c.updated_at,
            source: sessionSource(c),
        })),
    });
}
