/**
 * Sessions filters, kept in the URL so the sidebar (where they're set) and the
 * page (which reads them) always agree, and a filtered view is a link.
 *   ?range=24h&status=paused,failed&source=sdk,arcie&q=Billing
 */

export const TIME_RANGES = [
    { value: '1h', label: 'Past hour' },
    { value: '24h', label: 'Past 24 hours' },
    { value: '7d', label: 'Past 7 days' },
    { value: '30d', label: 'Past 30 days' },
    { value: '90d', label: 'Past 90 days' },
    { value: 'all', label: 'All time' },
] as const;

export const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Waiting' },
    { value: 'completed', label: 'Ended' },
    { value: 'failed', label: 'Failed' },
] as const;

export const SOURCE_OPTIONS = [
    { value: 'sdk', label: 'Agents SDK' },
    { value: 'arcie', label: 'Arcie' },
    { value: 'widget', label: 'Widget & links' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'embedded', label: 'Embedded' },
] as const;

export const DEFAULT_RANGE = '7d';

export interface SessionFilters {
    range: string;
    status: string[];
    source: string[];
    q: string;
}

const list = (value: string | null, allowed: readonly { value: string }[]) =>
    (value ?? '').split(',').filter((v) => allowed.some((a) => a.value === v));

export function readSessionFilters(params: URLSearchParams | { get(name: string): string | null }): SessionFilters {
    const range = params.get('range');
    return {
        range: TIME_RANGES.some((r) => r.value === range) ? (range as string) : DEFAULT_RANGE,
        status: list(params.get('status'), STATUS_OPTIONS),
        source: list(params.get('source'), SOURCE_OPTIONS),
        q: (params.get('q') ?? '').trim(),
    };
}

/** The query string for these filters, defaults left out. */
export function writeSessionFilters(filters: SessionFilters): string {
    const params = new URLSearchParams();
    if (filters.range !== DEFAULT_RANGE) params.set('range', filters.range);
    if (filters.status.length) params.set('status', filters.status.join(','));
    if (filters.source.length) params.set('source', filters.source.join(','));
    if (filters.q) params.set('q', filters.q);
    return params.toString();
}

export function hasActiveFilters(filters: SessionFilters): boolean {
    return filters.range !== DEFAULT_RANGE || filters.status.length > 0 || filters.source.length > 0 || filters.q !== '';
}
