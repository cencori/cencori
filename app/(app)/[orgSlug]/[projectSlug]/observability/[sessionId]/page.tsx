'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Copy, ExternalLink, Minus, Search, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useProjectIdBySlug } from '@/lib/hooks/useQueries';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RequestDetailModal } from '@/components/audit/RequestDetailModal';
import { SESSION_SOURCE_LABELS, type SessionSource, type TimelineTurn } from '@/lib/sessions/observability';
import { buildSpans, formatTick, niceTicks, packLanes, traceBounds, type SpanKind, type TraceSpan } from '@/lib/sessions/trace-spans';
import { SessionStatusBadge, formatDuration, formatSessionCost } from '@/components/sessions/session-ui';
import { cn } from '@/lib/utils';

// A session as a trace, in the style of Vercel's tracing: a Trace tab with
// Timeline, Tree and Waterfall views of the spans on one time axis (the
// session, each turn's model call, its tools and handoffs, sub-agent runs),
// an Events tab with the session's log, and the selected span in full on
// the right: its identifiers, timing, cost, exact input and output.

interface PageProps {
    params: Promise<{ orgSlug: string; projectSlug: string; sessionId: string }>;
}

type Turn = TimelineTurn & {
    log: { id: string; latencyMs: number | null; status: string | null; fallbackProvider: string | null; fallbackModel: string | null } | null;
};

interface SessionDetail {
    session: {
        id: string; status: string; source: SessionSource; agent: string | null; user: string | null; turns: number; cost_usd: number;
        usage: { inputTokens: number; outputTokens: number }; parent_session_id: string | null; duration_ms: number | null;
        tool_calls: number; models: string[]; agents: string[]; metadata: Record<string, unknown>;
        created_at: string; updated_at: string; expires_at: string | null;
    };
    turns: Turn[];
    truncated: boolean;
    children: Array<{ id: string; status: string; agent: string | null; turns: number; cost_usd: number; created_at: string; updated_at?: string }>;
}

interface TurnDetail {
    found: boolean;
    instructions: string | null;
    messages: Array<{ role: string; content: unknown; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>; tool_call_id?: string }>;
    messages_omitted: number;
    tools: Array<{ name?: string; description?: string; parameters?: unknown; needs_approval: boolean }>;
    settings: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    security: Record<string, unknown> | null;
    result: { event: string | null; output: unknown; knowledge_citations: unknown };
}

type View = 'timeline' | 'tree' | 'waterfall';

