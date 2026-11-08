import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent, createAgentChatHandler, tool } from './index';
import { signState, verifyState } from './chat';
import { readEventStream } from '../agent-chat/protocol';

type Sse = Array<[string, Record<string, unknown>]>;
const sse = (events: Sse) => new Response(events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });

function fakeCencori(script: Sse[]) {
    const requests: Array<{ path: string; body: any }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        requests.push({ path, body });
        const next = script.shift();
        if (!next) throw new Error(`unexpected ${path}`);
        const res = sse(next);
        if (path === '/v1/sessions') res.headers.set('X-Cencori-Session-Id', 'ses_1');
        return res;
    }) as unknown as typeof fetch;
    return { requests, options: { apiKey: 'csk_test', baseUrl: 'https://cencori.test', fetch: fetchImpl } };
}

const post = (body: unknown) => new Request('https://app.test/api/chat', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
async function events(res: Response) {
    const out: Array<{ event: string; data: any }> = [];
    for await (const e of readEventStream(res.body!)) out.push(e);
    return out;
}

const refund = tool({
    name: 'issue_refund', description: 'Refund', parameters: z.object({ id: z.string() }),
    needsApproval: true, execute: async ({ id }) => `refunded ${id}`,
});

describe('createAgentChatHandler', () => {
    it('streams a reply in the agent chat format', async () => {
        const cencori = fakeCencori([[
            ['turn.started', { turn_number: 1 }],
            ['tool_call.completed', { tool: 'render_ui', action_id: 'w1', output: { ok: true, widget_id: 'wgt_1', widget: { type: 'Card', children: [] } } }],
            ['output_text.delta', { delta: 'Hi' }],
            ['turn.completed', { turn_number: 1, output: {}, usage: {} }],
        ]]);
        const handler = createAgentChatHandler(new Agent({ name: 'Sales', model: 'gpt-4o', widgets: true }), cencori.options);
        const out = await events(await handler(post({ message: 'hello' })));
        expect(out.map((e) => e.event)).toEqual(['agent', 'widget', 'text', 'done']);
        expect(out[1].data).toMatchObject({ id: 'wgt_1', widget: { type: 'Card' } });
        expect(out[3].data).toEqual({ sessionId: 'ses_1' });
    });

    it('turns a widget action into the next message', async () => {
        const cencori = fakeCencori([[['turn.completed', { turn_number: 2, output: {}, usage: {} }]]]);
        const handler = createAgentChatHandler(new Agent({ name: 'Sales', model: 'gpt-4o' }), cencori.options);
        await events(await handler(post({ sessionId: 'ses_9', action: { type: 'breakdown', payload: { by: 'product' }, label: 'By product' } })));
        expect(cencori.requests[0].path).toBe('/v1/sessions/ses_9/turns');
        expect(cencori.requests[0].body.input).toBe('[The user used the widget ("By product"): action "breakdown" {"by":"product"}]');
    });

    it('pauses with a signed state and continues with the decisions', async () => {
        const agent = new Agent({ name: 'Billing', model: 'gpt-4o', tools: [refund] });
        const cencori = fakeCencori([
            [['turn.paused', { reason: 'approval_required', action_id: 'r1', tool: 'issue_refund', actions: [{ action_id: 'r1', tool: 'issue_refund', arguments: '{"id":"7"}', needs_approval: true }] }]],
            [['output_text.delta', { delta: 'Refunded.' }], ['turn.completed', { turn_number: 2, output: {}, usage: {} }]],
        ]);
        const handler = createAgentChatHandler(agent, cencori.options);
        const first = await events(await handler(post({ message: 'refund 7' })));
        const approval = first.find((e) => e.event === 'approval')!;
        expect(approval.data.items).toEqual([{ callId: 'r1', toolName: 'issue_refund', arguments: '{"id":"7"}', agentName: 'Billing' }]);

        // A changed state is refused.
        const [payload, sig] = approval.data.state.split('.');
        const forged = Buffer.from(Buffer.from(payload, 'base64url').toString().replace(/"turnsUsed":\d+/, '"turnsUsed":0')).toString('base64url');
        expect(forged).not.toBe(payload);
        expect((await handler(post({ approval: { state: `${forged}.${sig}`, decisions: { r1: { approved: true } } } }))).status).toBe(400);

        const second = await events(await handler(post({ approval: { state: approval.data.state, decisions: { r1: { approved: true } } } })));
        expect(second.map((e) => e.event)).toContain('done');
        expect(cencori.requests[1].body.tool_results).toEqual([{ action_id: 'r1', output: 'refunded 7' }]);
    });

    it('checks the session belongs to the user', async () => {
        const handler = createAgentChatHandler(new Agent({ name: 'A', model: 'gpt-4o' }), { ...fakeCencori([]).options, authorizeSession: () => false });
        expect((await handler(post({ sessionId: 'ses_other', message: 'hi' }))).status).toBe(403);
    });

    it('rejects empty requests', async () => {
        const handler = createAgentChatHandler(new Agent({ name: 'A', model: 'gpt-4o' }), fakeCencori([]).options);
        expect((await handler(post({}))).status).toBe(400);
    });
});

describe('signed state', () => {
    it('round-trips and rejects another secret', async () => {
        const token = await signState('{"a":1}', 'k1');
        expect(await verifyState(token, 'k1')).toBe('{"a":1}');
        expect(await verifyState(token, 'k2')).toBeNull();
        expect(await verifyState('nope', 'k1')).toBeNull();
    });
});
