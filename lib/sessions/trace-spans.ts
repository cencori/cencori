/**
 * The session trace as spans on a shared time axis, for the console's
 * Timeline, Tree and Waterfall views (in the style of Vercel's tracing):
 * the session, each turn's model call, the tools it called and handoffs,
 * and the agents it ran as tools. Pure, so the views stay simple.
 */

import type { TimelineToolCall, TimelineTurn } from './observability';

export type SpanKind = 'session' | 'generation' | 'tool' | 'handoff' | 'agent';

export interface TraceSpan {
    id: string;
    parentId: string | null;
    kind: SpanKind;
    name: string;
    /** Secondary label: the model for a generation, "your code" for a caller tool. */
    detail: string | null;
    start: number;
    /** Null while still running. */
    end: number | null;
    status: 'ok' | 'error' | 'waiting' | 'rejected';
    depth: number;
    turn?: number;
    callId?: string;
    childSessionId?: string;
}

export interface TraceChild {
    id: string;
    status: string;
    agent: string | null;
    created_at: string;
    updated_at?: string;
}

function toolSpan(turn: TimelineTurn, call: TimelineToolCall, parentId: string): TraceSpan {
    const status: TraceSpan['status'] = call.resolution === 'rejected' ? 'rejected' : call.endedAt ? 'ok' : 'waiting';
    return {
        id: `tool:${call.id}`,
        parentId,
        kind: call.handoff ? 'handoff' : 'tool',
        name: call.handoff ? `→ ${call.name.replace(/^transfer_to_/, '').replace(/_/g, ' ')}` : call.name,
        detail: call.handoff ? 'handoff' : call.executedBy === 'caller' ? 'your code' : 'Cencori',
        start: Date.parse(call.startedAt),
        end: call.endedAt ? Date.parse(call.endedAt) : null,
        status,
        depth: 2,
        turn: turn.turn,
        callId: call.id,
    };
}

/** Spans in tree order: session, then each turn followed by its tools, then sub-agent runs. */
export function buildSpans(rootName: string, turns: TimelineTurn[], children: TraceChild[], sessionStatus: string): TraceSpan[] {
    if (turns.length === 0) return [];
    const spans: TraceSpan[] = [];
    const root: TraceSpan = {
        id: 'session', parentId: null, kind: 'session', name: rootName, detail: null,
        start: Date.parse(turns[0].startedAt), end: null, status: 'ok', depth: 0,
    };
    spans.push(root);
    for (const turn of turns) {
        const id = `turn:${turn.turn}`;
        spans.push({
            id,
            parentId: 'session',
            kind: 'generation',
            name: turn.agent ? `${turn.agent} · turn ${turn.turn}` : `Turn ${turn.turn}`,
            detail: turn.trace.model ?? turn.model,
            start: Date.parse(turn.startedAt),
            end: turn.endedAt ? Date.parse(turn.endedAt) : null,
            status: turn.status === 'failed' ? 'error' : turn.status === 'running' ? 'waiting' : 'ok',
            depth: 1,
            turn: turn.turn,
        });
        for (const call of turn.toolCalls) spans.push(toolSpan(turn, call, id));
    }
    for (const child of children) {
        const start = Date.parse(child.created_at);
        const end = child.updated_at ? Date.parse(child.updated_at) : start;
        spans.push({
            id: `agent:${child.id}`, parentId: 'session', kind: 'agent', name: child.agent ?? 'Agent', detail: 'sub-run',
            start, end: Math.max(start, end), status: child.status === 'failed' ? 'error' : 'ok', depth: 1, childSessionId: child.id,
        });
    }
    const rest = spans.slice(1);
    const running = sessionStatus === 'active' && rest.some((s) => s.end === null);
    const ends = rest.map((s) => s.end ?? s.start);
    root.end = running ? null : Math.max(...ends);
    return spans;
}

/** The axis: from the first span's start to the last end (now, if anything is still running). */
export function traceBounds(spans: TraceSpan[], now = Date.now()): { t0: number; t1: number; span: number } {
    const t0 = Math.min(...spans.map((s) => s.start));
    const t1 = Math.max(...spans.map((s) => s.end ?? now));
    return { t0, t1, span: Math.max(1, t1 - t0) };
}

