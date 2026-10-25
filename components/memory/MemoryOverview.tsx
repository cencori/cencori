'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import { Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    MetricCard,
    MetricCardFrame,
    type MetricCardConfig,
} from '@/components/dashboard/project-overview/ProjectOverviewDashboard';
import { BarBreakdownChart } from '@/components/dashboard/project-overview/ModelBreakdown';
import { MemoryGetStarted } from '@/components/memory/MemoryGetStarted';
import { MemoryPageSkeleton } from '@/components/memory/MemoryRoute';
import { cn } from '@/lib/utils';

interface MemoryOverviewProps {
    projectId: string;
    /** Opens the Memories tab, filtered to one end-user when given. */
    onViewMemories: (userId?: string) => void;
}

interface OverviewResponse {
    quota: { used: number; limit: number | null; percent: number; tier: string };
    memories: {
        active: number;
        superseded: number;
        users: number;
        namespaces: number;
        avgImportance: number;
        recalls: number;
        neverRecalled: number;
    };
    graph: { entities: number; edges: number; mentions: number };
    daily: { date: string; count: number }[];
    topUsers: { scopeKey: string; count: number }[];
    searches?: {
        total: number;
        daily: { date: string; count: number }[];
        recent: {
            id: string;
            createdAt: string;
            status: string;
            query: string;
            scopeKey: string | null;
            results: number | null;
            latencyMs: number | null;
        }[];
    };
    settings: { enabled: boolean; graphEnabled: boolean };
}

interface RecentMemory {
    id: string;
    content: string;
    scopeKey: string;
    accessCount: number;
    createdAt: string | null;
}

const RECENT_LIMIT = 5;
const WRITES_COLOR = '#8b5cf6';
const SEARCHES_COLOR = '#3b82f6';
const USERS_COLOR = '#14b8a6';
const HEAD_CLASS = 'h-8 text-[10px] font-medium uppercase tracking-wider text-muted-foreground';
const numberFormat = new Intl.NumberFormat('en-US');
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export function useMemoryOverview(projectId: string) {
    return useQuery({
        queryKey: ['memoryOverview', projectId],
        queryFn: async (): Promise<OverviewResponse> => {
            const response = await fetch(`/api/projects/${projectId}/memory/overview`);
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error || 'We could not load memory statistics.');
            }
            return response.json();
        },
        staleTime: 30_000,
    });
}

