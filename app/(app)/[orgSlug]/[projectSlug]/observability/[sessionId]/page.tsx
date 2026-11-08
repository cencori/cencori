'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { useProjectIdBySlug } from '@/lib/hooks/useQueries';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RequestDetailModal } from '@/components/audit/RequestDetailModal';
import { SESSION_SOURCE_LABELS, type SessionSource, type TimelineToolCall, type TimelineTurn } from '@/lib/sessions/observability';
import { SessionStatusBadge, formatDuration, formatSessionCost, formatSessionTime } from '@/components/sessions/session-ui';
import { cn } from '@/lib/utils';

// A session as a trace, in the shape of Langfuse: a tree of observations
// (the session, each turn's model call, the tools it called, handoffs and
// the agents it ran as tools) on a shared time axis, and the selected
// observation in full: its exact input, its output, and its metadata.

interface PageProps {
    params: Promise<{ orgSlug: string; projectSlug: string; sessionId: string }>;
}

type Turn = TimelineTurn & {
    log: { id: string; latencyMs: number | null; status: string | null; fallbackProvider: string | null; fallbackModel: string | null } | null;
};

interface SessionDetail {
    session: {
        id: string;
        status: string;
        source: SessionSource;
        agent: string | null;
        user: string | null;
        turns: number;
        cost_usd: number;
        usage: { inputTokens: number; outputTokens: number };
        parent_session_id: string | null;
        duration_ms: number | null;
        tool_calls: number;
        models: string[];
        agents: string[];
        metadata: Record<string, unknown>;
        created_at: string;
        updated_at: string;
        expires_at: string | null;
    };
    turns: Turn[];
    truncated: boolean;
    children: Array<{ id: string; status: string; agent: string | null; turns: number; cost_usd: number; created_at: string }>;
}

interface TurnDetail {
    found: boolean;
    model: string | null;
    instructions: string | null;
    messages: Array<{ role: string; content: unknown; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>; tool_call_id?: string }>;
    messages_omitted: number;
    tools: Array<{ name?: string; description?: string; parameters?: unknown; needs_approval: boolean }>;
    settings: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    security: Record<string, unknown> | null;
    result: { event: string | null; output: unknown; actions: unknown; usage: unknown; trace: unknown; knowledge_citations: unknown };
}

type Selection =
    | { kind: 'session' }
    | { kind: 'turn'; turn: number }
    | { kind: 'tool'; turn: number; callId: string };

type ObservationKind = 'SESSION' | 'GENERATION' | 'TOOL' | 'HANDOFF' | 'AGENT';

const KIND_STYLE: Record<ObservationKind, string> = {
    SESSION: 'bg-muted text-muted-foreground',
    GENERATION: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    TOOL: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    HANDOFF: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    AGENT: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

function KindBadge({ kind }: { kind: ObservationKind }) {
    return <span className={cn('shrink-0 rounded px-1 py-px font-mono text-[9px] font-medium tracking-wide', KIND_STYLE[kind])}>{kind}</span>;
}

function JsonBlock({ value, empty = '—' }: { value: unknown; empty?: string }) {
    const text = value === null || value === undefined || value === ''
        ? empty
        : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/40 bg-muted/20 p-3 font-mono text-[11px] leading-relaxed">{text}</pre>;
}

function CopyText({ text, label }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            aria-label={`Copy ${label ?? 'value'}`}
        >
            {label ?? text}
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
    );
}

function Chip({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'warn' | 'error' }) {
    return (
        <div className={cn('rounded-md border px-2 py-1', tone === 'warn' ? 'border-amber-500/30 bg-amber-500/5' : tone === 'error' ? 'border-red-500/30 bg-red-500/5' : 'border-border/50')}>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="font-mono text-[11px]">{value}</p>
        </div>
    );
}

function contentText(content: unknown): string {
    if (content === null || content === undefined) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map((part) => {
            if (part && typeof part === 'object') {
                const p = part as { type?: string; text?: string };
                if (typeof p.text === 'string') return p.text;
                return `[${p.type ?? 'part'}]`;
            }
            return String(part);
        }).join('\n');
    }
    return JSON.stringify(content, null, 2);
}

