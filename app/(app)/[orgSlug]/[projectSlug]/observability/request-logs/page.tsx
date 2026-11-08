'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ExternalLink, Play, RefreshCw, Search, X } from 'lucide-react';
import LeftToRightListDashIcon from '@hugeicons/core-free-icons/LeftToRightListDashIcon';
import BinocularsIcon from '@hugeicons/core-free-icons/BinocularsIcon';
import { ObservabilityEmptyState } from '@/components/observability/EmptyState';
import { useProjectIdBySlug } from '@/lib/hooks/useQueries';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/audit/StatusBadge';
import { ExportButton } from '@/components/audit/ExportButton';
import { extractRequestPrompt } from '@/components/audit/RequestDetailModal';
import { Card, KV, Pre } from '@/components/observability/panel-ui';
import { formatDuration, formatSessionCost, formatSessionTime } from '@/components/sessions/session-ui';
import { hasActiveRequestLogFilters, readRequestLogFilters, writeRequestLogFilters } from '@/lib/observability/request-log-filters';
import { cn } from '@/lib/utils';

// Request logs: every model call through the gateway, full screen. Filters
// live in the Observability sidebar and the URL; the open request is
// ?request=<log id> and shows in a panel on the right.

interface PageProps {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}

type LogStatus = 'success' | 'success_fallback' | 'filtered' | 'blocked_output' | 'error' | 'rate_limited';

interface RequestLog {
    id: string;
    created_at: string;
    status: LogStatus;
    model: string;
    total_tokens: number;
    cost_usd: number;
    latency_ms: number;
    request_preview: string;
}

interface LogsPage {
    requests: RequestLog[];
    pagination: { total_pages: number };
    meta?: { applied_time_range: string; tier_max_time_range: string; time_range_clamped: boolean };
}

interface RequestDetail {
    id: string;
    request_id?: string | null;
    created_at: string;
    status: LogStatus;
    model: string;
    provider?: string | null;
    endpoint?: string | null;
    fallback_provider?: string | null;
    fallback_model?: string | null;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd: number;
    latency_ms: number;
    session_id?: string | null;
    end_user_id?: string | null;
    error_message?: string | null;
    filtered_reasons?: string[] | null;
    safety_score?: number | null;
    request_payload: Record<string, unknown> | null;
    response_payload: string | Record<string, unknown> | null;
    api_key?: { name: string; environment: string } | null;
    security_incidents?: Array<{ id: string; incident_type: string; severity: string; risk_score: number }>;
}

const PER_PAGE = 50;
const COLUMNS = 'grid-cols-[170px_100px_minmax(120px,200px)_minmax(0,1fr)_80px_90px_80px]';

function responseText(payload: RequestDetail['response_payload']): string {
    if (!payload) return '';
    if (typeof payload === 'string') return payload;
    const p = payload as { choices?: Array<{ message?: { content?: unknown } }>; output_text?: unknown; content?: unknown; text?: unknown };
    const content = p.choices?.[0]?.message?.content ?? p.output_text ?? p.content ?? p.text;
    return typeof content === 'string' ? content : '';
}

