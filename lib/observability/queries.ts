import { infiniteQueryOptions } from '@tanstack/react-query';
import type { SessionFilters } from '@/lib/sessions/filters';
import type { RequestLogFilters } from '@/lib/observability/request-log-filters';

/**
 * The Traces and Request logs list queries, shared by the pages and the
 * sidebar (which prefetches a filter's results on hover), so both hit the
 * same cache entry and a click finds its data already there.
 */

export const TRACES_PAGE_SIZE = 50;
export const REQUEST_LOGS_PAGE_SIZE = 50;

export function tracesApiQuery(filters: SessionFilters): string {
    const q = new URLSearchParams({ limit: String(TRACES_PAGE_SIZE), time_range: filters.range });
    if (filters.status.length) q.set('status', filters.status.join(','));
    if (filters.source.length) q.set('source', filters.source.join(','));
    if (filters.q) q.set('search', filters.q);
    return q.toString();
}

export function tracesQuery<Page extends { has_more: boolean }>(projectId: string | null | undefined, filters: SessionFilters) {
    const apiQuery = tracesApiQuery(filters);
    return infiniteQueryOptions<Page, Error, { pages: Page[]; pageParams: unknown[] }, (string | null | undefined)[], number>({
        queryKey: ['observability-traces', projectId, apiQuery],
        queryFn: async ({ pageParam, signal }) => {
            const res = await fetch(`/api/projects/${projectId}/sessions?${apiQuery}&offset=${pageParam}`, { signal });
            if (!res.ok) throw new Error('Could not load traces.');
            return res.json();
        },
        initialPageParam: 0,
        getNextPageParam: (last, pages) => (last.has_more ? pages.length * TRACES_PAGE_SIZE : undefined),
        enabled: Boolean(projectId),
        staleTime: 30_000,
    });
}

export function requestLogsApiQuery(filters: RequestLogFilters): string {
    const q = new URLSearchParams({ per_page: String(REQUEST_LOGS_PAGE_SIZE), time_range: filters.range });
    if (filters.status) q.set('status', filters.status);
    if (filters.model) q.set('model', filters.model);
    if (filters.key) q.set('api_key_id', filters.key);
    if (filters.q) q.set('search', filters.q);
    return q.toString();
}

export function requestLogsQuery<Page extends { pagination?: { total_pages: number } }>(projectId: string | null | undefined, filters: RequestLogFilters) {
    const apiQuery = requestLogsApiQuery(filters);
    return infiniteQueryOptions<Page, Error, { pages: Page[]; pageParams: unknown[] }, (string | null | undefined)[], number>({
        queryKey: ['observability-request-logs', projectId, apiQuery],
        queryFn: async ({ pageParam, signal }) => {
            const res = await fetch(`/api/projects/${projectId}/logs?${apiQuery}&page=${pageParam}`, { signal });
            if (!res.ok) throw new Error('Could not load request logs.');
            return res.json();
        },
        initialPageParam: 1,
        getNextPageParam: (last, pages) => (pages.length < (last.pagination?.total_pages ?? 1) ? pages.length + 1 : undefined),
        enabled: Boolean(projectId),
        staleTime: 30_000,
    });
}

/** Update the URL's query string in place: no server round trip, and useSearchParams follows. */
export function replaceQuery(pathname: string, qs: string) {
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
}