// ── formatting ──────────────────────────────────────────────────────────

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function stamp(ms: number, withDate = true): string {
    const d = new Date(ms);
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(Math.floor(d.getMilliseconds() / 10))}`;
    return withDate ? `${MONTHS[d.getMonth()]} ${pad(d.getDate())} ${time}` : time;
}

function spanDuration(span: TraceSpan): number | null {
    return span.end === null ? null : span.end - span.start;
}

const BAR_STYLE: Record<SpanKind, string> = {
    session: 'border-border bg-muted/40',
    generation: 'border-blue-500/40 bg-blue-500/10',
    tool: 'border-amber-500/40 bg-amber-500/10',
    handoff: 'border-violet-500/40 bg-violet-500/10',
    agent: 'border-emerald-500/40 bg-emerald-500/10',
};
const KIND_LABEL: Record<SpanKind, string> = { session: 'Session', generation: 'Model call', tool: 'Tool', handoff: 'Handoff', agent: 'Agent' };

// ── small parts ─────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button" aria-label="Copy"
            onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
        >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
    );
}

function KV({ rows }: { rows: Array<[string, React.ReactNode, string?] | false | null | undefined> }) {
    const visible = rows.filter(Boolean) as Array<[string, React.ReactNode, string?]>;
    return (
        <div className="divide-y divide-border/40 rounded-md border border-border/50">
            {visible.map(([label, value, copy]) => (
                <div key={label} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span className="shrink-0 text-muted-foreground">{label}</span>
                    <span className="ml-auto flex min-w-0 items-center gap-1.5 font-mono text-[11px]">
                        <span className="truncate">{value}</span>
                        {copy && <CopyButton text={copy} />}
                    </span>
                </div>
            ))}
        </div>
    );
}

function Card({ title, summary, children, defaultOpen = false }: { title: string; summary?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-md border border-border/50">
            <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs">
                {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <span className="font-medium">{title}</span>
                {summary !== undefined && <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">{summary}</span>}
            </button>
            {open && <div className="border-t border-border/40 p-3">{children}</div>}
        </div>
    );
}

function Pre({ value, empty = '—' }: { value: unknown; empty?: string }) {
    const text = value === null || value === undefined || value === '' ? empty : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">{text}</pre>;
}

function contentText(content: unknown): string {
    if (content === null || content === undefined) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map((p) => (p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : `[${(p as { type?: string })?.type ?? 'part'}]`)).join('\n');
    return JSON.stringify(content, null, 2);
}

const ROLE_COLOR: Record<string, string> = { system: 'text-muted-foreground', user: 'text-blue-600 dark:text-blue-400', assistant: 'text-emerald-600 dark:text-emerald-400', tool: 'text-amber-700 dark:text-amber-400' };

function Messages({ detail }: { detail: TurnDetail }) {
    return (
        <div className="space-y-2.5">
            {detail.messages_omitted > 0 && <p className="text-[11px] text-muted-foreground">{detail.messages_omitted} earlier messages not shown.</p>}
            {detail.messages.map((m, i) => (
                <div key={i}>
                    <p className={cn('mb-0.5 font-mono text-[10px] uppercase', ROLE_COLOR[m.role] ?? 'text-muted-foreground')}>
                        {m.role}{m.tool_call_id ? <span className="normal-case text-muted-foreground"> · result of {m.tool_call_id}</span> : null}
                    </p>
                    {contentText(m.content) && <p className="whitespace-pre-wrap break-words text-xs">{contentText(m.content)}</p>}
                    {m.tool_calls?.map((call, j) => (
                        <p key={j} className="mt-0.5 break-all font-mono text-[11px]">
                            <span className="text-amber-700 dark:text-amber-400">{call.function?.name}</span>({call.function?.arguments})
                        </p>
                    ))}
                </div>
            ))}
        </div>
    );
}

// ── views ───────────────────────────────────────────────────────────────

interface ViewProps {
    spans: TraceSpan[];
    bounds: { t0: number; span: number };
    selectedId: string;
    onSelect: (span: TraceSpan) => void;
}

function Ruler({ span, className }: { span: number; className?: string }) {
    const ticks = niceTicks(span);
    return (
        <div className={cn('relative h-6 border-b border-border/40', className)}>
            {ticks.map((t) => (
                <span key={t} className="absolute top-1.5 border-l border-border/60 pl-1 font-mono text-[10px] text-muted-foreground" style={{ left: `${(t / span) * 100}%` }}>
                    {formatTick(t)}
                </span>
            ))}
        </div>
    );
}

function TimelineView({ spans, bounds, selectedId, onSelect }: ViewProps) {
    const [zoom, setZoom] = useState(1);
    const lanes = useMemo(() => packLanes(spans), [spans]);
    const pos = (s: TraceSpan) => {
        const left = ((s.start - bounds.t0) / bounds.span) * 100;
        const width = (((s.end ?? Date.now()) - s.start) / bounds.span) * 100;
        return { left: `${Math.max(0, left)}%`, width: `${Math.max(0.3, Math.min(100 - left, width))}%` };
    };
    return (
        <div className="relative">
            {/* Overview */}
            <div className="mx-3 mt-3 rounded border border-border/50 bg-muted/20 px-1 py-1.5">
                {lanes.map((lane, i) => (
                    <div key={i} className="relative my-[2px] h-[3px]">
                        {lane.map((s) => <div key={s.id} className={cn('absolute h-[3px] rounded-full', s.id === selectedId ? 'bg-blue-500' : 'bg-muted-foreground/40')} style={pos(s)} />)}
                    </div>
                ))}
            </div>
            <div className="overflow-x-auto px-3 pb-12">
                <div style={{ width: `${zoom * 100}%` }} className="min-w-full">
                    <Ruler span={bounds.span} className="mt-2" />
                    <div className="space-y-1 pt-2">
                        {lanes.map((lane, i) => (
                            <div key={i} className="relative h-7">
                                {lane.map((s) => {
                                    const d = spanDuration(s);
                                    return (
                                        <button
                                            key={s.id} type="button" onClick={() => onSelect(s)} title={`${s.name} · ${formatDuration(d)}`}
                                            className={cn(
                                                'absolute top-0 flex h-7 items-center gap-1.5 overflow-hidden rounded border px-2 text-left text-[11px] transition-colors',
                                                BAR_STYLE[s.kind],
                                                s.id === selectedId && 'border-blue-500 bg-blue-500/20 ring-1 ring-blue-500',
                                                (s.status === 'error' || s.status === 'rejected') && 'border-red-500/60',
                                                s.end === null && 'animate-pulse',
                                            )}
                                            style={pos(s)}
                                        >
                                            <span className="truncate">{s.name}</span>
                                            <span className="ml-auto shrink-0 pl-1 font-mono text-[10px] text-muted-foreground">{formatDuration(d)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="absolute bottom-3 right-3 flex overflow-hidden rounded-md border border-border/60 bg-background">
                <button type="button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z / 2))} className="px-2 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"><ZoomOut className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Reset zoom" onClick={() => setZoom(1)} className="border-x border-border/60 px-2 py-1.5 text-muted-foreground hover:text-foreground"><Minus className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Zoom in" disabled={zoom >= 32} onClick={() => setZoom((z) => Math.min(32, z * 2))} className="px-2 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"><ZoomIn className="h-3.5 w-3.5" /></button>
            </div>
        </div>
    );
}

function RowsView({ spans, bounds, selectedId, onSelect, tree }: ViewProps & { tree: boolean }) {
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const hasChildren = useMemo(() => new Set(spans.map((s) => s.parentId).filter(Boolean) as string[]), [spans]);
    const rows = useMemo(() => {
        if (!tree) return [...spans].sort((a, b) => a.start - b.start || a.depth - b.depth);
        const hidden = new Set<string>();
        return spans.filter((s) => {
            if (s.parentId && (collapsed.has(s.parentId) || hidden.has(s.parentId))) { hidden.add(s.id); return false; }
            return true;
        });
    }, [spans, tree, collapsed]);

    return (
        <div>
            <div className="grid grid-cols-[minmax(0,45%)_minmax(0,1fr)_64px] border-b border-border/40">
                <span />
                <Ruler span={bounds.span} className="border-b-0" />
                <span />
            </div>
            {rows.map((s) => {
                const left = ((s.start - bounds.t0) / bounds.span) * 100;
                const width = (((s.end ?? Date.now()) - s.start) / bounds.span) * 100;
                const open = !collapsed.has(s.id);
                return (
                    <div
                        key={s.id} role="button" tabIndex={0} onClick={() => onSelect(s)}
                        onKeyDown={(e) => { if (e.key === 'Enter') onSelect(s); }}
                        className={cn('grid cursor-pointer grid-cols-[minmax(0,45%)_minmax(0,1fr)_64px] items-center border-b border-border/30 text-xs hover:bg-muted/40', s.id === selectedId && 'bg-muted/60')}
                    >
                        <div className="flex min-w-0 items-center gap-1.5 py-2 pr-2" style={{ paddingLeft: 8 + (tree ? s.depth * 18 : 0) }}>
                            {tree && hasChildren.has(s.id) ? (
                                <button type="button" aria-label={open ? 'Collapse' : 'Expand'} className="text-muted-foreground"
                                    onClick={(e) => { e.stopPropagation(); setCollapsed((prev) => { const next = new Set(prev); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; }); }}>
                                    {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </button>
                            ) : tree ? <span className="w-3" /> : <span className={cn('h-1 w-1 shrink-0 rounded-full', s.id === selectedId ? 'bg-blue-500' : 'bg-muted-foreground/50')} />}
                            <span className="truncate">{s.name}</span>
                            {s.detail && <span className="truncate text-muted-foreground">{s.detail}</span>}
                        </div>
                        <div className="relative h-full py-3">
                            <div className="absolute inset-x-0 top-1/2 h-px bg-border/50" />
                            <div
                                className={cn('absolute top-1/2 h-3 -translate-y-1/2 rounded-sm border', BAR_STYLE[s.kind], s.id === selectedId && 'border-blue-500 bg-blue-500/40', (s.status === 'error' || s.status === 'rejected') && 'border-red-500/60', s.end === null && 'animate-pulse')}
                                style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(0.4, Math.min(100 - left, width))}%` }}
                            />
                        </div>
                        <span className="pr-3 text-right font-mono text-[11px] text-muted-foreground">{formatDuration(spanDuration(s))}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ── events ──────────────────────────────────────────────────────────────

