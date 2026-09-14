import type { WebCrawlJob } from './types';
import type { WebDataStore } from './store';

type SupabaseClient = WebDataStore;

function asNumber(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function asTimestamp(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== 'string') return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
}

export function mapJob(row: Record<string, unknown>): WebCrawlJob {
    return {
        id: String(row.id),
        collectionId: String(row.collection_id),
        visibility: row.visibility === 'project' ? 'project' : 'public',
        status: row.status as WebCrawlJob['status'],
        seeds: Array.isArray(row.seeds) ? row.seeds.filter((seed): seed is string => typeof seed === 'string') : [],
        allowedOrigins: Array.isArray(row.allowed_origins)
            ? row.allowed_origins.filter((origin): origin is string => typeof origin === 'string')
            : [],
        sameOrigin: row.same_origin !== false,
        maxPages: asNumber(row.max_pages),
        maxFrontier: asNumber(row.max_frontier),
        maxDepth: asNumber(row.max_depth),
        maxAttempts: asNumber(row.max_attempts),
        pagesDiscovered: asNumber(row.pages_discovered),
        itemsProcessed: asNumber(row.items_processed),
        pagesProcessed: asNumber(row.pages_processed),
        pagesIndexed: asNumber(row.pages_indexed),
        pagesFailed: asNumber(row.pages_failed),
        pagesSkipped: asNumber(row.pages_skipped),
        lastError: typeof row.last_error === 'string' ? row.last_error : null,
        createdAt: asTimestamp(row.created_at) || '',
        startedAt: asTimestamp(row.started_at),
        finishedAt: asTimestamp(row.finished_at),
    };
}

export async function getPublicCrawlJob(supabase: SupabaseClient, jobId: string): Promise<WebCrawlJob | null> {
    const data = await supabase.getCrawlJob(jobId);
    return data && data.visibility === 'public' ? mapJob(data) : null;
}

export async function listPublicCrawlJobs(
    supabase: SupabaseClient,
    limit = 50,
): Promise<WebCrawlJob[]> {
    const data = await supabase.listPublicCrawlJobs(Math.min(Math.max(limit, 1), 100));
    return data.map(mapJob);
}
