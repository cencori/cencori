import { describe, expect, it, vi } from 'vitest';

const captured: Array<Record<string, unknown>> = [];

vi.mock('openai', () => ({
    default: class {
        chat = {
            completions: {
                create: async (params: Record<string, unknown>) => {
                    captured.push(params);
                    return {
                        model: params.model,
                        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
                        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                    };
                },
            },
        };
        constructor(_opts?: unknown) {
            void _opts;
        }
    },
}));

vi.mock('../pricing', () => ({
    getPricingFromDB: async () => ({ inputPer1KTokens: 0, outputPer1KTokens: 0, cencoriMarkupPercentage: 0 }),
}));

import { OpenAIProvider, openAIReasoningEffort } from '../openai';

describe('reasoning effort forwarding', () => {
    it('selects effort only for reasoning models', () => {
        expect(openAIReasoningEffort({ model: 'gpt-5-mini', reasoningEffort: 'high' })).toBe('high');
        expect(openAIReasoningEffort({ model: 'gpt-4o', reasoningEffort: 'high' })).toBeUndefined();
        expect(openAIReasoningEffort({ model: 'gpt-5-mini' })).toBeUndefined();
    });

    it('sends reasoning_effort to the provider on reasoning models', async () => {
        captured.length = 0;
        const provider = new OpenAIProvider('sk-test');
        await provider.chat({ messages: [{ role: 'user', content: 'hi' }], model: 'gpt-5-mini', reasoningEffort: 'low' });
        expect(captured[0].reasoning_effort).toBe('low');
    });

    it('omits reasoning_effort for non-reasoning models', async () => {
        captured.length = 0;
        const provider = new OpenAIProvider('sk-test');
        await provider.chat({ messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o', reasoningEffort: 'high' });
        expect(captured[0]).not.toHaveProperty('reasoning_effort');
    });
});