type EventLine = { at: number; level: 'TURN' | 'TOOL' | 'PAUSE' | 'RESUME' | 'DONE' | 'ERROR' | 'AGENT'; text: string; spanId: string };

function eventLines(turns: Turn[], children: SessionDetail['children']): EventLine[] {
    const lines: EventLine[] = [];
    for (const t of turns) {
        const span = `turn:${t.turn}`;
        lines.push({ at: Date.parse(t.startedAt), level: 'TURN', spanId: span, text: `turn ${t.turn} started${t.agent ? ` · ${t.agent}` : ''} · ${t.trace.model ?? t.model ?? ''}${t.input ? ` · "${t.input.slice(0, 120)}"` : t.resumedFrom ? ` · continues turn ${t.resumedFrom}` : ''}` });
        for (const c of t.toolCalls) {
            lines.push({ at: Date.parse(c.startedAt), level: 'TOOL', spanId: `tool:${c.id}`, text: `${c.handoff ? 'handoff' : c.name}(${c.arguments.replace(/\s+/g, ' ').slice(0, 160)}) · ${c.executedBy === 'caller' ? 'your code' : 'Cencori'}${c.needsApproval ? ' · needs approval' : ''}` });
        }
        if (t.status === 'paused' && t.endedAt) lines.push({ at: Date.parse(t.endedAt), level: 'PAUSE', spanId: span, text: t.pauseReason === 'approval_required' ? 'waiting for a person to approve' : 'waiting for tool results' });
        if (t.resolution) {
            const resumedAt = t.toolCalls.find((c) => c.endedAt)?.endedAt;
            if (resumedAt) lines.push({ at: Date.parse(resumedAt), level: 'RESUME', spanId: span, text: t.resolution === 'rejected' ? 'resumed · rejected' : 'resumed with tool results' });
        }
        if (t.status === 'completed' && t.endedAt) lines.push({ at: Date.parse(t.endedAt), level: 'DONE', spanId: span, text: `turn ${t.turn} completed${t.usage ? ` · ${t.usage.inputTokens}→${t.usage.outputTokens} tokens` : ''}${t.trace.costUsd !== null ? ` · ${formatSessionCost(t.trace.costUsd)}` : ''}${t.text ? ` · "${t.text.slice(0, 120)}"` : ''}` });
        if (t.status === 'failed' && t.endedAt) lines.push({ at: Date.parse(t.endedAt), level: 'ERROR', spanId: span, text: t.error ?? 'turn failed' });
    }
    for (const c of children) lines.push({ at: Date.parse(c.created_at), level: 'AGENT', spanId: `agent:${c.id}`, text: `${c.agent ?? 'agent'} sub-run · ${c.turns} turns` });
    return lines.sort((a, b) => a.at - b.at);
}

