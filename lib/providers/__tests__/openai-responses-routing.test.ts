import { describe, expect, it, vi } from 'vitest';

const chatCalls: Array<Record<string, unknown>> = [];
const responsesCalls: Array<Record<string, unknown>> = [];

const toolCallResponse = {
    model: 'gpt-6-luna',
    status: 'completed',
    incomplete_details: null,
    output: [
        { type: 'reasoning', id: 'rs_1', summary: [] },
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Checking.' }] },
        { type: 'function_call', call_id: 'call_1', name: 'get_weather', arguments: '{"city":"Lagos"}' },
    ],
    usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 40 }, output_tokens: 20, total_tokens: 120 },
};

vi.mock('openai', () => ({
    default: class {
        chat = {
            completions: {
                create: async (params: Record<string, unknown>) => {
                    chatCalls.push(params);
                    return {
                        model: params.model,
                        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
                        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                    };
                },
            },
        };
        responses = {
            create: async (params: Record<string, unknown>) => {
                responsesCalls.push(params);
                if (!params.stream) return toolCallResponse;
                return (async function* () {
                    yield { type: 'response.output_text.delta', delta: 'Check' };
                    yield { type: 'response.output_text.delta', delta: 'ing.' };
                    yield { type: 'response.completed', response: toolCallResponse };
                })();
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

import { OpenAIProvider } from '../openai';
import { needsOpenAIResponsesApi, toResponsesInput } from '../openai-responses';

const tools = [{
    type: 'function' as const,
    function: { name: 'get_weather', description: 'Weather', parameters: { type: 'object', properties: {} } },
}];

function reset() {
    chatCalls.length = 0;
    responsesCalls.length = 0;
}

describe('GPT-6 function tools go through the Responses API', () => {
    it('routes only GPT-6 + tools with reasoning on', () => {
        expect(needsOpenAIResponsesApi({ model: 'gpt-6-luna', tools })).toBe(true);
        expect(needsOpenAIResponsesApi({ model: 'gpt-6.1-sol', tools, reasoningEffort: 'high' })).toBe(true);
        expect(needsOpenAIResponsesApi({ model: 'gpt-6-luna', tools, reasoningEffort: 'none' })).toBe(false);
        expect(needsOpenAIResponsesApi({ model: 'gpt-6-luna' })).toBe(false);
        expect(needsOpenAIResponsesApi({ model: 'gpt-5.6-luna', tools })).toBe(false);
    });

    it('maps a tool-call round trip into Responses input items', () => {
        expect(toResponsesInput([
            { role: 'system', content: 'Be brief.' },
            { role: 'user', content: 'Weather?' },
            { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{}' } }] },
            { role: 'tool', content: 'Sunny', toolCallId: 'call_1' },
        ])).toEqual([
            { role: 'system', content: 'Be brief.' },
            { role: 'user', content: 'Weather?' },
            { type: 'function_call', call_id: 'call_1', name: 'get_weather', arguments: '{}' },
            { type: 'function_call_output', call_id: 'call_1', output: 'Sunny' },
        ]);
    });

    it('returns tool calls, text and cache-aware usage from a unary call', async () => {
        reset();
        const provider = new OpenAIProvider('sk-test');
        const result = await provider.chat({
            messages: [{ role: 'user', content: 'Weather in Lagos?' }],
            model: 'gpt-6-luna',
            tools,
            reasoningEffort: 'high',
        });

        expect(chatCalls).toHaveLength(0);
        expect(responsesCalls[0]).toMatchObject({
            model: 'gpt-6-luna',
            reasoning: { effort: 'high' },
            store: false,
            tools: [{ type: 'function', name: 'get_weather', strict: false }],
        });
        expect(result.content).toBe('Checking.');
        expect(result.finishReason).toBe('tool_calls');
        expect(result.toolCalls).toEqual([
            { id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Lagos"}' } },
        ]);
        expect(result.usage).toMatchObject({ promptTokens: 100, completionTokens: 20, uncachedPromptTokens: 60, cacheReadTokens: 40 });
    });

    it('streams text, then tool calls + usage on one terminal chunk', async () => {
        reset();
        const provider = new OpenAIProvider('sk-test');
        const chunks = [];
        for await (const chunk of provider.stream({ messages: [{ role: 'user', content: 'hi' }], model: 'gpt-6-sol', tools })) {
            chunks.push(chunk);
        }

        expect(chunks.map((c) => c.delta).join('')).toBe('Checking.');
        const last = chunks[chunks.length - 1];
        expect(last.finishReason).toBe('tool_calls');
        expect(last.toolCalls?.[0].function.name).toBe('get_weather');
        expect(last.usage).toMatchObject({ promptTokens: 60, completionTokens: 20, cacheReadTokens: 40 });
    });

    it('keeps Chat Completions when reasoning is explicitly off', async () => {
        reset();
        const provider = new OpenAIProvider('sk-test');
        await provider.chat({ messages: [{ role: 'user', content: 'hi' }], model: 'gpt-6-luna', tools, reasoningEffort: 'none' });
        expect(responsesCalls).toHaveLength(0);
        expect(chatCalls[0].reasoning_effort).toBe('none');
    });
});
