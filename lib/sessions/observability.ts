/**
 * Sessions in the console (/{project}/observability): where a session came
 * from, and its events turned into a timeline a person can read. Pure
 * functions, so the API routes stay thin and this stays testable.
 */

export type SessionSource = 'sdk' | 'arcie' | 'widget' | 'link' | 'whatsapp' | 'embedded' | 'api';

export const SESSION_SOURCE_LABELS: Record<SessionSource, string> = {
    sdk: 'Agents SDK',
    arcie: 'Arcie',
    widget: 'Widget',
    link: 'Shared link',
    whatsapp: 'WhatsApp',
    embedded: 'Embedded',
    api: 'API',
};

export interface SessionRowLike {
    metadata?: Record<string, unknown> | null;
    installation_id?: string | null;
    tenant_id?: string | null;
}

/** Which product or client started a session, from what each one records on it. */
export function sessionSource(row: SessionRowLike): SessionSource {
    const m = row.metadata ?? {};
    if (m.sdk === 'cencori/agents') return 'sdk';
    if (m.source === 'widget') return 'widget';
    if (m.source === 'link') return 'link';
    if (m.source === 'whatsapp') return 'whatsapp';
    if (row.installation_id || row.tenant_id) return 'embedded';
    // Arcie records the agent's manifest (and subagents their parent).
    if ((typeof m.name === 'string' && 'instructions' in m) || typeof m.subagent === 'string') return 'arcie';
    return 'api';
}

/** The agent's name as the session recorded it, if it did. */
export function sessionAgentLabel(row: SessionRowLike, agentNames?: Map<string, string>, agentId?: string | null): string | null {
    const m = row.metadata ?? {};
    if (typeof m.agent === 'string' && m.agent) return m.agent;
    if (typeof m.subagent === 'string' && m.subagent) {
        return typeof m.parent === 'string' && m.parent ? `${m.parent} › ${m.subagent}` : m.subagent;
    }
    if (typeof m.name === 'string' && m.name) return m.name;
    if (agentId && agentNames?.get(agentId)) return agentNames.get(agentId)!;
    return null;
}

export interface SessionEventRow {
    turn_number: number;
    sequence: number;
    event_type: string;
    payload: Record<string, unknown> | null;
    created_at: string;
}

export interface TimelineToolCall {
    id: string;
    name: string;
    /** The model's arguments, pretty-printed when they're JSON. */
    arguments: string;
    /** What came back: the caller's tool result, or a server tool's output. */
    result: string | null;
    /** A cencori/agents handoff (transfer_to_<agent>). */
    handoff: boolean;
    needsApproval: boolean;
    /** Who ran it: the caller's code (paused for its result) or Cencori, inside the turn. */
    executedBy: 'caller' | 'cencori';
    /** From the call to its result: for the caller's tools, pause to resume (their code plus network). */
    startedAt: string;
    endedAt: string | null;
    durationMs: number | null;
    /** How a human ruled on it, when it needed approval. */
    resolution: 'approved' | 'rejected' | null;
}

export interface TimelineTurn {
    turn: number;
    model: string | null;
    startedAt: string;
    endedAt: string | null;
    durationMs: number | null;
    /** The user's message; absent on a turn that continues after tool results. */
    input: string | null;
    /** Set when this turn continues turn N after its tool results came back. */
    resumedFrom: number | null;
    text: string;
    toolCalls: TimelineToolCall[];
    status: 'completed' | 'paused' | 'failed' | 'running';
    /** Why it paused: the caller runs its tools, or a person must approve. */
    pauseReason: 'tool_results_required' | 'approval_required' | null;
    /** How a pause ended, when it has. */
    resolution: 'approved' | 'rejected' | null;
    error: string | null;
    usage: { inputTokens: number; outputTokens: number } | null;
    /** The agent answering this turn, when the caller named it (cencori/agents does). */
    agent: string | null;
    /** The model call behind this turn, from its terminal event's trace block. */
    trace: {
        requestId: string | null;
        provider: string | null;
        model: string | null;
        usedFallback: boolean;
        costUsd: number | null;
        ttftMs: number | null;
        modelMs: number | null;
        rounds: number | null;
    };
}

const MAX_TEXT = 20_000;

