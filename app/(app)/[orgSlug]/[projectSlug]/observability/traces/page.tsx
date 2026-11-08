'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Download, Play, RefreshCw, Search } from 'lucide-react';
import BinocularsIcon from '@hugeicons/core-free-icons/BinocularsIcon';
import LeftToRightListDashIcon from '@hugeicons/core-free-icons/LeftToRightListDashIcon';
import { ObservabilityEmptyState } from '@/components/observability/EmptyState';
import { useProjectIdBySlug } from '@/lib/hooks/useQueries';
import { Skeleton } from '@/components/ui/skeleton';
import { SESSION_SOURCE_LABELS, type SessionSource } from '@/lib/sessions/observability';
import { hasActiveFilters, readSessionFilters, writeSessionFilters } from '@/lib/sessions/filters';
import { SessionStatusBadge, formatSessionCost, formatSessionTime } from '@/components/sessions/session-ui';
import type { SessionListItem } from '@/app/api/projects/[projectId]/sessions/route';
import { cn } from '@/lib/utils';

// Every agent session in the project, full screen: a search bar, the
// activity over the selected time range, and the traces as log lines.
// Filters live in the sidebar (components/sessions/SessionFilters.tsx) and
// in the URL, so this page reads them from there.

interface PageProps {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}

interface SessionsPage {
    sessions: SessionListItem[];
    has_more: boolean;
    histogram: { start: string; end: string; buckets: number[] } | null;
    meta?: { applied_time_range: string; tier_max_time_range: string; time_range_clamped: boolean };
}

const PAGE_SIZE = 50;
const COLUMNS = 'grid-cols-[170px_80px_120px_minmax(120px,180px)_minmax(0,1fr)_60px_90px]';

