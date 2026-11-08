'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRightLeft, Check, ChevronRight, Copy, Hand, Wrench, X } from 'lucide-react';
import { useProjectIdBySlug } from '@/lib/hooks/useQueries';
import { Skeleton } from '@/components/ui/skeleton';
import { SESSION_SOURCE_LABELS, type SessionSource, type TimelineToolCall, type TimelineTurn } from '@/lib/sessions/observability';
import { SessionStatusBadge, formatDuration, formatSessionCost, formatSessionTime } from '@/components/sessions/session-ui';
import { cn } from '@/lib/utils';

interface PageProps {
    params: Promise<{ orgSlug: string; projectSlug: string; sessionId: string }>;
}

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
        created_at: string;
        updated_at: string;
        expires_at: string | null;
    };
    turns: TimelineTurn[];
    truncated: boolean;
    children: Array<{ id: string; status: string; agent: string | null; turns: number; cost_usd: number; created_at: string }>;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-0.5 truncate text-xs font-mono">{value}</p>
        </div>
    );
}

function CopyId({ id }: { id: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            onClick={() => { void navigator.clipboard.writeText(id); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
            aria-label="Copy session id"
        >
            {id}
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
    );
}

function ToolCallCard({ call }: { call: TimelineToolCall }) {
    const [open, setOpen] = useState(false);
    if (call.handoff) {
        return (
            <div className="flex items-center gap-2 rounded-md border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2 text-xs">
                <ArrowRightLeft className="h-3.5 w-3.5 text-violet-500" />
                <span>Handed off to <span className="font-medium">{call.name.replace(/^transfer_to_/, '').replace(/_/g, ' ')}</span></span>
            </div>
        );
    }
    return (
        <div className="rounded-md border border-border/50 bg-muted/20">
            <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs">
                <ChevronRight className={cn('h-3 w-3 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
                <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-mono">{call.name}</span>
                {call.needsApproval && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">needs approval</span>}
                <span className="ml-auto text-[10px] text-muted-foreground">{call.result === null ? 'no result yet' : 'result'}</span>
            </button>
            {open && (
                <div className="space-y-2 border-t border-border/40 px-3 py-2">
                    <div>
                        <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Arguments</p>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-2 font-mono text-[11px]">{call.arguments || '(none)'}</pre>
                    </div>
                    <div>
                        <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Result</p>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-2 font-mono text-[11px]">{call.result ?? 'Not sent back yet.'}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}

function TurnBlock({ turn, isLast, sessionStatus }: { turn: TimelineTurn; isLast: boolean; sessionStatus: string }) {
    const waiting = turn.status === 'paused' && !turn.resolution && isLast && sessionStatus === 'paused';
    return (
        <li className="relative pl-6">
            <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border border-border bg-background" />
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Turn {turn.turn}</span>
                {turn.resumedFrom !== null && <span>continues turn {turn.resumedFrom}</span>}
                {turn.model && <span className="font-mono">{turn.model}</span>}
                <span>{formatSessionTime(turn.startedAt)}</span>
                <span className="font-mono">{formatDuration(turn.durationMs)}</span>
                {turn.usage && <span className="font-mono">{turn.usage.inputTokens.toLocaleString()} in · {turn.usage.outputTokens.toLocaleString()} out</span>}
            </div>
            <div className="space-y-2">
                {turn.input && (
                    <div className="rounded-md bg-secondary/60 px-3 py-2 text-xs whitespace-pre-wrap">
                        <p className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">User</p>
                        {turn.input}
                    </div>
                )}
                {turn.text && (
                    <div className="rounded-md border border-border/40 px-3 py-2 text-xs whitespace-pre-wrap">
                        <p className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Agent</p>
                        {turn.text}
                    </div>
                )}
                {turn.toolCalls.map((call) => <ToolCallCard key={call.id} call={call} />)}
                {turn.status === 'paused' && (
                    <div className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-2 text-xs',
                        turn.pauseReason === 'approval_required' ? 'bg-amber-500/[0.07] text-amber-700 dark:text-amber-300' : 'bg-muted/40 text-muted-foreground',
                    )}>
                        {turn.pauseReason === 'approval_required' ? <Hand className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                        <span>
                            {turn.pauseReason === 'approval_required'
                                ? waiting ? 'Waiting for a person to approve' : 'Paused for approval'
                                : waiting ? 'Waiting for the caller to run its tools' : 'Paused while the caller ran its tools'}
                            {turn.resolution === 'approved' && turn.pauseReason === 'approval_required' && ' · approved'}
                            {turn.resolution === 'rejected' && ' · rejected'}
                        </span>
                        {turn.resolution === 'rejected' && <X className="ml-auto h-3.5 w-3.5" />}
                    </div>
                )}
                {turn.status === 'failed' && (
                    <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-600 dark:text-red-400">{turn.error}</div>
                )}
            </div>
        </li>
    );
}

/** One session: who started it, and its turns, tool calls, approvals and handoffs in order. */
export default function SessionPage({ params }: PageProps) {
    const { orgSlug, projectSlug, sessionId } = use(params);
    const pathname = usePathname();
    const listHref = pathname.replace(/\/[^/]+\/?$/, '');
    const { data: projectId } = useProjectIdBySlug(orgSlug, projectSlug);

    const { data, isLoading, error } = useQuery<SessionDetail>({
        queryKey: ['session', projectId, sessionId],
        queryFn: async ({ signal }) => {
            const response = await fetch(`/api/projects/${projectId}/sessions/${encodeURIComponent(sessionId)}`, { signal });
            if (response.status === 404) throw new Error('This session does not exist in this project.');
            if (!response.ok) throw new Error('Could not load this session.');
            return response.json();
        },
        enabled: Boolean(projectId),
        // A live session keeps filling in.
        refetchInterval: (query) => (query.state.data?.session.status === 'active' || query.state.data?.session.status === 'paused' ? 5000 : false),
    });

    return (
        <div className="w-full max-w-[1000px] mx-auto px-0 sm:px-6 pt-0 pb-8 sm:pt-8">
            <Link href={listHref} className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" />
                Sessions
            </Link>

            {isLoading || !data ? (
                error ? (
                    <p className="rounded-md border border-border/40 bg-muted/30 px-5 py-12 text-center text-xs text-muted-foreground">{error instanceof Error ? error.message : 'Could not load this session.'}</p>
                ) : (
                    <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div>
                )
            ) : (
                <>
                    <header className="mb-6 rounded-md border border-border/40 bg-card p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <h1 className="text-base font-medium">{data.session.agent ?? 'Session'}</h1>
                            <SessionStatusBadge status={data.session.status} />
                            <span className="text-xs text-muted-foreground">{SESSION_SOURCE_LABELS[data.session.source]}</span>
                        </div>
                        <CopyId id={data.session.id} />
                        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
                            <Stat label="Started" value={formatSessionTime(data.session.created_at)} />
                            <Stat label="Turns" value={data.session.turns} />
                            <Stat label="Tokens" value={`${data.session.usage.inputTokens.toLocaleString()} / ${data.session.usage.outputTokens.toLocaleString()}`} />
                            <Stat label="Cost" value={formatSessionCost(data.session.cost_usd)} />
                            <Stat label="User" value={data.session.user ?? '—'} />
                        </div>
                        {data.session.parent_session_id && (
                            <p className="mt-3 text-xs text-muted-foreground">
                                Started as a tool by <Link className="font-mono underline underline-offset-2" href={`${listHref}/${data.session.parent_session_id}`}>{data.session.parent_session_id.slice(0, 8)}</Link>
                            </p>
                        )}
                    </header>

                    {data.turns.length === 0 ? (
                        <p className="py-12 text-center text-xs text-muted-foreground">No turns yet.</p>
                    ) : (
                        <ol className="relative space-y-6 before:absolute before:left-[4.5px] before:top-2 before:bottom-2 before:w-px before:bg-border/60">
                            {data.turns.map((turn, index) => (
                                <TurnBlock key={turn.turn} turn={turn} isLast={index === data.turns.length - 1} sessionStatus={data.session.status} />
                            ))}
                        </ol>
                    )}
                    {data.truncated && <p className="mt-4 text-xs text-muted-foreground">This session is long; only its first 5,000 events are shown.</p>}

                    {data.children.length > 0 && (
                        <section className="mt-8">
                            <h2 className="mb-2 text-xs font-medium">Agents it called</h2>
                            <div className="divide-y divide-border/40 rounded-md border border-border/40">
                                {data.children.map((child) => (
                                    <Link key={child.id} href={`${listHref}/${child.id}`} className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted/40">
                                        <SessionStatusBadge status={child.status} />
                                        <span>{child.agent ?? 'Agent'}</span>
                                        <span className="ml-auto font-mono text-muted-foreground">{child.turns} turns · {formatSessionCost(child.cost_usd)}</span>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