function clip(value: string): string {
    return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}\n… (${value.length - MAX_TEXT} more characters)` : value;
}

function pretty(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') {
        try {
            return clip(JSON.stringify(JSON.parse(value), null, 2));
        } catch {
            return clip(value);
        }
    }
    try {
        return clip(JSON.stringify(value, null, 2));
    } catch {
        return clip(String(value));
    }
}

function textOf(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((part) => (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : ''))
            .join('');
    }
    return '';
}

/**
 * The session's events as turns: what the user said, what the agent said,
 * which tools it called with what, what came back, where it paused and how
 * that was resolved. Tool results the caller sent back are read from the next
 * turn's recorded messages, where the resumed turn stores them.
 */
export function buildTimeline(events: SessionEventRow[]): TimelineTurn[] {
    const byTurn = new Map<number, SessionEventRow[]>();
    for (const event of [...events].sort((a, b) => a.turn_number - b.turn_number || a.sequence - b.sequence)) {
        if (event.event_type === 'turn.checkpoint') continue;
        const list = byTurn.get(event.turn_number) ?? [];
        list.push(event);
        byTurn.set(event.turn_number, list);
    }

    // Tool results, by call id, from every turn's recorded messages.
    const toolResults = new Map<string, string>();
    for (const list of byTurn.values()) {
        for (const event of list) {
            if (event.event_type !== 'turn.started') continue;
            const messages = (event.payload?.input_messages as Array<{ role?: string; content?: unknown; toolCallId?: string }> | undefined) ?? [];
            for (const message of messages) {
                if (message.role === 'tool' && message.toolCallId) toolResults.set(message.toolCallId, textOf(message.content));
            }
        }
    }

    const turns: TimelineTurn[] = [];
    for (const [turn, list] of byTurn) {
        const p = (e: SessionEventRow) => e.payload ?? {};
        const started = list.find((e) => e.event_type === 'turn.started');
        const startedPayload = started ? p(started) : {};
        const resumedFromRaw = startedPayload.resumed_from_turn
            ?? list.map((e) => p(e).resumed_from_turn).find((v) => typeof v === 'number');
        const terminal = list.find((e) => ['turn.completed', 'turn.failed', 'turn.paused'].includes(e.event_type));
        const resumed = list.find((e) => e.event_type === 'turn.resumed');
        const paused = list.find((e) => e.event_type === 'turn.paused');

        const toolCalls: TimelineToolCall[] = [];
        const pausedActions = (paused ? (p(paused).actions as Array<{ action_id: string; needs_approval?: boolean }> | undefined) : undefined) ?? [];
        for (const event of list) {
            if (event.event_type === 'tool_call.started') {
                const payload = p(event);
                const id = String(payload.action_id ?? payload.call_id ?? `${turn}-${event.sequence}`);
                const name = String(payload.tool ?? 'tool');
                toolCalls.push({
                    id,
                    name,
                    arguments: pretty(payload.arguments),
                    result: toolResults.has(id) ? pretty(toolResults.get(id)) : null,
                    handoff: name.startsWith('transfer_to_'),
                    needsApproval: pausedActions.some((a) => a.action_id === id && a.needs_approval === true),
                    executedBy: 'caller',
                    startedAt: event.created_at,
                    endedAt: null,
                    durationMs: null,
                    resolution: null,
                });
            } else if (event.event_type === 'tool_call.completed') {
                const payload = p(event);
                const id = String(payload.action_id ?? payload.call_id ?? '');
                const call = toolCalls.find((c) => c.id === id);
                const output = payload.output === undefined ? null : pretty(payload.output);
                if (call) {
                    call.result ??= output;
                    call.executedBy = 'cencori';
                    call.endedAt = event.created_at;
                    call.durationMs = Math.max(0, Date.parse(event.created_at) - Date.parse(call.startedAt));
                } else {
                    // A server tool (web search, knowledge) whose call wasn't recorded separately.
                    toolCalls.push({
                        id: id || `${turn}-${event.sequence}`, name: String(payload.tool ?? 'tool'), arguments: '', result: output,
                        handoff: false, needsApproval: false, executedBy: 'cencori',
                        startedAt: event.created_at, endedAt: event.created_at, durationMs: 0, resolution: null,
                    });
                }
            }
        }

        // The caller's tools run between the pause and the resume.
        const resolution = resumed ? (p(resumed).resolution === 'rejected' ? 'rejected' : 'approved') : null;
        for (const call of toolCalls) {
            if (call.executedBy !== 'caller') continue;
            if (paused) call.startedAt = paused.created_at;
            if (resumed) {
                call.endedAt = resumed.created_at;
                call.durationMs = Math.max(0, Date.parse(resumed.created_at) - Date.parse(call.startedAt));
            }
            if (call.needsApproval) call.resolution = resolution;
        }

        const terminalPayload = terminal ? p(terminal) : {};
        const trace = (terminalPayload.trace ?? {}) as Record<string, unknown>;
        const meta = (startedPayload.metadata ?? {}) as Record<string, unknown>;
        const usage = terminalPayload.usage as { input_tokens?: number; output_tokens?: number } | undefined;
        const startedAt = (started ?? list[0]).created_at;
        const endedAt = terminal?.created_at ?? null;
        const reason = paused ? p(paused).reason : null;

        turns.push({
            turn,
            model: typeof startedPayload.model === 'string' ? startedPayload.model : null,
            startedAt,
            endedAt,
            durationMs: endedAt ? Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)) : null,
            input: typeof startedPayload.input_text === 'string' && startedPayload.input_text ? clip(startedPayload.input_text) : null,
            resumedFrom: typeof resumedFromRaw === 'number' ? resumedFromRaw : null,
            text: clip(list.filter((e) => e.event_type === 'output_text.delta').map((e) => String(p(e).delta ?? '')).join('')),
            toolCalls,
            status: terminal?.event_type === 'turn.completed' ? 'completed'
                : terminal?.event_type === 'turn.failed' ? 'failed'
                : terminal?.event_type === 'turn.paused' ? 'paused'
                : 'running',
            pauseReason: reason === 'approval_required' || reason === 'tool_results_required' ? reason : paused ? 'approval_required' : null,
            resolution,
            error: terminal?.event_type === 'turn.failed'
                ? String((terminalPayload.output as { error?: unknown } | undefined)?.error ?? 'The turn failed.')
                : null,
            usage: usage ? { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 } : null,
            agent: typeof meta.agent === 'string' && meta.agent ? meta.agent : null,
            trace: {
                requestId: typeof trace.request_id === 'string' ? trace.request_id : null,
                provider: typeof trace.provider === 'string' ? trace.provider : null,
                model: typeof trace.model === 'string' ? trace.model : null,
                usedFallback: trace.used_fallback === true,
                costUsd: typeof trace.cost_usd === 'number' ? trace.cost_usd : null,
                ttftMs: typeof trace.ttft_ms === 'number' ? trace.ttft_ms : null,
                modelMs: typeof trace.model_ms === 'number' ? trace.model_ms : null,
                rounds: typeof trace.rounds === 'number' ? trace.rounds : null,
            },
        });
    }
    return turns;
}
