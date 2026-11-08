import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
    Agent,
    CencoriRunError,
    GuardrailTripwireTriggered,
    MaxTurnsExceededError,
    RunState,
    run,
    tool,
} from './index';

type Sse = Array<[event: string, data: Record<string, unknown>]>;

function sseResponse(events: Sse, headers: Record<string, string> = {}): Response {
    const text = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
    const bytes = new TextEncoder().encode(text);
    // Split mid-event to exercise the parser's buffering.
    const cut = Math.floor(bytes.length / 2);
    return new Response(new ReadableStream({
        start(controller) {
            controller.enqueue(bytes.slice(0, cut));
            controller.enqueue(bytes.slice(cut));
            controller.close();
        },
    }), { status: 200, headers: { 'Content-Type': 'text/event-stream', ...headers } });
}

const completed = (text: string): Sse => [
    ['turn.started', { turn_number: 1 }],
    ['output_text.delta', { delta: text }],
    ['turn.completed', { turn_number: 1, output: { output: [] }, usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }],
];

const paused = (actions: Array<{ id: string; tool: string; args: unknown; approval?: boolean }>): Sse => [
    ['turn.started', { turn_number: 1 }],
    ...actions.map((a): [string, Record<string, unknown>] => ['tool_call.started', { tool: a.tool, arguments: a.args, action_id: a.id }]),
    ['turn.paused', {
        reason: actions.some((a) => a.approval) ? 'approval_required' : 'tool_results_required',
        action_id: actions[0].id,
        tool: actions[0].tool,
        actions: actions.map((a) => ({ action_id: a.id, tool: a.tool, arguments: JSON.stringify(a.args), needs_approval: a.approval ?? false })),
    }],
];

/**
 * A fake Cencori: answers sessions, turns and approvals in order, recording
 * each request. POST /v1/sessions with a turn streams that turn back (the
 * current server); `legacy` mimics a server that ignores it.
 */
function fakeCencori(script: Array<Sse | Response>, { legacy = false } = {}) {
    const requests: Array<{ path: string; body: Record<string, any> }> = [];
    let sessions = 0;
    const answer = (path: string, headers: Record<string, string> = {}) => {
        const next = script.shift();
        if (!next) throw new Error(`unexpected request to ${path}`);
        if (!(next instanceof Response)) return sseResponse(next, headers);
        const merged = new Headers(next.headers);
        for (const [name, value] of Object.entries(headers)) merged.set(name, value);
        return new Response(next.body, { status: next.status, headers: merged });
    };
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        requests.push({ path, body });
        if (path === '/v1/sessions') {
            sessions++;
            if (body.turn && !legacy) return answer(path, { 'X-Cencori-Session-Id': `ses_${sessions}` });
            return new Response(JSON.stringify({ id: `ses_${sessions}` }), { status: 201 });
        }
        return answer(path);
    }) as unknown as typeof fetch;
    return { fetch: fetchImpl, requests, options: { apiKey: 'csk_test', baseUrl: 'https://cencori.test', fetch: fetchImpl } };
}

const getOrder = tool({
    name: 'get_order',
    description: 'Look up an order',
    parameters: z.object({ id: z.string() }),
    execute: async ({ id }) => ({ id, status: 'shipped' }),
});

