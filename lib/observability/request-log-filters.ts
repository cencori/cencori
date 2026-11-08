/**
 * Request logs filters, kept in the URL like the Traces filters, so the
 * Observability sidebar sets them and the page reads them.
 *   ?range=24h&status=error&model=gpt-oss-120b&key=<api key id>&q=refund&request=<log id>
 */

export const REQUEST_LOG_RANGES = [
    { value: '1h', label: 'Past hour' },
    { value: '24h', label: 'Past 24 hours' },
    { value: '7d', label: 'Past 7 days' },
    { value: '30d', label: 'Past 30 days' },
    { value: '90d', label: 'Past 90 days' },
    { value: 'all', label: 'All time' },
] as const;

export const REQUEST_LOG_STATUSES = [
    { value: 'success', label: 'Success' },
    { value: 'success_fallback', label: 'Fallback used' },
    { value: 'filtered', label: 'Filtered' },
    { value: 'blocked_output', label: 'Blocked' },
    { value: 'error', label: 'Error' },
    { value: 'rate_limited', label: 'Rate limited' },
] as const;

export const DEFAULT_REQUEST_LOG_RANGE = '24h';

export interface RequestLogFilters {
    range: string;
    status: string | null;
    model: string | null;
    key: string | null;
    q: string;
}

export function readRequestLogFilters(params: { get(name: string): string | null }): RequestLogFilters {
    const range = params.get('range');
    const status = params.get('status');
    return {
        range: REQUEST_LOG_RANGES.some((r) => r.value === range) ? (range as string) : DEFAULT_REQUEST_LOG_RANGE,
        status: REQUEST_LOG_STATUSES.some((s) => s.value === status) ? status : null,
        model: params.get('model') || null,
        key: params.get('key') || null,
        q: (params.get('q') ?? '').trim(),
    };
}

/** The query string for these filters (defaults left out), keeping an open request. */
export function writeRequestLogFilters(filters: RequestLogFilters, request?: string | null): string {
    const params = new URLSearchParams();
    if (filters.range !== DEFAULT_REQUEST_LOG_RANGE) params.set('range', filters.range);
    if (filters.status) params.set('status', filters.status);
    if (filters.model) params.set('model', filters.model);
    if (filters.key) params.set('key', filters.key);
    if (filters.q) params.set('q', filters.q);
    if (request) params.set('request', request);
    return params.toString();
}

export function hasActiveRequestLogFilters(filters: RequestLogFilters): boolean {
    return filters.range !== DEFAULT_REQUEST_LOG_RANGE || Boolean(filters.status || filters.model || filters.key || filters.q);
}
