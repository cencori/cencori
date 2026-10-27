import { describe, expect, it } from 'vitest';
import { runDocsTool } from '@/lib/copilot/docs';

type Results = { results: Array<{ url: string; page: string; excerpt: string }> };

describe('copilot docs search', () => {
    it('finds the product pages for how-to questions', async () => {
        const costgraph = await runDocsTool('search_docs', { query: 'integrate costgraph' }) as Results;
        expect(costgraph.results[0].url).toContain('/docs/integrations/costgraph');
        const whatsapp = await runDocsTool('search_docs', { query: 'connect whatsapp agent' }) as Results;
        expect(whatsapp.results.map((r) => r.url).join(' ')).toContain('/docs/agents/whatsapp');
    });

    it('reads a whole page by the url search returned, and says when there is none', async () => {
        const page = await runDocsTool('read_doc', { url: 'https://cencori.com/docs/integrations/costgraph#connect-from-cencori' }) as { title: string; text: string };
        expect(page.title).toBe('CostGraph');
        expect(page.text).toContain('Settings → Integrations');
        expect(page.text).not.toMatch(/^---/);
        expect(await runDocsTool('read_doc', { url: '/docs/nope' })).toHaveProperty('error');
        expect(await runDocsTool('search_docs', { query: 'the' })).toHaveProperty('error');
    });
});
