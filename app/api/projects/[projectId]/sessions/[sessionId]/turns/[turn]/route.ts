import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { requireObservability } from '@/lib/flags/flagswift-server';
import { createAdminClient } from '@/lib/supabaseAdmin';

/**
 * One turn's model call in full, for the Sessions trace's Input and Output
 * tabs: the exact messages the model received (system, history, tool calls
 * and results), the tools it was offered, the settings, and what it returned.
 * Loaded when the turn is opened, so the session view stays light.
 */

const MAX_CONTENT = 20_000;
const MAX_MESSAGES = 200;

function clip(value: unknown): unknown {
    if (typeof value === 'string') return value.length > MAX_CONTENT ? `${value.slice(0, MAX_CONTENT)}\n… (${value.length - MAX_CONTENT} more characters)` : value;
    if (Array.isArray(value)) return value.map(clip);
    return value;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string; sessionId: string; turn: string }> }) {
    const { projectId, sessionId, turn } = await params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    // Traces are part of Observability, which is in beta behind a flag.
    const notEnabled = await requireObservability(access.organizationSlug);
    if (notEnabled) return notEnabled;
    const turnNumber = Number.parseInt(turn, 10);
    if (!Number.isFinite(turnNumber) || turnNumber < 1) return NextResponse.json({ error: 'Invalid turn' }, { status: 400 });

    const admin = createAdminClient();
    const { data: session } = await admin.from('sessions').select('id').eq('project_id', projectId).eq('id', sessionId).maybeSingle();
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const { data: events, error } = await admin.from('session_events')
        .select('event_type, payload')
        .eq('session_id', sessionId)
        .eq('turn_number', turnNumber)
        .in('event_type', ['turn.started', 'turn.completed', 'turn.paused', 'turn.failed'])
        .order('sequence', { ascending: true });
    if (error) return NextResponse.json({ error: 'Failed to load turn' }, { status: 500 });

    const started = (events ?? []).find((e) => e.event_type === 'turn.started')?.payload as Record<string, unknown> | undefined;
    const terminal = (events ?? []).find((e) => e.event_type !== 'turn.started');
    const terminalPayload = (terminal?.payload ?? {}) as Record<string, unknown>;

    const rawMessages = (started?.input_messages as Array<Record<string, unknown>> | undefined) ?? [];
    const messages = rawMessages.slice(-MAX_MESSAGES).map((m) => ({
        role: m.role,
        content: clip(m.content ?? null),
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    }));
    const tools = ((started?.function_tools as Array<{ function?: { name?: string; description?: string; parameters?: unknown }; needsApproval?: boolean }> | undefined) ?? [])
        .map((t) => ({ name: t.function?.name, description: t.function?.description, parameters: t.function?.parameters, needs_approval: t.needsApproval === true }));

    return NextResponse.json({
        turn: turnNumber,
        found: Boolean(started),
        model: started?.model ?? null,
        instructions: clip(started?.instructions ?? null),
        messages,
        messages_omitted: Math.max(0, rawMessages.length - MAX_MESSAGES),
        tools,
        settings: {
            temperature: started?.temperature ?? null,
            max_output_tokens: started?.max_output_tokens ?? null,
            reasoning_effort: started?.reasoning_effort ?? null,
            tool_choice: started?.tool_choice ?? null,
            pause_on_tool_calls: started?.pause_on_tool_calls === true,
            structured_output: started?.schema_tool_name ?? null,
        },
        metadata: started?.metadata ?? null,
        security: started?.input_security ?? null,
        result: {
            event: terminal?.event_type ?? null,
            output: terminalPayload.output ?? null,
            actions: terminalPayload.actions ?? null,
            usage: terminalPayload.usage ?? null,
            trace: terminalPayload.trace ?? null,
            knowledge_citations: terminalPayload.knowledge_citations ?? null,
        },
    });
}
