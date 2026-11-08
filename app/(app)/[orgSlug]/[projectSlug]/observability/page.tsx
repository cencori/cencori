'use client';

import { use, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import Activity01Icon from '@hugeicons/core-free-icons/Activity01Icon';
import { useProjectIdBySlug } from '@/lib/hooks/useQueries';
import { TimeRangeSelector } from '@/components/audit/TimeRangeSelector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SESSION_SOURCE_LABELS, type SessionSource } from '@/lib/sessions/observability';
import { SessionStatusBadge, formatSessionCost, formatSessionTime } from '@/components/sessions/session-ui';
import type { SessionListItem } from '@/app/api/projects/[projectId]/sessions/route';

interface PageProps {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}

interface SessionsResponse {
    sessions: SessionListItem[];
    has_more: boolean;
    meta?: { applied_time_range: string; tier_max_time_range: string; time_range_clamped: boolean; requested_time_range: string };
}

const PAGE_SIZE = 25;
const DEFAULT_FILTERS = { status: 'all', source: 'all', time_range: '7d', search: '' };
const SOURCE_FILTERS: Array<[string, string]> = [
    ['sdk', SESSION_SOURCE_LABELS.sdk],
    ['arcie', SESSION_SOURCE_LABELS.arcie],
    ['widget', 'Widget & links'],
    ['whatsapp', SESSION_SOURCE_LABELS.whatsapp],
    ['embedded', SESSION_SOURCE_LABELS.embedded],
];

/** Every agent conversation in the project, from any source. */
export default function ObservabilityPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();
    const { data: projectId, isLoading: projectLoading } = useProjectIdBySlug(orgSlug, projectSlug);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [searchInput, setSearchInput] = useState('');
    const [offset, setOffset] = useState(0);

    useEffect(() => setOffset(0), [filters]);

    const { data, isLoading, error, isFetching } = useQuery<SessionsResponse>({
        queryKey: ['sessions', projectId, filters, offset],
        queryFn: async ({ signal }) => {
            const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), time_range: filters.time_range });
            if (filters.status !== 'all') query.set('status', filters.status);
            if (filters.source !== 'all') query.set('source', filters.source);
            if (filters.search) query.set('search', filters.search);
            const response = await fetch(`/api/projects/${projectId}/sessions?${query}`, { signal });
            if (!response.ok) throw new Error('Could not load sessions.');
            return response.json();
        },
        enabled: Boolean(projectId),
        staleTime: 15_000,
        refetchInterval: 30_000,
        placeholderData: (previous) => previous,
    });

    const sessions = data?.sessions ?? [];
    const filtered = filters.status !== 'all' || filters.source !== 'all' || filters.search !== '' || filters.time_range !== '7d';
    const open = (id: string) => router.push(`${pathname.replace(/\/$/, '')}/${id}`);

    if (!projectLoading && !projectId) {
        return (
            <div className="w-full max-w-[1360px] mx-auto px-0 sm:px-6 pt-0 pb-8 sm:pt-8 text-center py-16">
                <p className="text-sm font-medium">Project not found</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1360px] mx-auto px-0 sm:px-6 pt-0 pb-8 sm:pt-8">
            <header className="mb-5">
                <h1 className="text-base font-medium">Sessions</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    Every agent conversation in this project: Agents SDK, Arcie, widget, WhatsApp and API. Open one to see its turns, tool calls and approvals.
                </p>
            </header>

            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                <form
                    onSubmit={(event) => { event.preventDefault(); setFilters((f) => ({ ...f, search: searchInput.trim() })); }}
                    className="relative w-full lg:order-1 lg:w-auto"
                >
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                        placeholder="Session id..."
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        className="w-full lg:w-64 h-9 lg:h-7 pl-7 text-xs font-mono rounded border-border/50 bg-transparent placeholder:font-sans placeholder:text-muted-foreground/60 shadow-none dark:shadow-xs"
                    />
                </form>
                <div className="-mx-5 flex items-center gap-3 overflow-x-auto px-5 scrollbar-hide sm:mx-0 sm:px-0 [&>*]:shrink-0 [&_button]:h-9 lg:contents lg:[&_button]:h-7">
                    <Select value={filters.source} onValueChange={(value) => setFilters((f) => ({ ...f, source: value }))}>
                        <SelectTrigger className="w-[150px] h-7 text-xs shadow-none dark:shadow-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="text-xs">All sources</SelectItem>
                            {SOURCE_FILTERS.map(([value, label]) => <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={filters.status} onValueChange={(value) => setFilters((f) => ({ ...f, status: value }))}>
                        <SelectTrigger className="w-[130px] h-7 text-xs shadow-none dark:shadow-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                            <SelectItem value="active" className="text-xs">Active</SelectItem>
                            <SelectItem value="paused" className="text-xs">Waiting</SelectItem>
                            <SelectItem value="completed" className="text-xs">Ended</SelectItem>
                            <SelectItem value="failed" className="text-xs">Failed</SelectItem>
                        </SelectContent>
                    </Select>
                    <TimeRangeSelector value={filters.time_range} onChange={(value) => setFilters((f) => ({ ...f, time_range: value }))} />
                    {filtered && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2 lg:order-2" onClick={() => { setFilters(DEFAULT_FILTERS); setSearchInput(''); }}>
                            <X className="h-3 w-3 mr-1" />
                            Clear
                        </Button>
                    )}
                </div>
            </div>

            {data?.meta?.time_range_clamped && (
                <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
                    Showing {data.meta.applied_time_range}: your plan keeps {data.meta.tier_max_time_range} of history.
                </div>
            )}

            {isLoading || projectLoading ? (
                <Skeleton className="h-[320px] w-full rounded-md" />
            ) : error ? (
                <p className="rounded-md border border-border/40 bg-muted/30 px-5 py-12 text-center text-xs text-muted-foreground">
                    {error instanceof Error ? error.message : 'Could not load sessions.'}
                </p>
            ) : sessions.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                        <HugeiconsIcon icon={Activity01Icon} className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mb-1">No sessions</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                        {filtered ? 'Nothing matches these filters.' : 'Run an agent with cencori/agents, Arcie or an embedded agent and its sessions show up here.'}
                    </p>
                </div>
            ) : (
                <div className="bg-card border border-border/40 rounded-md overflow-hidden">
                    <div className="hidden md:block overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-b border-border/40">
                                    {['Last activity', 'Status', 'Source', 'Agent', 'First message'].map((h) => (
                                        <TableHead key={h} className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 px-3">{h}</TableHead>
                                    ))}
                                    <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right w-[70px]">Turns</TableHead>
                                    <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right pr-3 w-[90px]">Cost</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessions.map((s) => (
                                    <TableRow key={s.id} onClick={() => open(s.id)} className="cursor-pointer hover:bg-muted/50 border-b border-border/40 last:border-b-0">
                                        <TableCell className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{formatSessionTime(s.updated_at)}</TableCell>
                                        <TableCell className="py-2 px-3"><SessionStatusBadge status={s.status} /></TableCell>
                                        <TableCell className="py-2 px-3 text-xs whitespace-nowrap">{SESSION_SOURCE_LABELS[s.source as SessionSource]}</TableCell>
                                        <TableCell className="py-2 px-3 text-xs whitespace-nowrap">
                                            {s.agent ?? <span className="text-muted-foreground">—</span>}
                                            {s.parent_session_id && <span className="ml-1.5 text-[10px] text-muted-foreground">sub-run</span>}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 text-xs text-muted-foreground max-w-[380px] truncate">{s.preview ?? '—'}</TableCell>
                                        <TableCell className="py-2 text-right text-xs font-mono text-muted-foreground">{s.turns}</TableCell>
                                        <TableCell className="py-2 pr-3 text-right text-xs font-mono text-muted-foreground">{formatSessionCost(s.cost_usd)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="md:hidden divide-y divide-border/40">
                        {sessions.map((s) => (
                            <button key={s.id} type="button" onClick={() => open(s.id)} className="block w-full p-3 text-left hover:bg-secondary/30 active:bg-secondary/50">
                                <div className="mb-1.5 flex items-center justify-between">
                                    <SessionStatusBadge status={s.status} />
                                    <span className="text-[10px] text-muted-foreground">{formatSessionTime(s.updated_at)}</span>
                                </div>
                                <p className="mb-1.5 truncate text-xs">{s.preview ?? 'No message'}</p>
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>{SESSION_SOURCE_LABELS[s.source as SessionSource]}{s.agent ? ` · ${s.agent}` : ''}</span>
                                    <span className="font-mono">{s.turns} turns · {formatSessionCost(s.cost_usd)}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {(offset > 0 || data?.has_more) && (
                <div className="flex items-center justify-between py-3">
                    <p className="text-xs text-muted-foreground tabular-nums">{offset + 1}–{offset + sessions.length}</p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={offset === 0 || isFetching} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!data?.has_more || isFetching} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