function axisLabel(ms: number, spanMs: number): string {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    if (spanMs <= 36 * 3600_000) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${d.toLocaleString('en', { month: 'short' }).toUpperCase()} ${pad(d.getDate())}`;
}

function Histogram({ data }: { data: NonNullable<SessionsPage['histogram']> }) {
    const max = Math.max(1, ...data.buckets);
    const start = Date.parse(data.start);
    const end = Date.parse(data.end);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => start + (end - start) * f);
    return (
        <div className="border-b border-border/50 px-3 pb-1.5 pt-3">
            <div className="flex h-10 items-end gap-px">
                {data.buckets.map((count, i) => (
                    <div
                        key={i}
                        title={`${count} session${count === 1 ? '' : 's'}`}
                        className={cn('flex-1 rounded-[1px]', count ? 'bg-foreground/40' : 'bg-border/40')}
                        style={{ height: count ? `${Math.max(10, (count / max) * 100)}%` : '2px' }}
                    />
                ))}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                {ticks.map((t) => <span key={t}>{axisLabel(t, end - start)}</span>)}
            </div>
        </div>
    );
}

export default function TracesPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const filters = readSessionFilters(searchParams);
    const { data: projectId, isLoading: projectLoading } = useProjectIdBySlug(orgSlug, projectSlug);
    const [searchInput, setSearchInput] = useState(filters.q);
    const [live, setLive] = useState(false);

    useEffect(() => setSearchInput(filters.q), [filters.q]);

    const apiQuery = useMemo(() => {
        const q = new URLSearchParams({ limit: String(PAGE_SIZE), time_range: filters.range });
        if (filters.status.length) q.set('status', filters.status.join(','));
        if (filters.source.length) q.set('source', filters.source.join(','));
        if (filters.q) q.set('search', filters.q);
        return q.toString();
    }, [filters.range, filters.status, filters.source, filters.q]);

    const { data, isLoading, error, isFetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<SessionsPage>({
        queryKey: ['sessions', projectId, apiQuery],
        queryFn: async ({ pageParam, signal }) => {
            const response = await fetch(`/api/projects/${projectId}/sessions?${apiQuery}&offset=${pageParam}`, { signal });
            if (!response.ok) throw new Error('Could not load traces.');
            return response.json();
        },
        initialPageParam: 0,
        getNextPageParam: (last, pages) => (last.has_more ? pages.length * PAGE_SIZE : undefined),
        enabled: Boolean(projectId),
        staleTime: 15_000,
        refetchInterval: live ? 5000 : false,
    });

    const sessions = data?.pages.flatMap((p) => p.sessions) ?? [];
    const histogram = data?.pages[0]?.histogram ?? null;
    const meta = data?.pages[0]?.meta;
    const filtered = hasActiveFilters(filters);
    const open = (id: string) => router.push(`${pathname.replace(/\/$/, '')}/${id}`);
    const submitSearch = () => {
        const qs = writeSessionFilters({ ...filters, q: searchInput.trim() });
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };
    const exportJson = () => {
        const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `traces-${new Date().toISOString().slice(0, 19)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!projectLoading && !projectId) {
        return <p className="py-16 text-center text-sm text-muted-foreground">Project not found</p>;
    }

    return (
        <div className="flex min-h-0 w-full flex-1 flex-col">
            {/* Toolbar */}
            <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2">
                <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onBlur={() => { if (searchInput.trim() !== filters.q) submitSearch(); }}
                        placeholder="Search traces by session id or agent..."
                        className="h-9 w-full rounded-md border border-border/60 bg-transparent pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-border"
                    />
                </form>
                <button
                    type="button"
                    onClick={() => setLive((l) => !l)}
                    className={cn('flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm', live ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : 'border-border/60 text-foreground hover:bg-muted/50')}
                    aria-pressed={live}
                >
                    {live ? <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> : <Play className="h-3.5 w-3.5" />}
                    Live
                </button>
                <button type="button" onClick={() => void refetch()} aria-label="Refresh" className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 hover:bg-muted/50">
                    <RefreshCw className={cn('h-3.5 w-3.5', isFetching && !isFetchingNextPage && 'animate-spin')} />
                </button>
                <button type="button" onClick={exportJson} disabled={!sessions.length} aria-label="Export as JSON" className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 hover:bg-muted/50 disabled:opacity-40">
                    <Download className="h-3.5 w-3.5" />
                </button>
            </div>

            {histogram && <Histogram data={histogram} />}
            {meta?.time_range_clamped && (
                <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-200">
                    Showing {meta.applied_time_range}: your plan keeps {meta.tier_max_time_range} of history.
                </div>
            )}

            {/* Sessions as log lines */}
            <div className="min-h-0 flex-1 overflow-auto">
                <div className={cn('sticky top-0 z-10 hidden min-w-[900px] gap-3 border-b border-border/50 bg-background px-3 py-2 text-xs text-muted-foreground md:grid', COLUMNS)}>
                    <span>Time</span><span>Status</span><span>Source</span><span>Agent</span><span>First message</span>
                    <span className="text-right">Turns</span><span className="text-right">Cost</span>
                </div>

                {isLoading || projectLoading ? (
                    <div className="space-y-2 p-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
                ) : error ? (
                    <p className="py-16 text-center text-xs text-muted-foreground">{error instanceof Error ? error.message : 'Could not load traces.'}</p>
                ) : sessions.length === 0 ? (
                    <ObservabilityEmptyState
                        icon={BinocularsIcon}
                        title={`No traces${filtered ? ' match these filters' : ' yet'}`}
                        description={filtered ? 'Change the filters in the sidebar.' : 'Run an agent with cencori/agents, Arcie or an embedded agent and its traces show up here.'}
                        otherSources={[{ href: pathname.replace(/\/traces\/?$/, '/request-logs'), icon: LeftToRightListDashIcon, label: 'Request logs', description: 'Every model call through Cencori' }]}
                    />
                ) : (
                    <>
                        {sessions.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => open(s.id)}
                                className={cn('block w-full border-b border-border/30 px-3 py-2 text-left hover:bg-muted/40 md:grid md:min-w-[900px] md:items-center md:gap-3', COLUMNS)}
                            >
                                <span className="font-mono text-xs text-muted-foreground">{formatSessionTime(s.updated_at)}</span>
                                <span className="hidden md:block"><SessionStatusBadge status={s.status} /></span>
                                <span className="hidden truncate font-mono text-xs md:block">{SESSION_SOURCE_LABELS[s.source as SessionSource]}</span>
                                <span className="hidden truncate font-mono text-xs md:block">
                                    {s.agent ?? '—'}{s.parent_session_id && <span className="ml-1.5 text-[10px] text-muted-foreground">sub-run</span>}
                                </span>
                                <span className="block truncate font-mono text-xs md:inline">{s.preview ?? <span className="text-muted-foreground">—</span>}</span>
                                <span className="hidden text-right font-mono text-xs text-muted-foreground md:block">{s.turns}</span>
                                <span className="hidden text-right font-mono text-xs text-muted-foreground md:block">{formatSessionCost(s.cost_usd)}</span>
                                <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground md:hidden">
                                    {SESSION_SOURCE_LABELS[s.source as SessionSource]}{s.agent ? ` · ${s.agent}` : ''} · {s.turns} turns · {formatSessionCost(s.cost_usd)}
                                </span>
                            </button>
                        ))}
                        <div className="py-4 text-center">
                            {hasNextPage ? (
                                <button type="button" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage} className="rounded-md border border-border/60 px-3 py-1.5 text-xs hover:bg-muted/50 disabled:opacity-50">
                                    {isFetchingNextPage ? 'Loading…' : 'Load more'}
                                </button>
                            ) : (
                                <p className="text-xs text-muted-foreground">No more traces in this time range.</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
