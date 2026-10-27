import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({
    default: class {
        chat = { completions: { create } };
        withOptions() { return this; }
    },
}));
vi.mock('../pricing', () => ({
    getPricingFromDB: async () => ({ inputPer1KTokens: 0, outputPer1KTokens: 0, cencoriMarkupPercentage: 0 }),
}));
import { OpenAICompatibleProvider, openAICompatibleReasoningEffort, upstreamModel } from '../openai-compatible';

beforeEach(() => { create.mockReset(); });

describe('Maximo reasoning and stream cancellation', () => {
    it.each(['low', 'medium', 'high', 'xhigh', 'max'] as const)('preserves %s effort', effort => {
        expect(openAICompatibleReasoningEffort('maximo', {
            model: 'maximo-atlas-1.3', reasoningEffort: effort,
        })).toBe(effort);
    });

    it('does not send effort to unrecognised models or providers', () => {
        expect(openAICompatibleReasoningEffort('maximo', {
            model: 'unknown-model', reasoningEffort: 'low',
        })).toBeUndefined();
        expect(openAICompatibleReasoningEffort('groq', {
            model: 'llama-3.3-70b-versatile', reasoningEffort: 'low',
        })).toBeUndefined();
    });

    it('forwards low effort on nonstreamed Maximo requests', async () => {
        create.mockResolvedValue({
            model: 'maximo-atlas-1.3',
            choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });
        await new OpenAICompatibleProvider('maximo', 'test-key').chat({
            model: 'maximo-atlas-1.3', messages: [{ role: 'user', content: 'hi' }], reasoningEffort: 'low',
        });
        expect(create.mock.calls[0][0].reasoning_effort).toBe('low');
    });

    it('passes the effort and abort signal into the streaming SDK call', async () => {
        const controller = new AbortController();
        create.mockImplementation(async (_params, options) => {
            const signal = options.signal as AbortSignal;
            return (async function* () {
                yield { choices: [{ delta: { content: 'first' } }] };
                await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
            })();
        });
        const stream = new OpenAICompatibleProvider('maximo', 'test-key').stream({
            model: 'maximo-atlas-1.3', messages: [{ role: 'user', content: 'hi' }],
            reasoningEffort: 'low', signal: controller.signal,
        });
        expect((await stream.next()).value).toMatchObject({ delta: 'first' });
        expect(create.mock.calls[0][0].reasoning_effort).toBe('low');
        // The adapter combines caller cancellation with its attempt timeout,
        // so the SDK sees a scoped signal — which must still follow a caller
        // abort (asserted below), not the identical object.
        const passedSignal = create.mock.calls[0][1].signal as AbortSignal;
        expect(passedSignal).toBeInstanceOf(AbortSignal);
        expect(passedSignal.aborted).toBe(false);
        const pending = stream.next();
        await Promise.resolve();
        controller.abort(new Error('cancelled'));
        await expect(pending).rejects.toThrow('cancelled');
    });
});

describe('B.AI DeepSeek V4 thinking', () => {
    it('passes none (thinking off) only when asked, and leaves the default alone', () => {
        expect(openAICompatibleReasoningEffort('bai', { model: 'deepseek-v4.1-flash', reasoningEffort: 'none' })).toBe('none');
        expect(openAICompatibleReasoningEffort('bai', { model: 'deepseek-v4-flash', reasoningEffort: 'low' })).toBe('low');
        expect(openAICompatibleReasoningEffort('bai', { model: 'deepseek-v4.1-flash' })).toBeUndefined();
        expect(openAICompatibleReasoningEffort('bai', { model: 'glm-5.3-flash', reasoningEffort: 'none' })).toBeUndefined();
    });
});

describe('DeepSeek direct model names', () => {
    it("sends DeepSeek's own name for Flash and leaves everything else as it is", () => {
        expect(upstreamModel('deepseek', 'deepseek-v4.1-flash')).toBe('deepseek-flash');
        expect(upstreamModel('deepseek', 'deepseek-v4-flash')).toBe('deepseek-flash');
        expect(upstreamModel('deepseek', 'deepseek-v4-pro')).toBe('deepseek-v4-pro');
        expect(upstreamModel('bai', 'deepseek-v4.1-flash')).toBe('deepseek-v4.1-flash');
        expect(openAICompatibleReasoningEffort('deepseek', { model: 'deepseek-v4.1-flash', reasoningEffort: 'none' })).toBe('none');
    });
});
