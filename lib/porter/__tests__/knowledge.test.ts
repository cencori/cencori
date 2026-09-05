import { describe, expect, it, vi } from 'vitest';

const searchDocuments = vi.fn();
vi.mock('@/lib/web/store', () => ({
    createWebDataStore: () => ({ searchDocuments }),
}));

import { buildGroundedPrompt, findPorterPassages } from '@/lib/porter/knowledge';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = {} as any;

const row = (over: Record<string, unknown> = {}) => ({
    title: 'Pricing & Fees',
    canonical_url: 'https://stripe.com/pricing',
    url: 'https://stripe.com/pricing',
    snippet: 'Pay as you go pricing with no setup fees.',
    ...over,
});

describe('findPorterPassages', () => {
    it('reads the snippet the ranked search returns, not a content column', async () => {
        searchDocuments.mockImplementation(async () => [row()]);

        const passages = await findPorterPassages(client, 'p1', 'what does it cost', 'stripe.com');
        expect(passages).toHaveLength(1);
        expect(passages[0].content).toContain('Pay as you go');
    });

    it('scopes the search to the porter own site', async () => {
        searchDocuments.mockImplementation(async () => [row()]);

        searchDocuments.mockClear();
        await findPorterPassages(client, 'p1', 'pricing', 'stripe.com');
        expect(searchDocuments.mock.calls[0][2]).toMatchObject({ domain: 'stripe.com' });
    });

    it('retries with the words that carry meaning when a whole question matches nothing', async () => {
        searchDocuments.mockImplementation(async (_p: string, query: string) =>
            query === 'refund policy' ? [row({ title: 'Refunds' })] : []
        );
        // Only this test's calls. mockClear keeps the implementation; mockReset would not.
        searchDocuments.mockClear();

        const passages = await findPorterPassages(client, 'p1', 'what is your refund policy?', 'stripe.com');
        expect(passages).toHaveLength(1);
        expect(searchDocuments.mock.calls.map(call => call[1])).toEqual([
            'what is your refund policy?',
            'refund policy',
        ]);
    });

    it('drops a row with no usable text rather than citing an empty page', async () => {
        searchDocuments.mockImplementation(async () => [row({ snippet: '', content: '' })]);
        expect(await findPorterPassages(client, 'p1', 'anything', 'stripe.com')).toEqual([]);
    });

    it('answers with nothing rather than failing when the search errors', async () => {
        searchDocuments.mockImplementation(async () => {
            throw new Error('index unavailable');
        });
        expect(await findPorterPassages(client, 'p1', 'anything', 'stripe.com')).toEqual([]);
    });
});

describe('buildGroundedPrompt', () => {
    it('tells a Porter with no pages to decline instead of guessing', () => {
        const prompt = buildGroundedPrompt('base', []);
        expect(prompt).toMatch(/do not guess/i);
        expect(prompt).not.toMatch(/cite/i);
    });

    it('numbers each page and keeps its URL so a citation can be checked', () => {
        const prompt = buildGroundedPrompt('base', [
            { title: 'Pricing', url: 'https://stripe.com/pricing', content: 'fees' },
            { title: 'Refunds', url: 'https://stripe.com/refunds', content: 'policy' },
        ]);
        expect(prompt).toContain('[1] Pricing');
        expect(prompt).toContain('https://stripe.com/pricing');
        expect(prompt).toContain('[2] Refunds');
        expect(prompt).toMatch(/cite the pages you used/i);
    });
});