describe('run', () => {
    it('answers in one turn', async () => {
        const cencori = fakeCencori([completed('Hello!')]);
        const agent = new Agent({ name: 'Greeter', instructions: 'Be kind.', model: 'gpt-4o' });

        const result = await run(agent, 'Hi', cencori.options);

        expect(result.finalOutput).toBe('Hello!');
        expect(result.sessionId).toBe('ses_1');
        expect(result.interruptions).toEqual([]);
        expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
        // One request: the session is created with its first turn.
        expect(cencori.requests).toHaveLength(1);
        expect(cencori.requests[0]).toMatchObject({
            path: '/v1/sessions',
            body: {
                metadata: { sdk: 'cencori/agents', agent: 'Greeter' },
                turn: { input: 'Hi', model: 'gpt-4o', instructions: 'Be kind.', stream: true, pause_on_tool_calls: true },
            },
        });
        expect(cencori.requests[0].body.turn.tools).toBeUndefined();
    });

    it('continues a conversation in the same session', async () => {
        const cencori = fakeCencori([completed('Again.')]);
        const agent = new Agent({ name: 'A', model: 'gpt-4o' });
        await run(agent, 'More', { ...cencori.options, sessionId: 'ses_existing' });
        expect(cencori.requests.map((r) => r.path)).toEqual(['/v1/sessions/ses_existing/turns']);
    });

    it('runs tools locally and sends their results back, over several rounds', async () => {
        const cencori = fakeCencori([
            paused([{ id: 'call_1', tool: 'get_order', args: { id: '1042' } }]),
            paused([{ id: 'call_2', tool: 'get_order', args: { id: '1043' } }]),
            completed('Both shipped.'),
        ]);
        const agent = new Agent({ name: 'Support', model: 'claude-sonnet-4-5', tools: [getOrder] });

        const result = await run(agent, 'Orders 1042 and 1043?', cencori.options);

        expect(result.finalOutput).toBe('Both shipped.');
        const turn = cencori.requests[0].body.turn;
        expect(turn.tools).toEqual([{
            type: 'function',
            function: {
                name: 'get_order',
                description: 'Look up an order',
                parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
            },
        }]);
        expect(cencori.requests[1]).toEqual({
            path: '/v1/sessions/ses_1/approve',
            body: { action_id: 'call_1', tool_results: [{ action_id: 'call_1', output: '{"id":"1042","status":"shipped"}' }] },
        });
        expect(cencori.requests[2].body).toEqual({ action_id: 'call_2', tool_results: [{ action_id: 'call_2', output: '{"id":"1043","status":"shipped"}' }] });
        expect(result.newItems.map((i) => i.type)).toEqual(['tool_call', 'tool_output', 'tool_call', 'tool_output', 'message']);
    });

    it('tells the model about bad arguments and tool errors instead of failing the run', async () => {
        const failing = tool({
            name: 'flaky',
            description: 'Fails',
            parameters: z.object({ n: z.number() }),
            execute: async () => { throw new Error('database is down'); },
        });
        const cencori = fakeCencori([
            paused([
                { id: 'a', tool: 'get_order', args: { id: 7 } },
                { id: 'b', tool: 'flaky', args: { n: 1 } },
                { id: 'c', tool: 'nope', args: {} },
            ]),
            completed('Sorry.'),
        ]);
        const agent = new Agent({ name: 'Support', model: 'gpt-4o', tools: [getOrder, failing] });

        await run(agent, 'go', cencori.options);

        const results = cencori.requests[1].body.tool_results as Array<{ action_id: string; output: string }>;
        expect(results[0].output).toMatch(/^Error running get_order: Invalid arguments for get_order: id:/);
        expect(results[1].output).toBe('Error running flaky: database is down');
        expect(results[2].output).toBe('Error: there is no tool named nope.');
    });

    it('hands off: the resumed turn continues as the other agent', async () => {
        const billing = new Agent({
            name: 'Billing',
            instructions: 'You handle refunds.',
            model: 'gemini-2.5-flash',
            handoffDescription: 'refunds and invoices',
            tools: [getOrder],
        });
        const triage = new Agent({ name: 'Triage', model: 'gpt-4o', handoffs: [billing] });
        const cencori = fakeCencori([
            paused([{ id: 'h1', tool: 'transfer_to_billing', args: {} }]),
            completed('Billing here, refund issued.'),
        ]);

        const result = await run(triage, 'I want a refund', cencori.options);

        expect((cencori.requests[0].body.turn.tools as Array<{ function: { name: string; description: string } }>)[0].function)
            .toMatchObject({ name: 'transfer_to_billing', description: 'Hand the conversation to Billing: refunds and invoices' });
        expect(cencori.requests[1].body).toMatchObject({
            action_id: 'h1',
            tool_results: [{ action_id: 'h1', output: expect.stringContaining('Transferred to Billing') }],
            next: {
                instructions: 'You handle refunds.',
                model: 'gemini-2.5-flash',
                tools: [{ type: 'function', function: { name: 'get_order' } }],
                metadata: { sdk: 'cencori/agents', agent: 'Billing' },
            },
        });
        expect(result.lastAgent).toBe(billing);
        expect(result.newItems).toContainEqual({ type: 'handoff', from: 'Triage', to: 'Billing' });
    });

    it('stops for approval, and resumes from a serialized state', async () => {
        const refund = tool({
            name: 'issue_refund',
            description: 'Refund an order',
            parameters: z.object({ id: z.string() }),
            needsApproval: true,
            execute: vi.fn(async ({ id }) => `refunded ${id}`),
        });
        const agent = new Agent({ name: 'Billing', model: 'gpt-4o', tools: [refund, getOrder] });
        const cencori = fakeCencori([
            paused([
                { id: 'r1', tool: 'issue_refund', args: { id: '1042' }, approval: true },
                { id: 'g1', tool: 'get_order', args: { id: '1042' } },
            ]),
            completed('Refunded.'),
        ]);

        const first = await run(agent, 'Refund 1042', cencori.options);
        expect((cencori.requests[0].body.turn.tools as Array<Record<string, unknown>>)[0].needsApproval).toBe(true);
        expect(first.finalOutput).toBeUndefined();
        expect(first.interruptions).toEqual([{ type: 'tool_approval', callId: 'r1', toolName: 'issue_refund', arguments: '{"id":"1042"}', agentName: 'Billing' }]);
        expect(cencori.requests).toHaveLength(1); // nothing sent back yet
        expect(refund).toBeDefined();

        // Later, in another process:
        const state = RunState.fromJSON(JSON.stringify(first.state));
        state.approve(first.interruptions[0]);
        const second = await run(agent, state, cencori.options);

        expect(second.finalOutput).toBe('Refunded.');
        expect(cencori.requests[1].body).toEqual({
            action_id: 'r1',
            tool_results: [
                { action_id: 'r1', output: 'refunded 1042' },
                { action_id: 'g1', output: '{"id":"1042","status":"shipped"}' },
            ],
        });
    });

    it('sends a refusal for a rejected call without running it', async () => {
        const execute = vi.fn(async () => 'deleted');
        const del = tool({ name: 'delete_account', description: 'Delete', needsApproval: true, execute });
        const agent = new Agent({ name: 'Admin', model: 'gpt-4o', tools: [del] });
        const cencori = fakeCencori([
            paused([{ id: 'd1', tool: 'delete_account', args: {}, approval: true }]),
            completed('Okay, I will not.'),
        ]);

        const first = await run(agent, 'Delete me', cencori.options);
        first.state!.reject(first.interruptions[0], { message: 'needs a manager' });
        await run(agent, first.state!, cencori.options);

        expect(execute).not.toHaveBeenCalled();
        expect(cencori.requests[1].body.tool_results).toEqual([
            { action_id: 'd1', output: "The user rejected this call: needs a manager Don't retry it." },
        ]);
    });

    it('decides conditional approval per call in your process', async () => {
        const transfer = tool({
            name: 'send_money',
            description: 'Send money',
            parameters: z.object({ amount: z.number() }),
            needsApproval: async (_ctx, { amount }) => amount > 100,
            execute: async ({ amount }) => `sent ${amount}`,
        });
        const agent = new Agent({ name: 'Bank', model: 'gpt-4o', tools: [transfer] });
        const cencori = fakeCencori([
            paused([{ id: 's1', tool: 'send_money', args: { amount: 20 } }]),
            paused([{ id: 's2', tool: 'send_money', args: { amount: 500 } }]),
        ]);

        const result = await run(agent, 'pay', cencori.options);

        // Not the server's to hold: no needsApproval on the wire.
        expect((cencori.requests[0].body.turn.tools as Array<Record<string, unknown>>)[0].needsApproval).toBeUndefined();
        expect(cencori.requests[1].body.tool_results).toEqual([{ action_id: 's1', output: 'sent 20' }]);
        expect(result.interruptions.map((i) => i.callId)).toEqual(['s2']);
    });

    it('returns typed structured output', async () => {
        const agent = new Agent({
            name: 'Extractor',
            model: 'gpt-4o',
            outputType: z.object({ city: z.string(), days: z.number() }),
        });
        const cencori = fakeCencori([completed('{"city":"Lagos","days":3}')]);

        const result = await run(agent, 'Trip to Lagos for 3 days', cencori.options);

        const output: { city: string; days: number } | undefined = result.finalOutput;
        expect(output).toEqual({ city: 'Lagos', days: 3 });
        expect(cencori.requests[0].body.turn.response_format).toEqual({
            type: 'json_schema',
            json_schema: {
                name: 'final_output',
                schema: { type: 'object', properties: { city: { type: 'string' }, days: { type: 'number' } }, required: ['city', 'days'], additionalProperties: false },
            },
        });
    });

    it('rejects structured output that does not match', async () => {
        const agent = new Agent({ name: 'Extractor', model: 'gpt-4o', outputType: z.object({ days: z.number() }) });
        const cencori = fakeCencori([completed('{"days":"three"}')]);
        await expect(run(agent, 'x', cencori.options)).rejects.toThrow(/Extractor's output: days:/);
    });

    it('stops on an input guardrail before any model call', async () => {
        const agent = new Agent({
            name: 'Support',
            model: 'gpt-4o',
            inputGuardrails: [{ name: 'no_homework', execute: ({ input }) => ({ tripwireTriggered: input.includes('homework'), outputInfo: 'off topic' }) }],
        });
        const cencori = fakeCencori([]);
        const error = await run(agent, 'do my homework', cencori.options).catch((e) => e);
        expect(error).toBeInstanceOf(GuardrailTripwireTriggered);
        expect(error.outputInfo).toBe('off topic');
        expect(cencori.requests).toHaveLength(0); // nothing reached Cencori
    });

    it('stops on an output guardrail', async () => {
        const agent = new Agent({
            name: 'Support',
            model: 'gpt-4o',
            outputGuardrails: [{ name: 'no_promises', execute: ({ output }) => ({ tripwireTriggered: String(output).includes('guarantee') }) }],
        });
        const cencori = fakeCencori([completed('I guarantee it.')]);
        await expect(run(agent, 'x', cencori.options)).rejects.toBeInstanceOf(GuardrailTripwireTriggered);
    });

    it('enforces maxTurns', async () => {
        const agent = new Agent({ name: 'Loop', model: 'gpt-4o', tools: [getOrder] });
        const cencori = fakeCencori([
            paused([{ id: '1', tool: 'get_order', args: { id: '1' } }]),
            paused([{ id: '2', tool: 'get_order', args: { id: '2' } }]),
        ]);
        await expect(run(agent, 'x', { ...cencori.options, maxTurns: 2 })).rejects.toBeInstanceOf(MaxTurnsExceededError);
    });

    it('surfaces failed turns and refused requests', async () => {
        const agent = new Agent({ name: 'A', model: 'gpt-4o' });
        const failed = fakeCencori([[['turn.failed', { output: { error: 'Blocked by policy' } }]]]);
        await expect(run(agent, 'x', failed.options)).rejects.toMatchObject({ name: 'CencoriRunError', message: 'Blocked by policy', sessionId: 'ses_1' });

        const refused = fakeCencori([new Response(JSON.stringify({ error: { message: 'Insufficient credits', code: 'insufficient_credits' } }), { status: 402 })]);
        const error = await run(agent, 'x', refused.options).catch((e) => e);
        expect(error).toBeInstanceOf(CencoriRunError);
        expect(error).toMatchObject({ status: 402, code: 'insufficient_credits' });
    });

    it('streams events, then resolves completed', async () => {
        const agent = new Agent({ name: 'Support', model: 'gpt-4o', tools: [getOrder] });
        const cencori = fakeCencori([
            paused([{ id: 'c1', tool: 'get_order', args: { id: '9' } }]),
            [['output_text.delta', { delta: 'Ship' }], ['output_text.delta', { delta: 'ped.' }], ['turn.completed', { output: {} }]],
        ]);

        const stream = run(agent, 'order 9?', { ...cencori.options, stream: true });
        const types: string[] = [];
        for await (const event of stream) types.push(event.type);
        const result = await stream.completed;

        expect(types).toEqual(['agent_updated', 'tool_call', 'tool_output', 'text_delta', 'text_delta']);
        expect(result.finalOutput).toBe('Shipped.');
    });

    it('completed alone drains a stream; toTextStream yields text', async () => {
        const agent = new Agent({ name: 'A', model: 'gpt-4o' });
        const a = fakeCencori([completed('done')]);
        expect((await run(agent, 'x', { ...a.options, stream: true }).completed).finalOutput).toBe('done');

        const b = fakeCencori([[['output_text.delta', { delta: 'he' }], ['output_text.delta', { delta: 'llo' }], ['turn.completed', {}]]]);
        let text = '';
        for await (const chunk of run(agent, 'x', { ...b.options, stream: true }).toTextStream()) text += chunk;
        expect(text).toBe('hello');
    });

    it('runs an agent as a tool in its own session', async () => {
        const researcher = new Agent({ name: 'Researcher', model: 'gpt-4o', handoffDescription: 'Finds facts.' });
        const writer = new Agent({ name: 'Writer', model: 'gpt-4o', tools: [researcher.asTool()] });
        const cencori = fakeCencori([
            paused([{ id: 'r1', tool: 'researcher', args: { input: 'population of Lagos' } }]),
            completed('About 16 million.'),  // the researcher's own run
            completed('Lagos has about 16 million people.'),
        ]);

        const result = await run(writer, 'Write about Lagos', cencori.options);

        expect(result.finalOutput).toBe('Lagos has about 16 million people.');
        expect(cencori.requests.map((r) => r.path)).toEqual(['/v1/sessions', '/v1/sessions', '/v1/sessions/ses_1/approve']);
        expect(cencori.requests[1].body.metadata).toMatchObject({ parent_session_id: 'ses_1', agent: 'Researcher' });
        expect(cencori.requests[2].body.tool_results).toEqual([{ action_id: 'r1', output: 'About 16 million.' }]);
    });

    it('falls back to a separate turn request on servers without create-with-turn', async () => {
        const cencori = fakeCencori([completed('Hello!')], { legacy: true });
        const result = await run(new Agent({ name: 'A', model: 'gpt-4o' }), 'Hi', cencori.options);
        expect(result.finalOutput).toBe('Hello!');
        expect(result.sessionId).toBe('ses_1');
        expect(cencori.requests.map((r) => r.path)).toEqual(['/v1/sessions', '/v1/sessions/ses_1/turns']);
    });

    it('reports the new session on an error from the first turn', async () => {
        const cencori = fakeCencori([new Response(JSON.stringify({ error: { message: 'Model not allowed', code: 'model_not_allowed' } }), { status: 403 })]);
        const error = await run(new Agent({ name: 'A', model: 'x' }), 'Hi', cencori.options).catch((e) => e);
        expect(error).toMatchObject({ name: 'CencoriRunError', status: 403, code: 'model_not_allowed', sessionId: 'ses_1' });
    });

    it('sends reasoning effort from modelSettings', async () => {
        const cencori = fakeCencori([completed('ok')]);
        await run(new Agent({ name: 'A', model: 'maximo-atlas-1.5', modelSettings: { reasoningEffort: 'low' } }), 'Hi', cencori.options);
        expect(cencori.requests[0].body.turn.reasoning_effort).toBe('low');
    });

    it('uses GPT OSS 120B when no model is given', async () => {
        const cencori = fakeCencori([completed('ok')]);
        const agent = new Agent({ name: 'A' });
        expect(agent.model).toBe('gpt-oss-120b');
        await run(agent, 'Hi', cencori.options);
        expect(cencori.requests[0].body.turn.model).toBe('gpt-oss-120b');
    });

    it('validates definitions up front', () => {
        expect(() => tool({ name: 'has space', description: '', execute: () => '' })).toThrow(/must be 1-64/);
        expect(() => new Agent({ name: 'A', model: '' })).toThrow(/needs a model/);
        expect(() => new Agent({ name: 'A', model: 'm', tools: [getOrder, getOrder] })).toThrow(/two tools named "get_order"/);
    });
});

describe('zod 3 schemas', () => {
    it('converts the common types to JSON Schema', async () => {
        const { z: z3 } = await import('zod/v3');
        const t = tool({
            name: 'search',
            description: 'Search',
            parameters: z3.object({
                query: z3.string().describe('What to find'),
                limit: z3.number().int().optional(),
                kind: z3.enum(['web', 'news']),
                tags: z3.array(z3.string()).default([]),
                exact: z3.boolean().nullable(),
            }),
            execute: async () => 'ok',
        });
        expect(t.parameters).toEqual({
            type: 'object',
            properties: {
                query: { type: 'string', description: 'What to find' },
                limit: { type: 'integer' },
                kind: { type: 'string', enum: ['web', 'news'] },
                tags: { type: 'array', items: { type: 'string' } },
                exact: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
            },
            required: ['query', 'kind', 'exact'],
            additionalProperties: false,
        });
        await expect(t.invoke({ context: undefined, sessionId: 's', agentName: 'a' }, '{"query":"x","kind":"web","exact":null}', 'c')).resolves.toBe('ok');
    });
});