// Same "02 Jan 26 17:41:47" timestamp as the Logs table.
function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${day} ${month} ${year} ${time}`;
}

/** "2026-10-23" → "Oct 23" (the API buckets by UTC day). */
function formatDay(day: string): string {
    return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function useRecentMemories(projectId: string) {
    return useQuery({
        queryKey: ['memoryEntries', projectId, 'overview-recent'],
        queryFn: async (): Promise<{ memories: RecentMemory[] }> => {
            const params = new URLSearchParams({ status: 'active', sort: 'recent', limit: String(RECENT_LIMIT), offset: '0' });
            const response = await fetch(`/api/projects/${projectId}/memory/entries?${params}`);
            if (!response.ok) throw new Error('We could not load memories.');
            return response.json();
        },
        staleTime: 15_000,
    });
}

function RecentMemories({
    query,
    onViewMemories,
}: {
    query: ReturnType<typeof useRecentMemories>;
    onViewMemories: MemoryOverviewProps['onViewMemories'];
}) {
    const { data, isLoading, isError } = query;
    const memories = data?.memories ?? [];

    return (
        <section className="mt-8" aria-labelledby="recent-memories-heading">
            <div className="mb-4 flex items-center justify-between gap-4">
                <h2 id="recent-memories-heading" className="text-sm font-medium tracking-[-0.02em]">Recent memories</h2>
                <Button size="sm" className="h-7 text-xs" onClick={() => onViewMemories()}>View all</Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                {isLoading ? (
                    <div className="divide-y divide-border/40">
                        {Array.from({ length: RECENT_LIMIT }).map((_, index) => (
                            <div key={index} className="grid grid-cols-4 items-center gap-4 px-4 py-3">
                                <Skeleton className="h-3 w-28" />
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="col-span-2 h-3 w-full" />
                            </div>
                        ))}
                    </div>
                ) : isError ? (
                    <p className="px-5 py-8 text-center text-xs text-muted-foreground">Recent memories couldn&apos;t be loaded.</p>
                ) : memories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                            <Brain className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="mb-1 text-sm font-medium">No memories yet</p>
                        <p className="text-xs text-muted-foreground">Memories appear once a request carries a memory field.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-border/40 hover:bg-transparent">
                                    <TableHead className="h-8 w-[180px] px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Written</TableHead>
                                    <TableHead className="h-8 w-[200px] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">End user</TableHead>
                                    <TableHead className="h-8 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Memory</TableHead>
                                    <TableHead className="h-8 w-[90px] pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Recalled</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {memories.map((memory) => (
                                    <TableRow
                                        key={memory.id}
                                        className="cursor-pointer border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/50"
                                        onClick={() => onViewMemories(memory.scopeKey)}
                                    >
                                        <TableCell className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{formatDate(memory.createdAt)}</TableCell>
                                        <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                                            <p className="max-w-[190px] truncate">{memory.scopeKey}</p>
                                        </TableCell>
                                        <TableCell className="w-full max-w-0 py-2 text-xs">
                                            <p className="truncate">{memory.content}</p>
                                        </TableCell>
                                        <TableCell className="py-2 pr-3 text-right font-mono text-xs text-muted-foreground">
                                            {memory.accessCount === 0 ? '—' : `${memory.accessCount}×`}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </section>
    );
}

function LatestSearches({ searches }: { searches: NonNullable<OverviewResponse['searches']>['recent'] }) {
    return (
        <section className="mt-8" aria-labelledby="latest-searches-heading">
            <h2 id="latest-searches-heading" className="mb-4 text-sm font-medium tracking-[-0.02em]">Latest searches</h2>
            <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                {searches.length === 0 ? (
                    <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                        No searches yet. Calls to <span className="font-mono">/v1/memory/search</span> show up here.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-border/40 hover:bg-transparent">
                                    <TableHead className={cn(HEAD_CLASS, 'w-[180px] px-3')}>Searched</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, 'w-[200px]')}>End user</TableHead>
                                    <TableHead className={HEAD_CLASS}>Query</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, 'w-[80px] text-right')}>Results</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, 'w-[90px] pr-3 text-right')}>Latency</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {searches.map((search) => (
                                    <TableRow key={search.id} className="border-b border-border/40 last:border-b-0 hover:bg-muted/50">
                                        <TableCell className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{formatDate(search.createdAt)}</TableCell>
                                        <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                                            <p className="max-w-[190px] truncate">{search.scopeKey ?? '—'}</p>
                                        </TableCell>
                                        <TableCell className="w-full max-w-0 py-2 text-xs">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <p className="truncate">{search.query || '—'}</p>
                                                {search.status !== 'success' && (
                                                    <span className="shrink-0 rounded-[4px] bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                                                        {search.status}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">{search.results ?? '—'}</TableCell>
                                        <TableCell className="py-2 pr-3 text-right font-mono text-xs text-muted-foreground">
                                            {search.latencyMs == null ? '—' : `${search.latencyMs}ms`}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </section>
    );
}

export function MemoryOverview({ projectId, onViewMemories }: MemoryOverviewProps) {
    const reduceMotion = useReducedMotion();
    const { data, isLoading, error } = useMemoryOverview(projectId);
    // Fetched alongside the stats, so the page appears in one go instead of
    // the table loading after everything else.
    const recent = useRecentMemories(projectId);

    // Writes and searches on one day spine: the searches series always carries
    // every day of the window, the stats series may skip empty days.
    const activityData = useMemo(() => {
        const written = new Map((data?.daily ?? []).map((point) => [point.date, point.count]));
        const spine = data?.searches?.daily.length ? data.searches.daily : (data?.daily ?? []).map((point) => ({ date: point.date, count: 0 }));
        return spine.map((point) => ({
            date: formatDay(point.date),
            written: written.get(point.date) ?? 0,
            searches: data?.searches ? point.count : 0,
        }));
    }, [data?.daily, data?.searches]);
    const userRows = useMemo(
        () => (data?.topUsers ?? []).slice(0, 6).map((user) => ({ name: user.scopeKey, value: user.count })),
        [data?.topUsers],
    );

    if (error) {
        return (
            <div className="flex flex-col items-center py-16 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                    <Brain className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Could not load memory stats</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    {error instanceof Error ? error.message : 'Try again in a moment.'}
                </p>
            </div>
        );
    }

    const loading = isLoading || !data || recent.isLoading;
    const quota = data?.quota;
    const memories = data?.memories;
    const graph = data?.graph;
    const unlimited = quota?.limit == null;
    const totalWrites = (data?.daily ?? []).reduce((sum, point) => sum + point.count, 0);
    const totalSearches = data?.searches?.total ?? 0;
    const isEmpty = !loading && (memories?.active ?? 0) === 0 && (memories?.superseded ?? 0) === 0 && totalSearches === 0;
    const recallRate = memories && memories.active > 0
        ? Math.round(((memories.active - memories.neverRecalled) / memories.active) * 100)
        : 0;
    // 80% nudges, 100% hard-blocks writes (reads keep working).
    const quotaTone = (quota?.percent ?? 0) >= 100 ? 'bg-red-500' : (quota?.percent ?? 0) >= 80 ? 'bg-amber-500' : 'bg-foreground';

    const storedConfig: MetricCardConfig = {
        title: 'Memories stored',
        detail: unlimited
            ? 'No cap on Enterprise'
            : `of ${numberFormat.format(quota?.limit ?? 0)} · ${quota?.percent ?? 0}% of the ${quota?.tier ?? ''} quota`,
        series: [{ key: 'stored', label: 'Stored', color: WRITES_COLOR, value: numberFormat.format(quota?.used ?? 0) }],
        formatValue: (value) => numberFormat.format(value),
        formatAxis: (value) => compactNumber.format(value),
    };
    const activityConfig: MetricCardConfig = {
        title: 'Activity',
        detail: 'last 14 days',
        series: [
            { key: 'written', label: 'Written', color: WRITES_COLOR, value: numberFormat.format(totalWrites) },
            { key: 'searches', label: 'Searches', color: SEARCHES_COLOR, value: numberFormat.format(totalSearches) },
        ],
        formatValue: (value) => numberFormat.format(value),
        formatAxis: (value) => compactNumber.format(value),
    };
    const usersConfig: MetricCardConfig = {
        title: 'Heaviest end-users',
        detail: `${numberFormat.format(memories?.users ?? 0)} end-users`,
        series: [{ key: 'value', label: 'Memories', color: USERS_COLOR, value: numberFormat.format(userRows.reduce((sum, row) => sum + row.value, 0)) }],
        formatValue: (value) => numberFormat.format(value),
        formatAxis: (value) => compactNumber.format(value),
    };

    const stats = [
        {
            label: 'End-users',
            value: numberFormat.format(memories?.users ?? 0),
            detail: (memories?.namespaces ?? 0) > 0 ? `${memories?.namespaces} namespaces` : 'No namespaces in use',
        },
        {
            label: 'Recalled at least once',
            value: `${recallRate}%`,
            detail: `${numberFormat.format(memories?.neverRecalled ?? 0)} never recalled`,
        },
        {
            label: 'Superseded',
            value: numberFormat.format(memories?.superseded ?? 0),
            detail: 'Replaced facts, still queryable as-of',
        },
        {
            label: 'Entity graph',
            value: `${numberFormat.format(graph?.entities ?? 0)} / ${numberFormat.format(graph?.edges ?? 0)}`,
            detail: data?.settings.graphEnabled ? 'entities / relations' : 'Graph layer is off',
        },
    ];

    // Same single block as the page frame's loader: one continuous load, then
    // either the overview or Get started, with nothing flashing in between.
    if (loading) return <MemoryPageSkeleton />;

    // A project that has never stored or searched a memory gets setup, not a wall of zeros.
    if (isEmpty) return <MemoryGetStarted projectId={projectId} />;

    return (
        <div>
            <MetricCardFrame config={storedConfig} loading={loading}>
                <div>
                    {!unlimited && (
                        <div className="px-5 pt-4">
                            <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <span
                                    className={cn('block h-full rounded-full transition-[width]', quotaTone)}
                                    style={{ width: `${Math.max(Math.min(quota?.percent ?? 0, 100), (quota?.used ?? 0) > 0 ? 1 : 0)}%` }}
                                />
                            </span>
                        </div>
                    )}
                    <dl className="mt-4 grid grid-cols-2 border-t border-border/40 md:grid-cols-4">
                        {stats.map((stat, index) => (
                            <div
                                key={stat.label}
                                className={cn(
                                    'min-w-0 px-5 py-4',
                                    index % 2 === 0 && 'border-r border-border/40',
                                    index < 2 && 'border-b border-border/40 md:border-b-0',
                                    index === 1 && 'md:border-r',
                                    index === 2 && 'md:border-r',
                                )}
                            >
                                <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                                <dd className="mt-1.5 truncate font-mono text-sm font-medium tabular-nums text-foreground">{stat.value}</dd>
                                <dd className="mt-1 truncate text-xs text-muted-foreground">{stat.detail}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </MetricCardFrame>

            <>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <MetricCard
                            config={activityConfig}
                            data={activityData}
                            loading={loading}
                            hasData={totalWrites + totalSearches > 0}
                            reduceMotion={reduceMotion}
                        />
                        <MetricCardFrame config={usersConfig} loading={loading}>
                            <BarBreakdownChart
                                rows={userRows}
                                color={USERS_COLOR}
                                label="Memories"
                                formatValue={(value) => compactNumber.format(value)}
                                reduceMotion={reduceMotion}
                                labelKind="plain"
                                onSelect={(name) => onViewMemories(name)}
                            />
                        </MetricCardFrame>
                    </div>

                    {/* Not while the stats load: an empty project resolves to Get started, and the
                        table would flash "No memories yet" before that swap. */}
                    {!loading && <RecentMemories query={recent} onViewMemories={onViewMemories} />}
                    {data?.searches && <LatestSearches searches={data.searches.recent} />}
            </>
        </div>
    );
}
