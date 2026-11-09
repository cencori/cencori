/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    allowed: true,
    live: [] as Array<Record<string, unknown>>,
    liveError: null as Error | null,
    indexed: [] as Array<Record<string, unknown>>,
    charges: [] as Array<unknown[]>,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/web/live-search', () => ({
    takeWebSearchSlot: vi.fn(async () => ({ allowed: state.allowed, remaining: 0, reset: Date.now(), limit: 5 })),
    liveWebSearch: vi.fn(async () => { if (state.liveError) throw state.liveError; return state.live; }),
}));
vi.mock('@/lib/web/index', () => ({ searchWebIndex: vi.fn(async () => state.indexed) }));
vi.mock('@/lib/web/store', () => ({ createWebDataStore: () => ({}) }));
vi.mock('@/lib/project-credit-billing', () => ({
    chargeProjectUsageCredits: vi.fn(async (...args: unknown[]) => { state.charges.push(args); return true; }),
}));

import { executeWebSearch } from '@/lib/gateway/v1-responses-tools';
import { WEB_PRICES_USD } from '@/lib/web/pricing';

const hit = (url: string, title = url) => ({ title, url, canonicalUrl: url, snippet: `about ${url}` });
const billing = { organizationId: 'org_1', tier: 'free', requestId: 'req_1' };
const urls = (out: Awaited<ReturnType<typeof executeWebSearch>>) => (out.output?.results as Array<{ url: string }>).map((r) => r.url);

describe('web_search_preview', () => {
    beforeEach(() => {
        state.allowed = true; state.live = []; state.liveError = null; state.indexed = []; state.charges.length = 0;
    });

    it('searches the live web first, adds the index without duplicates, and charges one search', async () => {
        state.live = [hit('https://a.test'), hit('https://b.test')];
        state.indexed = [hit('https://b.test'), hit('https://c.test')];
        const out = await executeWebSearch('q', { type: 'web_search_preview', search_context_size: 'medium' }, 'p1', undefined, billing);
        expect(urls(out)).toEqual(['https://a.test', 'https://b.test', 'https://c.test']);
        expect(state.charges).toEqual([['org_1', 'free', WEB_PRICES_USD['web/search'], 'web/search', 'req_1:web_search']]);
    });

    it('over the per-minute allowance, answers from the index for free', async () => {
        state.allowed = false;
        state.indexed = [hit('https://c.test')];
        const out = await executeWebSearch('q', { type: 'web_search_preview' }, 'p1', undefined, billing);
        expect(urls(out)).toEqual(['https://c.test']);
        expect(state.charges).toEqual([]);
    });

    it('if live search fails, falls back to the index and charges nothing', async () => {
        state.liveError = new Error('provider down');
        state.indexed = [hit('https://c.test')];
        const out = await executeWebSearch('q', { type: 'web_search_preview' }, 'p1', undefined, billing);
        expect(out.status).toBe('completed');
        expect(urls(out)).toEqual(['https://c.test']);
        expect(state.charges).toEqual([]);
    });

    it('does not charge a business plan that covers usage', async () => {
        state.live = [hit('https://a.test')];
        await executeWebSearch('q', { type: 'web_search_preview' }, 'p1', undefined, { ...billing, covered: true });
        expect(state.charges).toEqual([]);
    });

    it('without billing details searches only the index (as before)', async () => {
        state.live = [hit('https://a.test')];
        state.indexed = [hit('https://c.test')];
        const out = await executeWebSearch('q', { type: 'web_search_preview' }, 'p1');
        expect(urls(out)).toEqual(['https://c.test']);
    });
});
