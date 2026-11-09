/**
 * What Cencori Web costs, charged from credits on every plan except
 * Enterprise (contract) and covered business plans, the same as model usage.
 * There's no provider key to bring for these, so own-key (BYOK) projects pay
 * them too. Failed calls are free.
 *
 * Set 2026-11-09, in line with comparable APIs (Exa search ~$5 per 1,000,
 * Firecrawl ~$1 per 1,000 pages). Change here and the docs/llm.txt follow
 * the numbers in this file.
 */
export const WEB_PRICES_USD = {
    /** Per search. */
    'web/search': 0.005,
    /** Per page fetched. */
    'web/fetch': 0.001,
    /** Per page extracted. */
    'web/extract': 0.002,
    /** Per page a crawl indexes (pages that fail aren't charged). */
    'web/crawl': 0.002,
} as const;

export type BilledWebEndpoint = keyof typeof WEB_PRICES_USD;

/** The charge for a successful call: price × billable units (1 unless the route says otherwise). */
export function webCharge(endpoint: string, units = 1): number {
    const price = (WEB_PRICES_USD as Record<string, number>)[endpoint];
    if (!price || !(units > 0)) return 0;
    return Math.round(price * units * 1_000_000) / 1_000_000;
}
