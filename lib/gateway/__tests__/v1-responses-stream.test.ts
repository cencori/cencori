/**
 * @vitest-environment node
 *
 * Streaming contract for /v1/responses.
 *
 * This endpoint used to accumulate the whole answer and emit it as a single
 * `response.output_text.delta` after the provider finished, so a client's
 * time-to-first-token equalled full generation time — measured against the live
 * gateway, every model returned exactly one delta here while the same model
 * streamed 10–19 frames on /v1/chat/completions. These tests pin the incremental
 * release, and pin that it did not cost the output guard its veto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecuteGatewayChat = vi.fn();
const mockStreamGatewayChat = vi.fn();
const mockResolveGatewayProvider = vi.fn();

vi.mock('@/lib/gateway/chat-executor', () => ({
    executeGatewayChat: (...args: unknown[]) => mockExecuteGatewayChat(...args),
    streamGatewayChat: (...args: unknown[]) => mockStreamGatewayChat(...args),
}));

vi.mock('@/lib/gateway/providers-setup', () => ({
    resolveGatewayProvider: (...args: unknown[]) => mockResolveGatewayProvider(...args),
}));

vi.mock('@/lib/gateway/output-guard', () => ({
    runGatewayOutputGuard: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: vi.fn() }));

const mockOrgHasOutputPolicies = vi.fn();

vi.mock('@/lib/governance/policy-enforcement', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/governance/policy-enforcement')>()),
    orgHasOutputPolicies: (...args: unknown[]) => mockOrgHasOutputPolicies(...args),
}));

import { runGatewayOutputGuard } from '@/lib/gateway/output-guard';
import { runV1ResponsesExecution } from '@/lib/gateway/v1-responses-execute';
import { STREAM_GUARD_HOLDBACK_CHARS } from '@/lib/gateway/stream-guard';
import { createMockGatewayContext, toUnifiedMessages } from '@/lib/gateway/__tests__/fixtures';
import type { SecurityCheckResult } from '@/lib/safety/multi-layer-check';

const inputSecurity: SecurityCheckResult = {
    safe: true,
    reasons: [],
    layer: 'input',
    riskScore: 0,
    confidence: 1,
};

const mockProvider = {
    countTokens: vi.fn(async (text: string) => Math.ceil(text.length / 4)),
    getPricing: vi.fn(async () => ({
        inputPer1KTokens: 0.001,
        outputPer1KTokens: 0.002,
        cencoriMarkupPercentage: 10,
    })),
};

function baseParams(overrides: Record<string, unknown> = {}) {
    return {
        supabase: {} as never,
        gatewayCtx: createMockGatewayContext(),
        model: 'gpt-4o',
        body: { model: 'gpt-4o', input: 'Hello', stream: true },
        messages: toUnifiedMessages([{ role: 'user', content: 'Hello' }]),
        inputText: 'Hello',
        inputSecurity,
        endUserId: null,
        endUserQuota: null,
        tier: 'free' as const,
        recordEndUserUsage: vi.fn(),
        logSuccess: vi.fn(),
        incrementUsage: vi.fn(),
        ...overrides,
    } as never;
}

function chunk(overrides: Record<string, unknown> = {}) {
    return {
        actualProvider: 'openai',
        actualModel: 'gpt-4o',
        usedFallback: false,
        originalProvider: 'openai',
        originalModel: 'gpt-4o',
        billingMode: 'standard',
        delta: '',
        ...overrides,
    };
}

/** Feeds chunks on demand so a test can read the response before the stream finishes. */
function controllableStream() {
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    mockStreamGatewayChat.mockImplementation(() =>
        (async function* () {
            // Comfortably past the holdback so a release is due.
            yield chunk({ delta: 'A'.repeat(STREAM_GUARD_HOLDBACK_CHARS + 40) });
            await gate;
            yield chunk({ delta: 'TAIL', finishReason: 'stop' });
        })()
    );
    return { finish: () => release?.() };
}

/** The wire shape is `event: <type>\ndata: <json>\n\n`, so the type is a line, not a JSON field. */
const DELTA_EVENT = /event: response\.output_text\.delta\ndata: (\{[^\n]*\})/g;

function deltasIn(text: string): string[] {
    return [...text.matchAll(new RegExp(DELTA_EVENT.source, 'g'))].map((m) => m[1]);
}

function joinedDeltaText(text: string): string {
    return deltasIn(text)
        .map((json) => (JSON.parse(json) as { delta?: string }).delta ?? '')
        .join('');
}

