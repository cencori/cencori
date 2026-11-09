import { describe, expect, it, vi } from 'vitest';
import { Agent, createAgentChatHandler, humanHandoff, humanReply, image, file, run, tool } from './index';
import { readEventStream } from '../agent-chat/protocol';

type Sse = Array<[string, Record<string, unknown>]>;
const sse = (events: Sse) => new Response(events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream', 'X-Cencori-Session-Id': 'ses_1' } });

/** A fake Cencori: streams for turns/approve, JSON for /human. */
function fake(script: Array<Sse | Record<string, unknown>>) {
    const requests: Array<{ method: string; path: string; body: any }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const u = new URL(String(url));
        requests.push({ method: init?.method ?? 'GET', path: u.pathname + u.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        const next = script.shift();
        if (!next) throw new Error(`unexpected ${u.pathname}`);
        return Array.isArray(next) ? sse(next) : new Response(JSON.stringify(next), { headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    return { requests, options: { apiKey: 'csk_t', baseUrl: 'https://cencori.test', fetch: fetchImpl } };
}

describe('images and files in run()', () => {
    it('sends message content parts as the turn input, and guardrails read the text', async () => {
        const seen: string[] = [];
        const agent = new Agent({ name: 'Reader', model: 'gpt-4o', inputGuardrails: [{ name: 'g', execute: ({ input }) => { seen.push(input); return { tripwireTriggered: false }; } }] });
        const c = fake([[['turn.completed', { output: {}, usage: {} }]]]);
        const input = [{ role: 'user' as const, content: [{ type: 'input_text' as const, text: 'What is this?' }, image('https://x.test/a.png'), file('n.txt', new TextEncoder().encode('hi'))] }];
        await run(agent, input, c.options);
        expect(c.requests[0].body.turn.input).toEqual([{ role: 'user', content: [
            { type: 'input_text', text: 'What is this?' },
            { type: 'input_image', image_url: 'https://x.test/a.png' },
            { type: 'input_file', filename: 'n.txt', file_data: 'data:text/plain;base64,aGk=' },
        ] }]);
        expect(seen).toEqual(['What is this?']);
    });
});

describe('human handoff', () => {
    it('the handoff tool hands the session to a person and says so', async () => {
        const onHandoff = vi.fn();
        const agent = new Agent({ name: 'Support', model: 'gpt-4o', tools: [humanHandoff({ onHandoff })] });
        const c = fake([
            [['turn.paused', { reason: 'tool_results_required', action_id: 'h1', actions: [{ action_id: 'h1', tool: 'handoff_to_human', arguments: '{"reason":"wants a refund over the limit"}' }] }]],
            { handled_by: 'human', handoff: { reason: 'wants a refund over the limit' } },
            [['output_text.delta', { delta: 'A person will reply here soon.' }], ['turn.completed', { output: {}, usage: {} }]],
        ]);
        const stream = run(agent, 'I want a human', { ...c.options, stream: true });
        const events = [];
        for await (const e of stream) events.push(e.type);
        expect(c.requests[1]).toMatchObject({ method: 'POST', path: '/v1/sessions/ses_1/human', body: { action: 'handoff', reason: 'wants a refund over the limit' } });
        expect(onHandoff).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'ses_1', reason: 'wants a refund over the limit' }));
        expect(events).toContain('human_handoff');
        expect((await stream.completed).finalOutput).toBe('A person will reply here soon.');
    });

    it('while a person handles it, run() keeps the message for them and returns withHuman', async () => {
        const agent = new Agent({ name: 'Support', model: 'gpt-4o', tools: [tool({ name: 'x', description: '', parameters: {}, execute: () => 1 })] });
        const c = fake([[['owner.handling', {}]]]);
        const result = await run(agent, 'are you there?', { ...c.options, sessionId: 'ses_1' });
        expect(result).toMatchObject({ withHuman: true, finalOutput: undefined });
    });

    it('humanReply posts a reply as a person', async () => {
        const c = fake([{ handled_by: 'human', message: { id: 'm1', from: 'human', text: 'Hi, Ada here', at: '2026-11-09T12:00:00Z' } }]);
        const message = await humanReply('ses_1', 'Hi, Ada here', c.options);
        expect(c.requests[0]).toMatchObject({ method: 'POST', path: '/v1/sessions/ses_1/human', body: { action: 'reply', text: 'Hi, Ada here' } });
        expect(message.from).toBe('human');
    });
});

describe('chat handler', () => {
    it('turns attachments into content parts', async () => {
        const c = fake([[['turn.completed', { output: {}, usage: {} }]]]);
        const handler = createAgentChatHandler(new Agent({ name: 'A', model: 'gpt-4o' }), c.options);
        const res = await handler(new Request('https://app.test/api/chat', { method: 'POST', body: JSON.stringify({ message: 'see this', attachments: [{ kind: 'image', name: 'a.png', data_url: 'data:image/png;base64,AAA=' }, { kind: 'file', name: 'q.pdf', data_url: 'data:application/pdf;base64,AAA=' }] }) }));
        for await (const _ of readEventStream(res.body!)) { /* drain */ }
        expect(c.requests[0].body.turn.input[0].content).toEqual([
            { type: 'input_text', text: 'see this' },
            { type: 'input_image', image_url: 'data:image/png;base64,AAA=' },
            { type: 'input_file', filename: 'q.pdf', file_data: 'data:application/pdf;base64,AAA=' },
        ]);
    });

    it("answers a poll with the team's replies", async () => {
        const c = fake([{ handled_by: 'human', handoff: null, messages: [{ id: 'm1', from: 'human', text: 'On it', at: '2026-11-09T12:00:00Z' }] }]);
        const handler = createAgentChatHandler(new Agent({ name: 'A', model: 'gpt-4o' }), c.options);
        const res = await handler(new Request('https://app.test/api/chat', { method: 'POST', body: JSON.stringify({ sessionId: 'ses_1', poll: { after: '2026-11-09T11:00:00Z' } }) }));
        expect(c.requests[0].path).toBe('/v1/sessions/ses_1/human?after=2026-11-09T11%3A00%3A00Z');
        expect(await res.json()).toEqual({ handled_by: 'human', messages: [{ id: 'm1', from: 'human', text: 'On it', at: '2026-11-09T12:00:00Z' }] });
    });
});