function RequestPanel({ projectId, logId, tracesHref, onClose }: { projectId: string; logId: string; tracesHref: string; onClose: () => void }) {
    const { data: r, isLoading, error } = useQuery<RequestDetail>({
        queryKey: ['request-log', projectId, logId],
        queryFn: async ({ signal }) => {
            const res = await fetch(`/api/projects/${projectId}/logs/${logId}`, { signal });
            if (!res.ok) throw new Error('Could not load this request.');
            return res.json();
        },
        staleTime: 60_000,
    });

    if (isLoading) return <div className="space-y-3"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-64 w-full" /></div>;
    if (error || !r) return <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : 'Could not load this request.'}</p>;

    const prompt = extractRequestPrompt(r.request_payload);
    const reply = responseText(r.response_payload);
    const incidents = r.security_incidents ?? [];

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">Request</span>
                <span className="min-w-0 truncate font-mono text-xs">{r.model}</span>
                <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-medium"><StatusBadge status={r.status} variant="code" /></span>
                <span className="font-mono text-[11px] text-muted-foreground">{formatSessionTime(r.created_at)}</span>
            </div>
            <KV rows={[
                r.request_id ? ['Request ID', r.request_id, r.request_id] : null,
                ['Log ID', r.id, r.id],
                ['Model', r.model],
                r.provider ? ['Provider', r.provider] : null,
                (r.fallback_provider || r.fallback_model) ? ['Fallback', r.fallback_model ?? r.fallback_provider] : null,
                r.endpoint ? ['Endpoint', r.endpoint] : null,
                ['Latency', formatDuration(r.latency_ms)],
                ['Tokens', `${r.prompt_tokens.toLocaleString()} → ${r.completion_tokens.toLocaleString()}`],
                ['Cost', formatSessionCost(Number(r.cost_usd ?? 0))],
                r.api_key ? ['API key', r.api_key.name] : null,
                r.end_user_id ? ['End user', r.end_user_id, r.end_user_id] : null,
                r.error_message ? ['Error', r.error_message] : null,
            ]} />
            {r.session_id && (
                <Link href={`${tracesHref}/${r.session_id}`} className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-xs hover:bg-muted/40">
                    <span>Part of a trace</span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">{r.session_id.slice(0, 8)}… <ExternalLink className="h-3 w-3" /></span>
                </Link>
            )}
            <Card title="Prompt" summary={prompt.text ? `${prompt.text.length} chars` : 'none'} defaultOpen>
                <Pre value={prompt.text} empty="No prompt was logged for this request." />
            </Card>
            <Card title="Response" summary={reply ? `${reply.length} chars` : undefined} defaultOpen>
                <Pre value={reply || r.response_payload} empty="No response was logged." />
            </Card>
            {(incidents.length > 0 || (r.filtered_reasons?.length ?? 0) > 0 || r.safety_score !== null && r.safety_score !== undefined) && (
                <Card title="Security" summary={incidents.length ? `${incidents.length} incidents` : r.filtered_reasons?.length ? 'filtered' : 'passed'} defaultOpen={incidents.length > 0}>
                    <Pre value={{ safety_score: r.safety_score ?? null, filtered_reasons: r.filtered_reasons ?? [], incidents }} />
                </Card>
            )}
            {prompt.raw && <Card title="Raw request"><Pre value={prompt.raw} /></Card>}
            {r.response_payload && typeof r.response_payload !== 'string' && <Card title="Raw response"><Pre value={r.response_payload} /></Card>}
        </div>
    );
}

