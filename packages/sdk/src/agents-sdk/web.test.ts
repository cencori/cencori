import { describe, expect, it, vi } from 'vitest';
import { Agent, run, webFetch, webSearch } from './index';

type Sse = Array<[string, Record<string, unknown>]>;
const sse = (events: Sse) => new Response(events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream', 'X-Cencori-Session-Id': 'ses_1' } });

function fake(script: Array<Sse | Record<string, unknown>>) {
    const requests: Array<{ path: string; body: any }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const u = new URL(String(url));
        requests.push({ path: u.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        const next = script.shift();
        if (!next) throw new Error(`unexpected ${u.pathname}`);
        return Array.isArray(next) ? sse(next) : new Response(JSON.stringify(next), { headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    return { requests, options: { apiKey: 'csk_t', baseUrl: 'https://cencori.test', fetch: fetchImpl } };
}

const paused = (tool: string, args: Record<string, unknown>): Sse => [['turn.paused', { reason: 'tool_results_required', action_id: 'a1', actions: [{ action_id: 'a1', tool, arguments: JSON.stringify(args) }] }]];
const done: Sse = [['output_text.delta', { delta: 'ok' }], ['turn.completed', { output: {}, usage: {} }]];

describe('web tools', () => {
    it('webSearch searches the live web and hands back titles, URLs and snippets marked untrusted', async () => {
        const agent = new Agent({ name: 'R', model: 'gpt-4o', tools: [webSearch({ limit: 3, domain: 'python.org' })] });
        const c = fake([
            paused('web_search', { query: 'asyncio timeout', freshness: '7d' }),
            { results: [{ title: 'asyncio', url: 'https://docs.python.org/a', canonicalUrl: 'https://docs.python.org/a', snippet: 'Timeouts…', publishedAt: null }] },
            done,
        ]);
        await run(agent, 'how do asyncio timeouts work?', c.options);
        expect(c.requests[1]).toEqual({ path: '/api/v1/web/search', body: { query: 'asyncio timeout', limit: 3, domain: 'python.org', freshness: '7d' } });
        const output = JSON.parse(c.requests[2].body.tool_results[0].output);
        expect(output.note).toMatch(/Untrusted/);
        expect(output.results).toEqual([{ title: 'asyncio', url: 'https://docs.python.org/a', snippet: 'Timeouts…' }]);
    });

    it('webFetch reads a page as text and trims long pages', async () => {
        const agent = new Agent({ name: 'R', model: 'gpt-4o', tools: [webFetch({ maxChars: 1_000 })] });
        const c = fake([
            paused('web_fetch', { url: 'https://example.com/a' }),
            { title: 'A', canonicalUrl: 'https://example.com/a', content: 'x'.repeat(5_000) },
            done,
        ]);
        await run(agent, 'read it', c.options);
        expect(c.requests[1]).toEqual({ path: '/api/v1/web/extract', body: { url: 'https://example.com/a' } });
        const output = JSON.parse(c.requests[2].body.tool_results[0].output);
        expect(output.content.length).toBeLessThan(1_100);
        expect(output.content).toMatch(/truncated/);
    });
});