const LEVEL_COLOR: Record<EventLine['level'], string> = {
    TURN: 'text-blue-600 dark:text-blue-400', TOOL: 'text-amber-700 dark:text-amber-400', PAUSE: 'text-muted-foreground', RESUME: 'text-muted-foreground',
    DONE: 'text-emerald-600 dark:text-emerald-400', ERROR: 'text-red-600 dark:text-red-400', AGENT: 'text-emerald-600 dark:text-emerald-400',
};

// ── detail panel ────────────────────────────────────────────────────────

function TurnSections({ projectId, sessionId, turn }: { projectId: string; sessionId: string; turn: Turn }) {
    const { data: detail, isLoading } = useQuery<TurnDetail>({
        queryKey: ['session-turn', projectId, sessionId, turn.turn],
        queryFn: async ({ signal }) => {
            const res = await fetch(`/api/projects/${projectId}/sessions/${sessionId}/turns/${turn.turn}`, { signal });
            if (!res.ok) throw new Error('Could not load this turn.');
            return res.json();
        },
        staleTime: 60_000,
    });
    if (isLoading) return <Skeleton className="h-24 w-full" />;
    const citations = Array.isArray(detail?.result.knowledge_citations) ? (detail!.result.knowledge_citations as unknown[]) : [];
    return (
        <>
            <Card title="Input" summary={detail?.found ? `${detail.messages.length} messages` : 'not recorded'} defaultOpen>
                {detail?.found ? <Messages detail={detail} /> : <p className="text-xs text-muted-foreground">No input was recorded for this turn.</p>}
            </Card>
            <Card title="Output" summary={turn.toolCalls.length ? `${turn.toolCalls.length} tool calls` : turn.text ? 'text' : '—'} defaultOpen>
                {turn.text && <p className="whitespace-pre-wrap break-words text-xs">{turn.text}</p>}
                {turn.toolCalls.map((c) => (
                    <p key={c.id} className="mt-1 break-all font-mono text-[11px]"><span className="text-amber-700 dark:text-amber-400">{c.name}</span>({c.arguments.replace(/\s+/g, ' ')})</p>
                ))}
                {!turn.text && turn.toolCalls.length === 0 && <p className="text-xs text-muted-foreground">{turn.error ?? 'No output.'}</p>}
            </Card>
            {detail && detail.tools.length > 0 && (
                <Card title="Tools offered" summary={detail.tools.length}>
                    <div className="space-y-2">
                        {detail.tools.map((t) => (
                            <div key={t.name}>
                                <p className="font-mono text-[11px]">{t.name}{t.needs_approval && <span className="ml-2 font-sans text-[10px] text-amber-600">needs approval</span>}</p>
                                {t.description && <p className="text-[11px] text-muted-foreground">{t.description}</p>}
                                <Pre value={t.parameters} />
                            </div>
                        ))}
                    </div>
                </Card>
            )}
            {detail && <Card title="Settings" summary={(detail.settings.reasoning_effort as string | null) ?? ''}><Pre value={detail.settings} /></Card>}
            {detail?.instructions && <Card title="Instructions" summary={`${String(detail.instructions).length} chars`}><Pre value={detail.instructions} /></Card>}
            {detail?.metadata && <Card title="Turn metadata"><Pre value={detail.metadata} /></Card>}
            {detail?.security && <Card title="Input security" summary={(detail.security as { safe?: boolean }).safe === false ? 'flagged' : 'passed'}><Pre value={detail.security} /></Card>}
            {citations.length > 0 && <Card title="Knowledge citations" summary={citations.length}><Pre value={citations} /></Card>}
            {detail?.result.output !== undefined && detail?.result.output !== null && <Card title="Raw output"><Pre value={detail.result.output} /></Card>}
        </>
    );
}

