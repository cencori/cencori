import 'server-only';
import { checkCustomRateLimit } from '@/lib/rate-limit';
import { searchTinyFish } from './tinyfish';
import type { WebSearchOptions, WebSearchResult } from './types';

/**
 * Live web search, shared by the Web API (/v1/web/search) and the built-in
 * web_search_preview tool. Every project gets its own per-minute allowance,
 * so one busy project can't use up the search provider's limit for everyone.
 */
export const WEB_SEARCHES_PER_MINUTE: Record<string, number> = {
    free: 5,
    pro: 20,
    team: 30,
    enterprise: 60,
};

export function webSearchesPerMinute(tier: string | null | undefined): number {
    return WEB_SEARCHES_PER_MINUTE[(tier || 'free').toLowerCase()] ?? WEB_SEARCHES_PER_MINUTE.free;
}

/** Takes one search from the project's allowance for this minute. */
export async function takeWebSearchSlot(projectId: string, tier: string | null | undefined) {
    const limit = webSearchesPerMinute(tier);
    const result = await checkCustomRateLimit(`web_search:${projectId}`, limit, 60);
    return { ...result, limit };
}

export async function liveWebSearch(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    return searchTinyFish(query, options);
}
