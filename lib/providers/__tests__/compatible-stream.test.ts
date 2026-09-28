/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedChatRequest } from '../base';

const { safeFetch } = vi.hoisted(() => ({ safeFetch: vi.fn() }));
vi.mock('@/lib/security/outbound-url', () => ({ safeProviderFetch: safeFetch }));
import { OpenAICompatibleProvider } from '../openai-compatible';
import { streamWithTimeout } from '@/lib/gateway/stream-timeout';

const request: UnifiedChatRequest = { model: 'maximo-atlas-1.3', messages: [{ role: 'user', content: 'Draft synthetic notes.' }] };
const encoder = new TextEncoder();
const frame = (delta: unknown, finishReason: string | null = null) => encoder.encode(`data: ${JSON.stringify({
    id: 'test', object: 'chat.completion.chunk', model: request.model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
})}\n\n`);

beforeEach(() => safeFetch.mockReset());
afterEach(() => vi.useRealTimers());

describe('compatible provider SSE transport', () => {
    it('settles a finished tool call without waiting for a missing DONE marker or EOF', async () => {
        const cancel = vi.fn();
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(frame({ tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name: 'write_draft', arguments: '{"text":' } }] }));
                controller.enqueue(frame({ tool_calls: [{ index: 0, function: { arguments: '"report"}' } }] }, 'tool_calls'));
                // Deliberately leave the connection open after the terminal choice.
            },
            cancel,
        });
        safeFetch.mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
        const provider = new OpenAICompatibleProvider('maximo', 'synthetic-key');
        const chunks = [];
        for await (const chunk of provider.stream({ ...request, onStreamActivity: vi.fn() })) chunks.push(chunk);
        expect(chunks.at(-1)?.toolCalls).toEqual([{ id: 'call-1', type: 'function', function: { name: 'write_draft', arguments: '{"text":"report"}' } }]);
        expect(chunks.at(-1)?.finishReason).toBe('tool_calls');
        await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
    });

    it('feeds comment-only SSE heartbeats into the gateway idle deadline', async () => {
        vi.useFakeTimers();
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        safeFetch.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
            start(value) { controller = value; },
        }), { headers: { 'Content-Type': 'text/event-stream' } }));
        const provider = new OpenAICompatibleProvider('maximo', 'synthetic-key');
        const stream = streamWithTimeout((signal, onStreamActivity) => provider.stream({ ...request, signal, onStreamActivity }), 'maximo', { timeoutMs: 50, maxPendingMs: 200 });
        const next = stream.next();
        await vi.advanceTimersByTimeAsync(0);
        for (let i = 0; i < 4; i++) {
            await vi.advanceTimersByTimeAsync(40);
            controller.enqueue(encoder.encode(': keepalive\n\n'));
            await vi.advanceTimersByTimeAsync(0);
        }
        controller.enqueue(frame({ content: 'Draft ready' }, 'stop'));
        expect((await next).value).toMatchObject({ delta: 'Draft ready', finishReason: 'stop' });
        expect((await stream.next()).done).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });
});