function DetailPanel({ data, span, projectId, onClose, onOpenLog }: { data: SessionDetail; span: TraceSpan; projectId: string; onClose: () => void; onOpenLog: (id: string) => void }) {
    const s = data.session;
    const turn = span.turn !== undefined ? data.turns.find((t) => t.turn === span.turn) : undefined;
    const call = span.callId && turn ? turn.toolCalls.find((c) => c.id === span.callId) : undefined;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">{KIND_LABEL[span.kind]}</span>
                <span className="min-w-0 truncate font-mono text-xs">{span.name}</span>
                {span.kind !== 'session' && <button type="button" onClick={onClose} aria-label="Back to session" className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium"><span className={cn('h-2 w-2 rounded-full border', span.status === 'error' || span.status === 'rejected' ? 'border-red-500 bg-red-500/30' : span.end === null ? 'border-amber-500' : 'border-muted-foreground')} />Started</span>
                <span className="font-mono text-[11px] text-muted-foreground">{stamp(span.start)}</span>
            </div>

            {span.kind === 'session' && (
                <>
                    <KV rows={[
                        ['Session ID', s.id, s.id],
                        ['Status', <SessionStatusBadge key="st" status={s.status} />],
                        ['Source', SESSION_SOURCE_LABELS[s.source]],
                        ['Agent', s.agents.length ? s.agents.join(' → ') : s.agent ?? '—'],
                        s.user ? ['User', s.user, s.user] : null,
                        ['Duration', formatDuration(s.duration_ms)],
                        ['Turns', String(s.turns)],
                        ['Tool calls', String(s.tool_calls)],
                        ['Tokens', `${s.usage.inputTokens.toLocaleString()} → ${s.usage.outputTokens.toLocaleString()}`],
                        ['Cost', formatSessionCost(s.cost_usd)],
                        s.models.length ? ['Model', s.models.join(', ')] : null,
                        s.parent_session_id ? ['Parent session', `${s.parent_session_id.slice(0, 13)}…`, s.parent_session_id] : null,
                    ]} />
                    <Card title="Metadata" summary={`${Object.keys(s.metadata ?? {}).length} keys`} defaultOpen><Pre value={s.metadata} empty="{}" /></Card>
                </>
            )}

            {span.kind === 'generation' && turn && (
                <>
                    <KV rows={[
                        ['Turn', `${turn.turn}${turn.resumedFrom !== null ? ` · continues ${turn.resumedFrom}` : ''}`],
                        turn.agent ? ['Agent', turn.agent] : null,
                        ['Model', turn.trace.model ?? turn.model ?? '—'],
                        turn.trace.provider ? ['Provider', turn.trace.provider] : null,
                        ['Status', <SessionStatusBadge key="st" status={turn.status === 'paused' ? 'paused' : turn.status === 'failed' ? 'failed' : turn.status === 'running' ? 'running' : 'completed'} label={turn.status === 'paused' ? (turn.pauseReason === 'approval_required' ? 'Paused · approval' : 'Paused · tools') : undefined} />],
                        ['Duration', formatDuration(turn.durationMs)],
                        turn.trace.modelMs !== null ? ['Model time', formatDuration(turn.trace.modelMs)] : null,
                        turn.trace.ttftMs !== null ? ['First token', formatDuration(turn.trace.ttftMs)] : null,
                        turn.usage ? ['Tokens', `${turn.usage.inputTokens.toLocaleString()} → ${turn.usage.outputTokens.toLocaleString()}`] : null,
                        turn.trace.costUsd !== null ? ['Cost', formatSessionCost(turn.trace.costUsd)] : null,
                        turn.trace.rounds !== null ? ['Model rounds', String(turn.trace.rounds)] : null,
                        (turn.trace.usedFallback || turn.log?.fallbackProvider) ? ['Fallback', turn.log?.fallbackModel ?? turn.log?.fallbackProvider ?? 'yes'] : null,
                        turn.error ? ['Error', turn.error] : null,
                        turn.trace.requestId ? ['Request ID', turn.trace.requestId, turn.trace.requestId] : null,
                    ]} />
                    {turn.log && (
                        <button type="button" onClick={() => onOpenLog(turn.log!.id)} className="flex w-full items-center justify-between rounded-md border border-border/50 px-3 py-2 text-xs hover:bg-muted/40">
                            <span>Gateway log</span>
                            <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">{turn.log.status ?? ''}{turn.log.latencyMs !== null ? ` · ${turn.log.latencyMs}ms` : ''} <ExternalLink className="h-3 w-3" /></span>
                        </button>
                    )}
                    <TurnSections projectId={projectId} sessionId={s.id} turn={turn} />
                </>
            )}

            {(span.kind === 'tool' || span.kind === 'handoff') && turn && call && (
                <>
                    <KV rows={[
                        ['Tool', call.name],
                        ['Call ID', call.id, call.id],
                        ['Ran in', call.executedBy === 'caller' ? 'your code' : 'Cencori'],
                        ['Called by', `${turn.agent ?? 'agent'} · turn ${turn.turn}`],
                        ['Duration', formatDuration(call.durationMs)],
                        call.needsApproval ? ['Approval', call.resolution ?? 'waiting'] : null,
                        call.handoff ? ['Handed to', call.name.replace(/^transfer_to_/, '').replace(/_/g, ' ')] : null,
                    ]} />
                    <Card title="Arguments" defaultOpen><Pre value={call.arguments} empty="(none)" /></Card>
                    <Card title="Result" summary={call.result === null ? 'not sent back' : undefined} defaultOpen><Pre value={call.result} empty="Not sent back yet." /></Card>
                </>
            )}

            {span.kind === 'agent' && span.childSessionId && (
                <>
                    <KV rows={[['Session ID', span.childSessionId, span.childSessionId], ['Duration', formatDuration(spanDuration(span))]]} />
                    <p className="text-[11px] text-muted-foreground">Click the span again to open this sub-run.</p>
                </>
            )}
        </div>
    );
}