/** Ruler ticks at a 1/2/5 × 10^n step, about `target` of them. */
export function niceTicks(spanMs: number, target = 6): number[] {
    const raw = spanMs / Math.max(1, target);
    const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
    const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
    const ticks: number[] = [];
    for (let t = 0; t <= spanMs + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000);
    return ticks;
}

export function formatTick(ms: number): string {
    if (ms === 0) return '0';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
    const m = Math.floor(ms / 60_000);
    const sec = Math.round((ms % 60_000) / 1000);
    return sec ? `${m}m${sec}s` : `${m}m`;
}

/**
 * Timeline lanes: spans of each depth packed into as few rows as possible
 * without overlapping, shallower depths first (a parent's lane sits above its
 * children's).
 */
export function packLanes(spans: TraceSpan[], now = Date.now()): TraceSpan[][] {
    const lanes: TraceSpan[][] = [];
    const maxDepth = Math.max(0, ...spans.map((s) => s.depth));
    for (let depth = 0; depth <= maxDepth; depth++) {
        const atDepth = spans.filter((s) => s.depth === depth).sort((a, b) => a.start - b.start);
        const local: { end: number; spans: TraceSpan[] }[] = [];
        for (const span of atDepth) {
            const end = span.end ?? now;
            const lane = local.find((l) => l.end <= span.start);
            if (lane) {
                lane.spans.push(span);
                lane.end = end;
            } else {
                local.push({ end, spans: [span] });
            }
        }
        lanes.push(...local.map((l) => l.spans));
    }
    return lanes;
}

export interface TraceGap {
    /** Where the collapsed gap sits on the axis, 0..1. */
    at: number;
    width: number;
    /** How long it really was. */
    realMs: number;
}

export interface TimeScale {
    t0: number;
    /** Position of a time on the axis, 0..1. */
    x: (t: number) => number;
    /** Length of the axis in time it shows (idle gaps counted at their collapsed length). */
    span: number;
    gaps: TraceGap[];
}

/** Gaps longer than this are idle time between turns, collapsed on the axis. */
const IDLE_GAP_MS = 30_000;

/**
 * The trace's time axis with idle gaps collapsed. A conversation can run for
 * hours while each turn takes a second or two; on a linear axis the turns
 * would vanish. Active time keeps its proportions; each gap longer than
 * IDLE_GAP_MS between activity shrinks to a short break, shown as such.
 */
export function timeScale(spans: TraceSpan[], now = Date.now()): TimeScale {
    const { t0, t1 } = traceBounds(spans, now);
    const intervals = spans
        .filter((s) => s.kind !== 'session')
        .map((s) => [s.start, Math.max(s.start, s.end ?? now)] as [number, number])
        .sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [a, b] of intervals) {
        const last = merged.at(-1);
        if (last && a <= last[1]) last[1] = Math.max(last[1], b);
        else merged.push([a, b]);
    }
    const active = merged.reduce((sum, [a, b]) => sum + (b - a), 0);
    const collapsed = Math.max(800, active * 0.04);

    // Each long gap: [start, end, collapsed length].
    const longGaps: Array<[number, number, number]> = [];
    for (let i = 1; i < merged.length; i++) {
        const gap = merged[i][0] - merged[i - 1][1];
        if (gap > IDLE_GAP_MS) longGaps.push([merged[i - 1][1], merged[i][0], collapsed]);
    }
    const virtual = (t: number) => {
        let v = t - t0;
        for (const [a, b, c] of longGaps) {
            if (t >= b) v -= (b - a) - c;
            else if (t > a) v -= ((t - a) / (b - a)) * ((b - a) - c);
        }
        return v;
    };
    const span = Math.max(1, virtual(t1));
    const x = (t: number) => Math.min(1, Math.max(0, virtual(t) / span));
    return {
        t0,
        x,
        span,
        gaps: longGaps.map(([a, b]) => ({ at: x(a), width: x(b) - x(a), realMs: b - a })),
    };
}

export function formatIdle(ms: number): string {
    if (ms < 3600_000) return `${Math.round(ms / 60_000)}m idle`;
    if (ms < 86_400_000) return `${Math.round(ms / 3600_000)}h idle`;
    return `${Math.round(ms / 86_400_000)}d idle`;
}