export default function RequestLogsPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const filters = readRequestLogFilters(searchParams);
    const selected = searchParams.get('request');
    const { data: projectId, isLoading: projectLoading } = useProjectIdBySlug(orgSlug, projectSlug);
    const [searchInput, setSearchInput] = useState(filters.q);
    const [live, setLive] = useState(false);
    const tracesHref = pathname.replace(/\/request-logs\/?$/, '/traces');

    useEffect(() => setSearchInput(filters.q), [filters.q]);

    const apiQuery = useMemo(() => {
        const q = new URLSearchParams({ per_page: String(PER_PAGE), time_range: filters.range });
        if (filters.status) q.set('status', filters.status);
        if (filters.model) q.set('model', filters.model);
        if (filters.key) q.set('api_key_id', filters.key);
        if (filters.q) q.set('search', filters.q);
        return q.toString();
    }, [filters.range, filters.status, filters.model, filters.key, filters.q]);

    const { data, isLoading, error, isFetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<LogsPage>({
        queryKey: ['request-logs', projectId, apiQuery],
        queryFn: async ({ pageParam, signal }) => {
            const res = await fetch(`/api/projects/${projectId}/logs?${apiQuery}&page=${pageParam}`, { signal });
            if (!res.ok) throw new Error('Could not load request logs.');
            return res.json();
        },
        initialPageParam: 1,
        getNextPageParam: (last, pages) => (pages.length < (last.pagination?.total_pages ?? 1) ? pages.length + 1 : undefined),
        enabled: Boolean(projectId),
        staleTime: 15_000,
        refetchInterval: live ? 5000 : false,
    });

    const requests = data?.pages.flatMap((p) => p.requests) ?? [];
    const meta = data?.pages[0]?.meta;
    const filtered = hasActiveRequestLogFilters(filters);
    const go = (request: string | null, q = filters.q) => {
        const qs = writeRequestLogFilters({ ...filters, q }, request);
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    if (!projectLoading && !projectId) return <p className="py-16 text-center text-sm text-muted-foreground">Project not found</p>;

    return (
        <div className={cn('grid min-h-0 w-full flex-1', selected && 'lg:grid-cols-[minmax(0,1fr)_420px]')}>
            <section className="flex min-h-0 min-w-0 flex-col">
                <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2">
                    <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); go(selected, searchInput.trim()); }}>
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onBlur={() => { if (searchInput.trim() !== filters.q) go(selected, searchInput.trim()); }}
                            placeholder="Search request logs..."
                            className="h-9 w-full rounded-md border border-border/60 bg-transparent pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-border"
                        />
                    </form>
                    <button
                        type="button" onClick={() => setLive((l) => !l)} aria-pressed={live}
                        className={cn('flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm', live ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : 'border-border/60 hover:bg-muted/50')}
                    >
                        {live ? <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> : <Play className="h-3.5 w-3.5" />}
                        Live
                    </button>
                    <button type="button" onClick={() => void refetch()} aria-label="Refresh" className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 hover:bg-muted/50">
                        <RefreshCw className={cn('h-3.5 w-3.5', isFetching && !isFetchingNextPage && 'animate-spin')} />
                    </button>
                    {projectId && (
                        <ExportButton
                            projectId={projectId}
                            filters={{ status: filters.status ?? 'all', model: filters.model ?? 'all', time_range: filters.range, search: filters.q }}
                            environment="production"
                        />
                    )}
                </div>
                {meta?.time_range_clamped && (
                    <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-200">
                        Showing {meta.applied_time_range}: your plan keeps {meta.tier_max_time_range} of history.
                    </div>
                )}

                <div className="min-h-0 flex-1 overflow-auto">
                    <div className={cn('sticky top-0 z-10 hidden min-w-[860px] gap-3 border-b border-border/50 bg-background px-3 py-2 text-xs text-muted-foreground md:grid', COLUMNS)}>
                        <span>Time</span><span>Status</span><span>Model</span><span>Request</span>
                        <span className="text-right">Tokens</span><span className="text-right">Cost</span><span className="text-right">Latency</span>
                    </div>
                    {isLoading || projectLoading ? (
                        <div className="space-y-2 p-3">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
                    ) : error ? (
                        <p className="py-16 text-center text-xs text-muted-foreground">{error instanceof Error ? error.message : 'Could not load request logs.'}</p>
                    ) : requests.length === 0 ? (
                        <ObservabilityEmptyState
                            icon={LeftToRightListDashIcon}
                            title={`No requests${filtered ? ' match these filters' : ' in this time range'}`}
                            description={filtered ? 'Change the filters in the sidebar.' : 'Make a model call through Cencori and it shows up here.'}
                            otherSources={[{ href: tracesHref, icon: BinocularsIcon, label: 'Traces', description: 'Agent sessions, turn by turn' }]}
                        />
                    ) : (
                        <>
                            {requests.map((r) => (
                                <button
                                    key={r.id} type="button" onClick={() => go(r.id === selected ? null : r.id)}
                                    className={cn('block w-full border-b border-border/30 px-3 py-2 text-left hover:bg-muted/40 md:grid md:min-w-[860px] md:items-center md:gap-3', COLUMNS, r.id === selected && 'bg-muted/60')}
                                >
                                    <span className="font-mono text-xs text-muted-foreground">{formatSessionTime(r.created_at)}</span>
                                    <span className="hidden md:block"><StatusBadge status={r.status} variant="code" /></span>
                                    <span className="hidden truncate font-mono text-xs md:block">{r.model}</span>
                                    <span className="block truncate font-mono text-xs md:inline">{r.request_preview || <span className="text-muted-foreground">—</span>}</span>
                                    <span className="hidden text-right font-mono text-xs text-muted-foreground md:block">{r.total_tokens.toLocaleString()}</span>
                                    <span className="hidden text-right font-mono text-xs text-muted-foreground md:block">{formatSessionCost(Number(r.cost_usd))}</span>
                                    <span className="hidden text-right font-mono text-xs text-muted-foreground md:block">{formatDuration(r.latency_ms)}</span>
                                    <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground md:hidden">{r.status} · {r.model} · {formatDuration(r.latency_ms)} · {formatSessionCost(Number(r.cost_usd))}</span>
                                </button>
                            ))}
                            <div className="py-4 text-center">
                                {hasNextPage ? (
                                    <button type="button" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage} className="rounded-md border border-border/60 px-3 py-1.5 text-xs hover:bg-muted/50 disabled:opacity-50">
                                        {isFetchingNextPage ? 'Loading…' : 'Load more'}
                                    </button>
                                ) : <p className="text-xs text-muted-foreground">No more requests in this time range.</p>}
                            </div>
                        </>
                    )}
                </div>
            </section>

            {selected && projectId && (
                <aside className="min-h-0 min-w-0 overflow-y-auto border-t border-border/50 p-4 lg:border-l lg:border-t-0">
                    <RequestPanel projectId={projectId} logId={selected} tracesHref={tracesHref} onClose={() => go(null)} />
                </aside>
            )}
        </div>
    );
}