// ── page ────────────────────────────────────────────────────────────────

export default function SessionTracePage({ params }: PageProps) {
    const { orgSlug, projectSlug, sessionId } = use(params);
    const pathname = usePathname();
    const router = useRouter();
    const listHref = pathname.replace(/\/[^/]+\/?$/, '');
    const { data: projectId } = useProjectIdBySlug(orgSlug, projectSlug);
    const [tab, setTab] = useState<'trace' | 'events'>('trace');
    const [view, setView] = useState<View>('timeline');
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState('session');
    const [logId, setLogId] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery<SessionDetail>({
        queryKey: ['session', projectId, sessionId],
        queryFn: async ({ signal }) => {
            const response = await fetch(`/api/projects/${projectId}/sessions/${encodeURIComponent(sessionId)}`, { signal });
            if (response.status === 404) throw new Error('This session does not exist in this project.');
            if (!response.ok) throw new Error('Could not load this session.');
            return response.json();
        },
        enabled: Boolean(projectId),
        refetchInterval: (q) => (q.state.data?.session.status === 'active' || q.state.data?.session.status === 'paused' ? 5000 : false),
    });

    const spans = useMemo(() => (data ? buildSpans(data.session.agents.join(' → ') || data.session.agent || 'Session', data.turns, data.children, data.session.status) : []), [data]);
    const bounds = useMemo(() => (spans.length ? traceBounds(spans) : null), [spans]);
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? spans.filter((s) => s.kind === 'session' || `${s.name} ${s.detail ?? ''}`.toLowerCase().includes(q)) : spans;
    }, [spans, query]);
    const selected = spans.find((s) => s.id === selectedId) ?? spans[0];
    const events = useMemo(() => (data ? eventLines(data.turns, data.children) : []), [data]);

    const select = (span: TraceSpan) => {
        if (span.kind === 'agent' && span.childSessionId && span.id === selectedId) {
            router.push(`${listHref}/${span.childSessionId}`);
            return;
        }
        setSelectedId(span.id);
    };

    return (
        // The whole page: a bar with the way back and the session as a log line,
        // then the trace and the selected span side by side to the bottom of the
        // screen, each scrolling on its own.
        <div className="flex w-full flex-col lg:h-[calc(100svh-var(--maintenance-banner-height,0px)-3rem)]">
            {isLoading || !data ? (
                <>
                    <div className="flex h-11 shrink-0 items-center border-b border-border/50 px-4">
                        <Link href={listHref} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-3.5 w-3.5" /> Sessions
                        </Link>
                    </div>
                    {error ? <p className="px-5 py-16 text-center text-xs text-muted-foreground">{error instanceof Error ? error.message : 'Could not load this session.'}</p>
                        : <div className="space-y-3 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-[420px] w-full" /></div>}
                </>
            ) : (
                <>
                    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/50 px-4 py-2.5 font-mono text-xs">
                        <Link href={listHref} className="inline-flex items-center gap-1.5 font-sans text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-3.5 w-3.5" /> Sessions
                        </Link>
                        <span className="text-muted-foreground">{stamp(Date.parse(data.session.created_at))}</span>
                        <SessionStatusBadge status={data.session.status} />
                        <span>{SESSION_SOURCE_LABELS[data.session.source]}</span>
                        <span className="truncate">{data.session.agents.join(' → ') || data.session.agent || '—'}</span>
                        <span className="flex items-center gap-1.5 text-muted-foreground">{data.session.id}<CopyButton text={data.session.id} /></span>
                        <span className="ml-auto text-muted-foreground">{formatDuration(data.session.duration_ms)} · {data.session.turns} turns · {formatSessionCost(data.session.cost_usd)}</span>
                    </div>

                    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_400px]">
                        <section className="flex min-w-0 flex-col border-b border-border/50 lg:min-h-0 lg:border-b-0 lg:border-r">
                            <div className="flex shrink-0 items-center gap-1 border-b border-border/50 px-3 py-2">
                                {(['trace', 'events'] as const).map((t) => (
                                    <button key={t} type="button" onClick={() => setTab(t)} className={cn('rounded-md px-2.5 py-1 text-xs', tab === t ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}>
                                        {t === 'events' ? `Events (${events.length})` : 'Trace'}
                                    </button>
                                ))}
                            </div>

                            <div className="min-h-0 flex-1 lg:overflow-y-auto">
                            {tab === 'trace' ? (
                                <>
                                    <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                                            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search spans..." className="h-8 pl-7 text-xs shadow-none" />
                                        </div>
                                        <Select value={view} onValueChange={(v) => setView(v as View)}>
                                            <SelectTrigger className="h-8 w-[130px] text-xs shadow-none"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="timeline" className="text-xs">Timeline</SelectItem>
                                                <SelectItem value="tree" className="text-xs">Tree</SelectItem>
                                                <SelectItem value="waterfall" className="text-xs">Waterfall</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {!bounds ? (
                                        <p className="py-16 text-center text-xs text-muted-foreground">No turns yet.</p>
                                    ) : view === 'timeline' ? (
                                        <TimelineView spans={visible} bounds={bounds} selectedId={selected?.id ?? ''} onSelect={select} />
                                    ) : (
                                        <RowsView spans={visible} bounds={bounds} selectedId={selected?.id ?? ''} onSelect={select} tree={view === 'tree'} />
                                    )}
                                    {data.truncated && <p className="px-3 py-2 text-[11px] text-muted-foreground">Long session: only the first 5,000 events are shown.</p>}
                                </>
                            ) : (
                                <div>
                                    {events.map((e, i) => (
                                        <button key={i} type="button" onClick={() => setSelectedId(e.spanId)} className={cn('grid w-full grid-cols-[104px_64px_minmax(0,1fr)] items-start gap-3 border-b border-border/30 px-3 py-1.5 text-left font-mono text-[11px] hover:bg-muted/40', e.spanId === selected?.id && 'bg-muted/50')}>
                                            <span className="text-muted-foreground">{stamp(e.at, false)}</span>
                                            <span className={LEVEL_COLOR[e.level]}>{e.level}</span>
                                            <span className="break-words">{e.text}</span>
                                        </button>
                                    ))}
                                    {events.length === 0 && <p className="py-16 text-center text-xs text-muted-foreground">No events yet.</p>}
                                </div>
                            )}
                            </div>
                        </section>

                        <aside className="min-w-0 p-4 lg:min-h-0 lg:overflow-y-auto">
                            {selected && projectId && (
                                <DetailPanel data={data} span={selected} projectId={projectId} onClose={() => setSelectedId('session')} onOpenLog={setLogId} />
                            )}
                        </aside>
                    </div>
                </>
            )}

            {projectId && logId && (
                <RequestDetailModal projectId={projectId} requestId={logId} open onOpenChange={(open) => { if (!open) setLogId(null); }} />
            )}
        </div>
    );
}