const ROLE_STYLE: Record<string, string> = {
    system: 'border-l-muted-foreground/40',
    user: 'border-l-blue-500/60',
    assistant: 'border-l-emerald-500/60',
    tool: 'border-l-amber-500/60',
};

function MessageList({ detail }: { detail: TurnDetail }) {
    return (
        <div className="space-y-2">
            {detail.messages_omitted > 0 && <p className="text-[11px] text-muted-foreground">{detail.messages_omitted} earlier messages not shown.</p>}
            {detail.messages.map((m, i) => (
                <div key={i} className={cn('rounded-md border border-border/40 border-l-2 bg-muted/10 px-3 py-2', ROLE_STYLE[m.role] ?? 'border-l-border')}>
                    <p className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {m.role}
                        {m.tool_call_id && <span className="font-mono normal-case tracking-normal">result of {m.tool_call_id}</span>}
                    </p>
                    {contentText(m.content) && <p className="whitespace-pre-wrap break-words text-xs">{contentText(m.content)}</p>}
                    {m.tool_calls?.map((call, j) => (
                        <div key={j} className="mt-1.5 rounded border border-border/40 bg-background/60 px-2 py-1 font-mono text-[11px]">
                            <span className="text-amber-700 dark:text-amber-400">{call.function?.name}</span>
                            <span className="text-muted-foreground"> ({call.id})</span>
                            <pre className="mt-0.5 whitespace-pre-wrap break-all">{call.function?.arguments}</pre>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

/** Where an observation sits on the session's time axis. */
function Bar({ start, end, t0, span, kind }: { start: string; end: string | null; t0: number; span: number; kind: ObservationKind }) {
    const s = Date.parse(start) - t0;
    const e = (end ? Date.parse(end) : Date.now()) - t0;
    const left = Math.min(100, Math.max(0, (s / span) * 100));
    const width = Math.max(0.6, Math.min(100 - left, ((e - s) / span) * 100));
    const color = kind === 'GENERATION' ? 'bg-blue-500/60' : kind === 'TOOL' ? 'bg-amber-500/60' : kind === 'HANDOFF' ? 'bg-violet-500/60' : kind === 'AGENT' ? 'bg-emerald-500/60' : 'bg-muted-foreground/40';
    return (
        <div className="relative h-1.5 w-full rounded-full bg-muted/50">
            <div className={cn('absolute top-0 h-1.5 rounded-full', color, !end && 'animate-pulse')} style={{ left: `${left}%`, width: `${width}%` }} />
        </div>
    );
}

function TreeRow({
    depth, kind, name, meta, selected, onClick, bar, expandable, expanded, onToggle,
}: {
    depth: number; kind: ObservationKind; name: React.ReactNode; meta: React.ReactNode; selected: boolean; onClick: () => void;
    bar: React.ReactNode; expandable?: boolean; expanded?: boolean; onToggle?: () => void;
}) {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
            className={cn('grid cursor-pointer grid-cols-[minmax(0,1fr)_minmax(80px,32%)] items-center gap-3 border-b border-border/30 py-1.5 pr-3 text-xs hover:bg-muted/40', selected && 'bg-muted/60')}
            style={{ paddingLeft: 8 + depth * 16 }}
        >
            <div className="flex min-w-0 items-center gap-1.5">
                {expandable ? (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onToggle?.(); }} className="text-muted-foreground" aria-label={expanded ? 'Collapse' : 'Expand'}>
                        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                ) : <span className="w-3" />}
                <KindBadge kind={kind} />
                <span className="truncate">{name}</span>
                <span className="ml-auto shrink-0 pl-2 font-mono text-[10px] text-muted-foreground">{meta}</span>
            </div>
            {bar}
        </div>
    );
}

function toolKind(call: TimelineToolCall): ObservationKind {
    return call.handoff ? 'HANDOFF' : 'TOOL';
}

function TurnPanel({ projectId, sessionId, turn, onOpenLog }: { projectId: string; sessionId: string; turn: Turn; onOpenLog: (id: string) => void }) {
    const { data: detail, isLoading } = useQuery<TurnDetail>({
        queryKey: ['session-turn', projectId, sessionId, turn.turn],
        queryFn: async ({ signal }) => {
            const res = await fetch(`/api/projects/${projectId}/sessions/${sessionId}/turns/${turn.turn}`, { signal });
            if (!res.ok) throw new Error('Could not load this turn.');
            return res.json();
        },
        staleTime: 60_000,
    });
    const latency = turn.trace.modelMs ?? turn.log?.latencyMs ?? turn.durationMs;
    const fallback = turn.trace.usedFallback || Boolean(turn.log?.fallbackProvider);

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <KindBadge kind="GENERATION" />
                <h2 className="text-sm font-medium">{turn.agent ? `${turn.agent} · ` : ''}Turn {turn.turn}</h2>
                <SessionStatusBadge
                    status={turn.status === 'paused' ? 'paused' : turn.status === 'completed' ? 'completed' : turn.status === 'failed' ? 'failed' : 'running'}
                    label={turn.status === 'paused' ? (turn.pauseReason === 'approval_required' ? 'Paused · approval' : 'Paused · tools') : undefined}
                />
                {turn.trace.requestId && turn.log && (
                    <button type="button" onClick={() => onOpenLog(turn.log!.id)} className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                        Open in Logs <ExternalLink className="h-3 w-3" />
                    </button>
                )}
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
                {formatSessionTime(turn.startedAt)}
                {turn.resumedFrom !== null && ` · continues turn ${turn.resumedFrom} after its tool results`}
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
                <Chip label="Model" value={turn.trace.model ?? turn.model ?? '—'} />
                {turn.trace.provider && <Chip label="Provider" value={turn.trace.provider} />}
                <Chip label="Latency" value={formatDuration(latency)} />
                {turn.trace.ttftMs !== null && <Chip label="First token" value={formatDuration(turn.trace.ttftMs)} />}
                {turn.usage && <Chip label="Tokens" value={`${turn.usage.inputTokens.toLocaleString()} → ${turn.usage.outputTokens.toLocaleString()}`} />}
                {turn.trace.costUsd !== null && <Chip label="Cost" value={formatSessionCost(turn.trace.costUsd)} />}
                {turn.trace.rounds !== null && turn.trace.rounds > 1 && <Chip label="Model rounds" value={turn.trace.rounds} />}
                {fallback && <Chip label="Fallback" value={turn.log?.fallbackModel ?? turn.log?.fallbackProvider ?? 'yes'} tone="warn" />}
                {turn.status === 'failed' && <Chip label="Error" value={turn.error} tone="error" />}
            </div>

            <Tabs defaultValue="input">
                <TabsList className="h-8">
                    <TabsTrigger value="input" className="text-xs">Input</TabsTrigger>
                    <TabsTrigger value="output" className="text-xs">Output</TabsTrigger>
                    <TabsTrigger value="tools" className="text-xs">Tools{detail?.tools.length ? ` (${detail.tools.length})` : ''}</TabsTrigger>
                    <TabsTrigger value="metadata" className="text-xs">Metadata</TabsTrigger>
                </TabsList>
                <TabsContent value="input" className="mt-3">
                    {isLoading ? <Skeleton className="h-40 w-full" /> : detail?.found ? <MessageList detail={detail} /> : (
                        <p className="text-xs text-muted-foreground">No input was recorded for this turn.</p>
                    )}
                </TabsContent>
                <TabsContent value="output" className="mt-3 space-y-3">
                    {turn.text && (
                        <div className="rounded-md border border-border/40 border-l-2 border-l-emerald-500/60 bg-muted/10 px-3 py-2">
                            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">assistant</p>
                            <p className="whitespace-pre-wrap break-words text-xs">{turn.text}</p>
                        </div>
                    )}
                    {turn.toolCalls.map((call) => (
                        <div key={call.id} className="rounded-md border border-border/40 bg-background/60 px-3 py-2 font-mono text-[11px]">
                            <span className="text-amber-700 dark:text-amber-400">{call.name}</span>
                            <span className="text-muted-foreground"> ({call.id})</span>
                            <pre className="mt-1 whitespace-pre-wrap break-all">{call.arguments}</pre>
                        </div>
                    ))}
                    {!turn.text && turn.toolCalls.length === 0 && <p className="text-xs text-muted-foreground">{turn.error ?? 'No output.'}</p>}
                    {detail?.result.output !== undefined && detail?.result.output !== null && (
                        <details>
                            <summary className="cursor-pointer text-[11px] text-muted-foreground">Raw output</summary>
                            <div className="mt-2"><JsonBlock value={detail.result.output} /></div>
                        </details>
                    )}
                </TabsContent>
                <TabsContent value="tools" className="mt-3 space-y-2">
                    {isLoading ? <Skeleton className="h-24 w-full" /> : detail?.tools.length ? detail.tools.map((t) => (
                        <details key={t.name} className="rounded-md border border-border/40 px-3 py-2">
                            <summary className="cursor-pointer text-xs">
                                <span className="font-mono">{t.name}</span>
                                {t.needs_approval && <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">needs approval</span>}
                                {t.description && <span className="ml-2 text-muted-foreground">{t.description}</span>}
                            </summary>
                            <div className="mt-2"><JsonBlock value={t.parameters} /></div>
                        </details>
                    )) : <p className="text-xs text-muted-foreground">No tools offered.</p>}
                </TabsContent>
                <TabsContent value="metadata" className="mt-3 space-y-3">
                    <div>
                        <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Request</p>
                        <JsonBlock value={{
                            request_id: turn.trace.requestId,
                            log_id: turn.log?.id ?? null,
                            status: turn.log?.status ?? null,
                            ...(turn.trace as Record<string, unknown>),
                        }} />
                    </div>
                    {detail && (
                        <>
                            <div>
                                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Settings</p>
                                <JsonBlock value={detail.settings} />
                            </div>
                            {detail.metadata && (
                                <div>
                                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Turn metadata</p>
                                    <JsonBlock value={detail.metadata} />
                                </div>
                            )}
                            {detail.security && (
                                <div>
                                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Input security check</p>
                                    <JsonBlock value={detail.security} />
                                </div>
                            )}
                            {Array.isArray(detail.result.knowledge_citations) && detail.result.knowledge_citations.length > 0 && (
                                <div>
                                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Knowledge citations</p>
                                    <JsonBlock value={detail.result.knowledge_citations} />
                                </div>
                            )}
                        </>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function ToolPanel({ turn, call }: { turn: Turn; call: TimelineToolCall }) {
    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <KindBadge kind={toolKind(call)} />
                <h2 className="font-mono text-sm">{call.name}</h2>
                {call.resolution === 'approved' && <SessionStatusBadge status="completed" label="Approved" />}
                {call.resolution === 'rejected' && <SessionStatusBadge status="failed" label="Rejected" />}
                {call.needsApproval && !call.resolution && <SessionStatusBadge status="paused" label="Awaiting approval" />}
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
                Called in turn {turn.turn}{turn.agent ? ` by ${turn.agent}` : ''} · {formatSessionTime(call.startedAt)}
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
                <Chip label="Ran in" value={call.executedBy === 'caller' ? 'your code' : 'Cencori'} />
                <Chip label={call.executedBy === 'caller' ? (call.needsApproval ? 'Pause to resume' : 'Your code + network') : 'Duration'} value={formatDuration(call.durationMs)} />
                <Chip label="Call id" value={<CopyText text={call.id} />} />
            </div>
            {call.handoff ? (
                <p className="mb-3 text-xs">The conversation was handed to <span className="font-medium">{call.name.replace(/^transfer_to_/, '').replace(/_/g, ' ')}</span>; the next turn answers as that agent.</p>
            ) : null}
            <div className="space-y-3">
                <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Input (arguments)</p>
                    <JsonBlock value={call.arguments} empty="(none)" />
                </div>
                <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Output (result)</p>
                    <JsonBlock value={call.result} empty="Not sent back yet." />
                </div>
            </div>
        </div>
    );
}

/** One session as a trace. */
export default function SessionTracePage({ params }: PageProps) {
    const { orgSlug, projectSlug, sessionId } = use(params);
    const pathname = usePathname();
    const listHref = pathname.replace(/\/[^/]+\/?$/, '');
    const { data: projectId } = useProjectIdBySlug(orgSlug, projectSlug);
    const [selection, setSelection] = useState<Selection>({ kind: 'session' });
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
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
        refetchInterval: (query) => (query.state.data?.session.status === 'active' || query.state.data?.session.status === 'paused' ? 5000 : false),
    });

    const axis = useMemo(() => {
        if (!data || data.turns.length === 0) return null;
        const t0 = Date.parse(data.turns[0].startedAt);
        let end = t0;
        for (const t of data.turns) {
            end = Math.max(end, Date.parse(t.endedAt ?? t.startedAt));
            for (const c of t.toolCalls) end = Math.max(end, Date.parse(c.endedAt ?? c.startedAt));
        }
        for (const c of data.children) end = Math.max(end, Date.parse(c.created_at));
        if (data.turns.some((t) => !t.endedAt)) end = Math.max(end, Date.now());
        return { t0, span: Math.max(1, end - t0), end };
    }, [data]);

    const selectedTurn = data && selection.kind !== 'session' ? data.turns.find((t) => t.turn === selection.turn) : undefined;
    const selectedCall = selection.kind === 'tool' ? selectedTurn?.toolCalls.find((c) => c.id === selection.callId) : undefined;

    return (
        <div className="w-full max-w-[1500px] mx-auto px-0 sm:px-6 pt-0 pb-8 sm:pt-6">
            <Link href={listHref} className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" />
                Sessions
            </Link>

            {isLoading || !data ? (
                error ? (
                    <p className="rounded-md border border-border/40 bg-muted/30 px-5 py-12 text-center text-xs text-muted-foreground">{error instanceof Error ? error.message : 'Could not load this session.'}</p>
                ) : (
                    <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-96 w-full" /></div>
                )
            ) : (
                <>
                    <header className="mb-4 rounded-md border border-border/40 bg-card p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h1 className="text-base font-medium">{data.session.agents.length ? data.session.agents.join(' → ') : data.session.agent ?? 'Session'}</h1>
                            <SessionStatusBadge status={data.session.status} />
                            <span className="text-xs text-muted-foreground">{SESSION_SOURCE_LABELS[data.session.source]}</span>
                        </div>
                        <CopyText text={data.session.id} />
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Chip label="Started" value={formatSessionTime(data.session.created_at)} />
                            <Chip label="Duration" value={formatDuration(data.session.duration_ms)} />
                            <Chip label="Turns" value={data.session.turns} />
                            <Chip label="Tool calls" value={data.session.tool_calls} />
                            <Chip label="Tokens" value={`${data.session.usage.inputTokens.toLocaleString()} → ${data.session.usage.outputTokens.toLocaleString()}`} />
                            <Chip label="Cost" value={formatSessionCost(data.session.cost_usd)} />
                            {data.session.models.length > 0 && <Chip label={data.session.models.length > 1 ? 'Models' : 'Model'} value={data.session.models.join(', ')} />}
                            {data.session.user && <Chip label="User" value={data.session.user} />}
                        </div>
                        {data.session.parent_session_id && (
                            <p className="mt-3 text-xs text-muted-foreground">
                                Run as a tool by <Link className="font-mono underline underline-offset-2" href={`${listHref}/${data.session.parent_session_id}`}>{data.session.parent_session_id.slice(0, 8)}</Link>
                            </p>
                        )}
                    </header>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                        <section className="overflow-hidden rounded-md border border-border/40 bg-card lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
                            <div className="grid grid-cols-[minmax(0,1fr)_minmax(80px,32%)] gap-3 border-b border-border/40 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                <span>Trace</span>
                                <span className="flex justify-between font-mono normal-case tracking-normal"><span>0</span><span>{axis ? formatDuration(axis.span) : ''}</span></span>
                            </div>
                            {axis && (
                                <>
                                    <TreeRow
                                        depth={0} kind="SESSION" name={data.session.agent ?? 'Session'}
                                        meta={formatDuration(data.session.duration_ms)}
                                        selected={selection.kind === 'session'} onClick={() => setSelection({ kind: 'session' })}
                                        bar={<Bar start={data.turns[0].startedAt} end={new Date(axis.end).toISOString()} t0={axis.t0} span={axis.span} kind="SESSION" />}
                                    />
                                    {data.turns.map((turn) => {
                                        const open = !collapsed.has(turn.turn);
                                        return (
                                            <div key={turn.turn}>
                                                <TreeRow
                                                    depth={1} kind="GENERATION"
                                                    name={<>{turn.agent ? <span className="font-medium">{turn.agent}</span> : `Turn ${turn.turn}`}<span className="ml-1.5 text-muted-foreground">{turn.trace.model ?? turn.model}</span></>}
                                                    meta={<>{turn.trace.costUsd !== null ? `${formatSessionCost(turn.trace.costUsd)} · ` : ''}{formatDuration(turn.durationMs)}</>}
                                                    selected={selection.kind === 'turn' && selection.turn === turn.turn}
                                                    onClick={() => setSelection({ kind: 'turn', turn: turn.turn })}
                                                    expandable={turn.toolCalls.length > 0} expanded={open}
                                                    onToggle={() => setCollapsed((prev) => { const next = new Set(prev); if (next.has(turn.turn)) next.delete(turn.turn); else next.add(turn.turn); return next; })}
                                                    bar={<Bar start={turn.startedAt} end={turn.endedAt} t0={axis.t0} span={axis.span} kind="GENERATION" />}
                                                />
                                                {open && turn.toolCalls.map((call) => (
                                                    <TreeRow
                                                        key={call.id} depth={2} kind={toolKind(call)}
                                                        name={<span className="font-mono">{call.handoff ? call.name.replace(/^transfer_to_/, '→ ') : call.name}{call.needsApproval && <span className="ml-1.5 font-sans text-[10px] text-amber-600">{call.resolution ?? 'approval'}</span>}</span>}
                                                        meta={formatDuration(call.durationMs)}
                                                        selected={selection.kind === 'tool' && selection.callId === call.id}
                                                        onClick={() => setSelection({ kind: 'tool', turn: turn.turn, callId: call.id })}
                                                        bar={<Bar start={call.startedAt} end={call.endedAt} t0={axis.t0} span={axis.span} kind={toolKind(call)} />}
                                                    />
                                                ))}
                                            </div>
                                        );
                                    })}
                                    {data.children.map((child) => (
                                        <Link key={child.id} href={`${listHref}/${child.id}`} className="block">
                                            <TreeRow
                                                depth={1} kind="AGENT" name={<>{child.agent ?? 'Agent'} <span className="text-muted-foreground">sub-run</span></>}
                                                meta={`${child.turns} turns · ${formatSessionCost(child.cost_usd)}`}
                                                selected={false} onClick={() => {}}
                                                bar={<Bar start={child.created_at} end={child.created_at} t0={axis.t0} span={axis.span} kind="AGENT" />}
                                            />
                                        </Link>
                                    ))}
                                </>
                            )}
                            {!axis && <p className="px-3 py-10 text-center text-xs text-muted-foreground">No turns yet.</p>}
                            {data.truncated && <p className="px-3 py-2 text-[11px] text-muted-foreground">Long session: only the first 5,000 events are shown.</p>}
                        </section>

                        <section className="min-w-0 rounded-md border border-border/40 bg-card p-4">
                            {selection.kind === 'session' || !selectedTurn ? (
                                <div>
                                    <div className="mb-3 flex items-center gap-2"><KindBadge kind="SESSION" /><h2 className="text-sm font-medium">Session</h2></div>
                                    <p className="mb-3 text-xs text-muted-foreground">Select a model call or tool on the left to see its exact input, output and metadata.</p>
                                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Metadata</p>
                                    <JsonBlock value={data.session.metadata} empty="{}" />
                                </div>
                            ) : selection.kind === 'tool' && selectedCall ? (
                                <ToolPanel turn={selectedTurn} call={selectedCall} />
                            ) : projectId ? (
                                <TurnPanel projectId={projectId} sessionId={sessionId} turn={selectedTurn} onOpenLog={setLogId} />
                            ) : null}
                        </section>
                    </div>
                </>
            )}

            {projectId && logId && (
                <RequestDetailModal projectId={projectId} requestId={logId} open={Boolean(logId)} onOpenChange={(open) => { if (!open) setLogId(null); }} />
            )}
        </div>
    );
}
