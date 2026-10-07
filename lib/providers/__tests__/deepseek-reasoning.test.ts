/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedChatRequest } from '../base';

const { safeFetch } = vi.hoisted(() => ({ safeFetch: vi.fn() }));
vi.mock('@/lib/security/outbound-url', () => ({ safeProviderFetch: safeFetch }));
vi.mock('../pricing', () => ({
    getPricingFromDB: vi.fn().mockResolvedValue({
        inputPer1KTokens: 0.000435,
        outputPer1KTokens: 0.00087,
        cencoriMarkupPercentage: 0,
    }),
}));
import { OpenAICompatibleProvider } from '../openai-compatible';

const encoder = new TextEncoder();
const request: UnifiedChatRequest = {
    model: 'deepseek-v4-pro',
    messages: [{ role: 'user', content: 'Think step by step.' }],
};
const sseFrame = (delta: unknown, finishReason: string | null = null) => encoder.encode(`data: ${JSON.stringify({
    id: 'test', object: 'chat.completion.chunk', model: request.model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
})}\n\n`);

beforeEach(() => safeFetch.mockReset());

describe('DeepSeek thinking trace round-trip', () => {
    it('captures reasoning_content on a non-streaming completion', async () => {
        safeFetch.mockResolvedValue(new Response(JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            model: 'deepseek-v4-pro',
            choices: [{
                index: 0,
                message: { role: 'assistant', content: 'The answer.', reasoning_content: 'The trace.' },
                finish_reason: 'stop',
            }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }), { headers: { 'Content-Type': 'application/json' } }));
        const result = await new OpenAICompatibleProvider('deepseek', 'synthetic-key').chat(request);
        expect(result.content).toBe('The answer.');
        expect(result.reasoning).toBe('The trace.');
    });

    it('captures a fallback reasoning field when reasoning_content is absent', async () => {
        safeFetch.mockResolvedValue(new Response(JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            model: 'deepseek-v4-pro',
            choices: [{
                index: 0,
                message: { role: 'assistant', content: 'Hi.', reasoning: 'Fallback trace.' },
                finish_reason: 'stop',
            }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }), { headers: { 'Content-Type': 'application/json' } }));
        const result = await new OpenAICompatibleProvider('deepseek', 'synthetic-key').chat(request);
        expect(result.reasoning).toBe('Fallback trace.');
    });

    it('accumulates reasoning_content deltas across a stream', async () => {
        safeFetch.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(sseFrame({ reasoning_content: 'First, ' }));
                controller.enqueue(sseFrame({ reasoning_content: 'think.' }));
                controller.enqueue(sseFrame({ content: 'The answer.' }, 'stop'));
                controller.close();
            },
        }), { headers: { 'Content-Type': 'text/event-stream' } }));
        const chunks = [];
        for await (const chunk of new OpenAICompatibleProvider('deepseek', 'synthetic-key').stream(request)) {
            chunks.push(chunk);
        }
        expect(chunks.map((c) => c.reasoning ?? '').join('')).toBe('First, think.');
        expect(chunks.map((c) => c.delta).join('')).toBe('The answer.');
    });

    it('omits reasoning when the provider sends none', async () => {
        safeFetch.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(sseFrame({ content: 'Plain answer.' }, 'stop'));
                controller.close();
            },
        }), { headers: { 'Content-Type': 'text/event-stream' } }));
        const chunks = [];
        for await (const chunk of new OpenAICompatibleProvider('deepseek', 'synthetic-key').stream(request)) {
            chunks.push(chunk);
        }
        expect(chunks.every((c) => c.reasoning === undefined)).toBe(true);
    });
});

describe('which providers get the thinking trace back', () => {
    it('echoes it to the thinking providers that take it, and to no one else', async () => {
        const { echoesReasoning } = await import('@/lib/providers/openai-compatible');
        for (const provider of ['deepseek', 'moonshot', 'zai']) {
            expect(echoesReasoning(provider)).toBe(true);
        }
        // Strict APIs reject the unknown field, and a trace from one model must not reach another.
        for (const provider of ['mistral', 'groq', 'xai', 'qwen', 'maximo', 'together', 'cerebras']) {
            expect(echoesReasoning(provider)).toBe(false);
        }
    });
});