beforeEach(() => {
    vi.clearAllMocks();
    (runGatewayOutputGuard as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    // The guard-veto tests below need a policy that can act on output.
    mockOrgHasOutputPolicies.mockResolvedValue(true);
    mockResolveGatewayProvider.mockResolvedValue({
        providerName: 'openai',
        router: { hasProvider: () => true, getProvider: () => mockProvider },
        provider: mockProvider,
    });
});

afterEach(() => vi.useRealTimers());

describe('/v1/responses streaming', () => {
    it('settles an upstream EOF without a terminal choice as a recoverable failure', async () => {
        mockStreamGatewayChat.mockImplementation(() => (async function* () {
            yield chunk({ delta: 'Partial draft' });
        })());
        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const body = await new Response(result.response.body).text();
        expect(body).toContain('event: response.done');
        expect(body).toContain('"status":"failed"');
        expect(body).toContain('stream ended before sending a completion signal');
    });
    it('keeps a pending stream alive with standard events and stops its timer at completion', async () => {
        vi.useFakeTimers();
        const { finish } = controllableStream();
        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const reader = result.response.body!.getReader();
        await reader.read();
        await vi.advanceTimersByTimeAsync(45_000);
        const ids = [];
        for (let i = 0; i < 3; i++) {
            const heartbeat = new TextDecoder().decode((await reader.read()).value);
            expect(heartbeat).toContain('event: response.in_progress');
            const event = JSON.parse(heartbeat.split('data: ')[1]);
            expect(event.type).toBe('response.in_progress');
            expect(event.response.status).toBe('in_progress');
            expect(event.response.output).toEqual([]);
            ids.push(event.response.id);
        }
        finish();
        let tail = '';
        for (;;) {
            const next = await reader.read();
            if (next.done) break;
            tail += new TextDecoder().decode(next.value);
        }
        expect(new Set(ids).size).toBe(1);
        expect(tail).toContain(`"id":"${ids[0]}"`);
        expect(tail).toContain('"status":"completed"');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('cancels provider work and keepalives when the client disconnects', async () => {
        vi.useFakeTimers();
        let signal!: AbortSignal;
        mockStreamGatewayChat.mockImplementation(({ request }) => (async function* () {
            signal = request.signal;
            yield chunk({ delta: 'A'.repeat(STREAM_GUARD_HOLDBACK_CHARS + 40) });
            await new Promise((_, reject) => {
                signal.addEventListener('abort', () => reject(new Error('Client disconnected')), { once: true });
            });
        })());
        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const reader = result.response.body!.getReader();
        await reader.read();
        await reader.cancel('User stopped the task');
        expect(signal.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });
    it.each(['low', 'medium', 'high', 'xhigh', 'max'])('forwards Responses reasoning %s to the provider', async effort => {
        mockStreamGatewayChat.mockImplementation(() => (async function* () {
            yield chunk({ delta: 'OK', finishReason: 'stop' });
        })());
        const result = await runV1ResponsesExecution(baseParams({
            body: { model: 'maximo-atlas-1.3', input: 'Hello', stream: true, reasoning: { effort, summary: 'auto' } },
            model: 'maximo-atlas-1.3',
        }));
        if (!result.ok) throw new Error('expected ok');
        await new Response(result.response.body).text();
        expect(mockStreamGatewayChat).toHaveBeenCalledWith(expect.objectContaining({
            request: expect.objectContaining({ reasoningEffort: effort }),
        }));
    });

    it('releases the approved final text while pricing is still pending', async () => {
        const { finish } = controllableStream();
        let releasePricing!: (pricing: { inputPer1KTokens: number; outputPer1KTokens: number; cencoriMarkupPercentage: number }) => void;
        const pricing = new Promise<{ inputPer1KTokens: number; outputPer1KTokens: number; cencoriMarkupPercentage: number }>(resolve => {
            releasePricing = resolve;
        });
        mockProvider.getPricing.mockImplementationOnce(() => pricing);
        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const reader = result.response.body!.getReader();
        await reader.read();
        finish();
        try {
            // The model finished, but accounting deliberately has not. Its last words still arrive.
            const tail = new TextDecoder().decode((await reader.read()).value);
            expect(joinedDeltaText(tail)).toBe('A'.repeat(STREAM_GUARD_HOLDBACK_CHARS) + 'TAIL');
        } finally {
            releasePricing({ inputPer1KTokens: 0.001, outputPer1KTokens: 0.002, cencoriMarkupPercentage: 10 });
        }
        while (!(await reader.read()).done) { /* Drain settlement. */ }
    });

    it('releases text before the provider has finished', async () => {
        const { finish } = controllableStream();

        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const reader = result.response.body!.getReader();

        // The decisive assertion: a delta is readable while the generator is still
        // parked, so the client is not waiting on the full answer.
        const first = new TextDecoder().decode((await reader.read()).value);
        expect(deltasIn(first).length).toBeGreaterThan(0);
        expect(first).toContain('AAAA');
        expect(first).not.toContain('TAIL');

        finish();
        while (!(await reader.read()).done) {
            // Drain so settlement completes.
        }
    });

    it('holds back the trailing boundary until completion', async () => {
        const { finish } = controllableStream();

        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const reader = result.response.body!.getReader();
        const first = new TextDecoder().decode((await reader.read()).value);

        // The scanner needs a rolling suffix to inspect, so the last characters stay held.
        const released = joinedDeltaText(first);
        expect(released.length).toBeGreaterThan(0);
        expect(released.length).toBeLessThan(STREAM_GUARD_HOLDBACK_CHARS + 40);

        finish();
        let rest = '';
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            rest += new TextDecoder().decode(value);
        }
        // Everything owed arrives by the end, exactly once.
        expect(rest).toContain('TAIL');
    });

    it('sends each character exactly once across all deltas', async () => {
        mockStreamGatewayChat.mockImplementation(() =>
            (async function* () {
                yield chunk({ delta: 'B'.repeat(60) });
                yield chunk({ delta: 'C'.repeat(60) });
                yield chunk({ delta: '', finishReason: 'stop' });
            })()
        );

        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const body = await new Response(result.response.body).text();

        expect(joinedDeltaText(body)).toBe('B'.repeat(60) + 'C'.repeat(60));
        expect(body).toContain('event: response.output_text.done');
    });

    /** An empty stop settles (flag, don't fail) — and says so on the response itself. */
    it('marks a streamed turn that produced no message', async () => {
        mockStreamGatewayChat.mockImplementation(() =>
            (async function* () {
                yield chunk({
                    delta: '',
                    finishReason: 'stop',
                    usage: { promptTokens: 9, completionTokens: 0, totalTokens: 9 },
                });
            })()
        );

        const result = await runV1ResponsesExecution(baseParams({
            body: { model: 'gpt-4o', input: 'Hello', stream: true, store: false },
        }));
        if (!result.ok) throw new Error('expected ok');
        const body = await new Response(result.response.body).text();
        expect(body).toContain('event: response.done');
        expect(body).toContain('"status":"completed"');
        expect(body).toContain('"cencori_empty_completion":"true"');
    });

    /** The whole point of the holdback: incremental release must not cost the guard its veto. */
    it('stops releasing once the guard rejects the output', async () => {
        (runGatewayOutputGuard as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 403,
            code: 'output_security_violation',
            message: 'Response blocked',
        });
        mockStreamGatewayChat.mockImplementation(() =>
            (async function* () {
                yield chunk({ delta: 'SECRET'.repeat(20) });
                yield chunk({ delta: '', finishReason: 'stop' });
            })()
        );

        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const body = await new Response(result.response.body).text();

        expect(deltasIn(body)).toHaveLength(0);
        expect(body).not.toContain('SECRET');
        expect(body).toContain('output_security_violation');
    });

    /**
     * The catch path computed the provider's message and dropped it, so every mid-stream failure
     * reached clients as a bare "upstream response failed" — the codex runtime falls back to that
     * string when `response.error.message` is absent — and the real cause never left the gateway.
     */
    it('reports why a mid-stream provider failure failed', async () => {
        mockStreamGatewayChat.mockImplementation(() =>
            (async function* () {
                yield chunk({ delta: 'partial' });
                throw new Error('All providers exhausted. Primary (cerebras): 402');
            })()
        );

        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const body = await new Response(result.response.body).text();

        const done = JSON.parse(
            body.match(/event: response\.done\ndata: (\{[\s\S]*?\})\n\n/)?.[1] ?? '{}'
        ) as { response?: { status?: string; error?: { message?: string } } };

        expect(done.response?.status).toBe('failed');
        // Inside `response`, not beside it: a sibling is not where clients look.
        expect(done.response?.error?.message).toContain('All providers exhausted');
    });

    it('says why the guard blocked, on the response itself', async () => {
        (runGatewayOutputGuard as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 403,
            code: 'output_security_violation',
            message: 'Response blocked',
        });
        mockStreamGatewayChat.mockImplementation(() =>
            (async function* () {
                yield chunk({ delta: 'x'.repeat(60), finishReason: 'stop' });
            })()
        );

        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const body = await new Response(result.response.body).text();

        const done = JSON.parse(
            body.match(/event: response\.done\ndata: (\{[\s\S]*?\})\n\n/)?.[1] ?? '{}'
        ) as { response?: { error?: { message?: string; code?: string } } };

        expect(done.response?.error?.code).toBe('output_security_violation');
        expect(done.response?.error?.message).toBe('Response blocked');
    });


    /**
     * The agent runtime deserializes `cached_tokens: i64` with no serde default, so omitting the
     * field fails the entire response with "missing field `cached_tokens`" and kills the turn.
     * Making it conditional shipped exactly that break. It is always present here, whatever the
     * provider did or did not report.
     */
    it('always emits cached_tokens, even when the provider reports nothing', async () => {
        mockStreamGatewayChat.mockImplementation(() =>
            (async function* () {
                // No usage at all: the provider says nothing about caching.
                yield chunk({ delta: 'hello', finishReason: 'stop' });
            })()
        );

        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const body = await new Response(result.response.body).text();

        const done = JSON.parse(
            body.match(/event: response\.done\ndata: (\{[\s\S]*?\})\n\n/)?.[1] ?? '{}'
        ) as { response?: { usage?: { input_tokens_details?: Record<string, unknown> } } };
        const details = done.response?.usage?.input_tokens_details;

        expect(details).toBeDefined();
        expect(details).toHaveProperty('cached_tokens');
        expect(typeof details?.cached_tokens).toBe('number');
    });

    it('marks the stream no-transform so an intermediary cannot re-buffer it', async () => {
        mockStreamGatewayChat.mockImplementation(() =>
            (async function* () {
                yield chunk({ delta: 'hi', finishReason: 'stop' });
            })()
        );

        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');

        expect(result.response.headers.get('X-Accel-Buffering')).toBe('no');
        expect(result.response.headers.get('Cache-Control')).toContain('no-transform');
        await new Response(result.response.body).text();
    });
});

/**
 * The holdback exists so a policy can veto output before the client sees it. An org with no
 * policy that can act on output has nothing to wait for, so the tail is not held.
 */
describe('/v1/responses streaming with no output policy', () => {
    beforeEach(() => mockOrgHasOutputPolicies.mockResolvedValue(false));

    it('releases everything received so far, with no held tail', async () => {
        const { finish } = controllableStream();

        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const reader = result.response.body!.getReader();
        const first = new TextDecoder().decode((await reader.read()).value);

        expect(joinedDeltaText(first)).toBe('A'.repeat(STREAM_GUARD_HOLDBACK_CHARS + 40));

        finish();
        while (!(await reader.read()).done) {
            // Drain so settlement completes.
        }
    });

    it('skips the per-batch guard but keeps the completion check', async () => {
        mockStreamGatewayChat.mockImplementation(() =>
            (async function* () {
                yield chunk({ delta: 'B'.repeat(60) });
                yield chunk({ delta: 'C'.repeat(60) });
                yield chunk({ delta: '', finishReason: 'stop' });
            })()
        );

        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const body = await new Response(result.response.body).text();

        expect(joinedDeltaText(body)).toBe('B'.repeat(60) + 'C'.repeat(60));
        expect(runGatewayOutputGuard).toHaveBeenCalledTimes(1);
    });
});

describe('/v1/responses streaming tool calls written as text', () => {
    const readFile = {
        type: 'function',
        function: {
            name: 'read_file',
            parameters: { type: 'object', properties: { path: { type: 'string' } } },
        },
    };

    /** Prose long enough to force a real mid-stream release, then markup split across chunks. */
    function streamWithMarkup(markup: string[]) {
        const prose = 'B'.repeat(STREAM_GUARD_HOLDBACK_CHARS + 40);
        mockStreamGatewayChat.mockImplementation(() =>
            (async function* () {
                yield chunk({ delta: prose });
                for (const piece of markup) yield chunk({ delta: piece });
                yield chunk({ delta: '', finishReason: 'stop' });
            })()
        );
        return prose;
    }

    async function readAll(body: ReadableStream<Uint8Array>) {
        const reader = body.getReader();
        let text = '';
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return text;
            text += new TextDecoder().decode(value);
        }
    }

    it('never shows the markup, and emits a real call instead', async () => {
        // Split mid-tag: `<tool` and `_call>` arrive separately, which is how it actually comes off
        // the wire and the case a naive whole-tag check misses.
        streamWithMarkup([
            '<tool',
            '_call><function=read_file><parameter=path>src/a.ts</parameter>',
            '</function></tool_call>',
        ]);

        const result = await runV1ResponsesExecution(baseParams({
            body: { model: 'gpt-4o', input: 'Hello', stream: true, tools: [readFile] },
        }));
        if (!result.ok) throw new Error('expected ok');
        const text = await readAll(result.response.body!);

        const released = joinedDeltaText(text);
        expect(released).not.toContain('<tool_call>');
        expect(released).not.toContain('<function=');
        expect(released).not.toContain('<tool');

        // The call itself took the ordinary path.
        expect(text).toContain('response.function_call_arguments.done');
        expect(text).toContain('read_file');
        expect(text).toContain(JSON.stringify({ path: 'src/a.ts' }).replace(/"/g, '\\"'));
    });

    it('still delivers the prose that came before the call', async () => {
        const prose = streamWithMarkup([
            '<tool_call><function=read_file><parameter=path>src/a.ts</parameter></function></tool_call>',
        ]);

        const result = await runV1ResponsesExecution(baseParams({
            body: { model: 'gpt-4o', input: 'Hello', stream: true, tools: [readFile] },
        }));
        if (!result.ok) throw new Error('expected ok');

        expect(joinedDeltaText(await readAll(result.response.body!))).toBe(prose);
    });

    it('leaves markup for a tool the request never offered as text', async () => {
        // A model quoting or explaining the syntax is not making a call. Holding it back must not
        // mean losing it: the text is owed to the client either way.
        const prose = streamWithMarkup([
            '<tool_call><function=delete_everything></function></tool_call>',
        ]);

        const result = await runV1ResponsesExecution(baseParams({
            body: { model: 'gpt-4o', input: 'Hello', stream: true, tools: [readFile] },
        }));
        if (!result.ok) throw new Error('expected ok');
        const text = await readAll(result.response.body!);

        expect(joinedDeltaText(text)).toBe(
            `${prose}<tool_call><function=delete_everything></function></tool_call>`
        );
        expect(text).not.toContain('delete_everything"');
    });
});

describe('/v1/responses streaming logs the work, not just the prose', () => {
    it('hands the tool calls to the request log, recovered ones included', async () => {
        const logSuccess = vi.fn();
        mockStreamGatewayChat.mockImplementation(() =>
            (async function* () {
                yield chunk({
                    delta: '<tool_call><function=read_file><parameter=path>a.ts</parameter></function></tool_call>',
                });
                yield chunk({ delta: '', finishReason: 'stop' });
            })()
        );

        const result = await runV1ResponsesExecution(baseParams({
            logSuccess,
            body: {
                model: 'gpt-4o',
                input: 'Hello',
                stream: true,
                tools: [{ type: 'function', function: { name: 'read_file' } }],
            },
        }));
        if (!result.ok) throw new Error('expected ok');
        const reader = result.response.body!.getReader();
        while (!(await reader.read()).done) {
            // Drain so settlement and logging complete.
        }

        // The turn produced no prose whatsoever -- this row would have logged blank.
        expect(logSuccess).toHaveBeenCalledTimes(1);
        const meta = logSuccess.mock.calls[0]?.[0] as {
            responseText?: string;
            toolCalls?: Array<{ name: string; arguments: string }>;
        };
        expect(meta.responseText).toBe('');
        expect(meta.toolCalls).toEqual([{ name: 'read_file', arguments: '{"path":"a.ts"}' }]);
    });
});

describe('/v1/responses replaying an agent\'s own history', () => {
    /**
     * A `function_call` input item used to become an assistant turn with empty content and a bare
     * `toolCallId`, dropping the tool name and arguments entirely. On its eighth request an agent
     * was replaying seven blank assistant turns: the model could not see what it had already
     * called, and neither could the request log.
     */
    it('sends the prior tool call to the provider, not an empty turn', async () => {
        mockStreamGatewayChat.mockImplementation(() =>
            (async function* () {
                yield chunk({ delta: 'done', finishReason: 'stop' });
            })()
        );

        const result = await runV1ResponsesExecution(baseParams({
            // Omitted so body.input is parsed, which is the code under test.
            messages: undefined,
            body: {
                model: 'gpt-4o',
                stream: true,
                input: [
                    { type: 'message', role: 'user', content: 'read it' },
                    {
                        type: 'function_call',
                        id: 'fc_1',
                        call_id: 'call_a',
                        name: 'read_file',
                        arguments: '{"path":"a.ts"}',
                    },
                    { type: 'function_call_output', call_id: 'call_a', output: 'file body' },
                ],
            },
        }));
        if (!result.ok) throw new Error('expected ok');
        const reader = result.response.body!.getReader();
        while (!(await reader.read()).done) {
            // Drain.
        }

        const sent = mockStreamGatewayChat.mock.calls[0]?.[0] as {
            request: { messages: Array<{ role: string; content: string; tool_calls?: unknown[] }> };
        };
        const assistant = sent.request.messages.find((message) => message.role === 'assistant');
        expect(assistant?.tool_calls).toEqual([
            {
                id: 'call_a',
                type: 'function',
                function: { name: 'read_file', arguments: '{"path":"a.ts"}' },
            },
        ]);
    });
});

describe('/v1/responses streaming a thinking trace', () => {
    /** Every event's name, in the order the client receives them. */
    function eventNames(body: string): string[] {
        return [...body.matchAll(/event: ([\w.]+)\n/g)].map((match) => match[1] as string);
    }

    function eventData(body: string, name: string): Array<Record<string, unknown>> {
        const pattern = new RegExp(`event: ${name.replace(/\./g, '\\.')}\\ndata: (\\{[^\\n]*\\})`, 'g');
        return [...body.matchAll(pattern)].map((match) => JSON.parse(match[1] as string));
    }

    it('streams the trace as it is produced, closed before the reply, and not repeated at the end', async () => {
        mockStreamGatewayChat.mockImplementation(() => (async function* () {
            yield chunk({ reasoning: 'Look at ' });
            yield chunk({ reasoning: 'the repo.' });
            yield chunk({ delta: "I'll look at the repo." });
            yield chunk({ delta: '', finishReason: 'stop' });
        })());
        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const body = await new Response(result.response.body).text();
        const names = eventNames(body);

        // Opened, streamed in pieces, closed, and only then the reply.
        const added = names.indexOf('response.output_item.added');
        const firstDelta = names.indexOf('response.reasoning_text.delta');
        const closed = names.indexOf('response.output_item.done');
        const firstText = names.indexOf('response.output_text.delta');
        expect(added).toBeGreaterThanOrEqual(0);
        expect(firstDelta).toBeGreaterThan(added);
        expect(closed).toBeGreaterThan(firstDelta);
        if (firstText >= 0) expect(firstText).toBeGreaterThan(closed);

        const deltas = eventData(body, 'response.reasoning_text.delta');
        expect(deltas.map((delta) => delta.delta).join('')).toBe('Look at the repo.');
        // What the runtime needs on each delta: which item, and which content part.
        expect(deltas.every((delta) => delta.content_index === 0 && typeof delta.item_id === 'string')).toBe(true);

        const [opened] = eventData(body, 'response.output_item.added') as Array<{ item: { id: string; type: string } }>;
        const [done] = eventData(body, 'response.output_item.done') as Array<{
            item: { id: string; content: unknown; summary: unknown };
        }>;
        expect(opened?.item.type).toBe('reasoning');
        expect(done?.item.id).toBe(opened?.item.id);
        expect(done?.item.content).toEqual([{ type: 'reasoning_text', text: 'Look at the repo.' }]);

        // The final response does not carry the trace a second time.
        const [final] = eventData(body, 'response.done') as Array<{ response: { output: Array<{ type: string }> } }>;
        expect(final?.response.output.some((item) => item.type === 'reasoning')).toBe(false);
    });

    it('sends the trace while the model is still going, not when it finishes', async () => {
        let release: (() => void) | null = null;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        mockStreamGatewayChat.mockImplementation(() => (async function* () {
            yield chunk({ reasoning: 'Thinking about it.' });
            await gate;
            yield chunk({ delta: 'Done.', finishReason: 'stop' });
        })());
        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const reader = result.response.body!.getReader();
        let seen = '';
        while (!seen.includes('response.reasoning_text.delta')) {
            const { done, value } = await reader.read();
            if (done) break;
            seen += new TextDecoder().decode(value);
        }
        // The provider has not finished, and the thinking is already on its way.
        expect(seen).toContain('Thinking about it.');
        expect(seen).not.toContain('response.done');
        release?.();
        await reader.cancel();
    });
});
