import { describe, it, expect, vi, afterEach } from 'vitest';
import { AINamespace } from './index';

function createNamespace() {
    return new AINamespace({
        apiKey: 'csk_test_123',
        baseUrl: 'https://cencori.com',
        headers: {},
    });
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('AINamespace chat response parsing', () => {
    it('parses OpenAI-style chat responses', async () => {
        const ns = createNamespace();

        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            id: 'chatcmpl-openai-1',
            model: 'gpt-4o',
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: 'Hello from OpenAI shape',
                    tool_calls: [{
                        id: 'call_1',
                        type: 'function',
                        function: {
                            name: 'get_weather',
                            arguments: '{"city":"Tokyo"}',
                        },
                    }],
                },
                finish_reason: 'tool_calls',
            }],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            },
        }), { status: 200 }));

        const result = await ns.chat({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'hello' }],
        });

        expect(result.id).toBe('chatcmpl-openai-1');
        expect(result.model).toBe('gpt-4o');
        expect(result.content).toBe('Hello from OpenAI shape');
        expect(result.finishReason).toBe('tool_calls');
        expect(result.toolCalls?.[0]?.function.name).toBe('get_weather');
        expect(result.usage).toEqual({
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
        });
    });

    it('parses legacy cencori chat responses', async () => {
        const ns = createNamespace();

        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            content: 'Hello from legacy shape',
            model: 'claude-sonnet-4',
            finish_reason: 'stop',
            tool_calls: [{
                id: 'call_legacy',
                type: 'function',
                function: {
                    name: 'lookup_user',
                    arguments: '{"id":"u_1"}',
                },
            }],
            usage: {
                prompt_tokens: 21,
                completion_tokens: 9,
                total_tokens: 30,
            },
        }), { status: 200 }));

        const result = await ns.chat({
            model: 'claude-sonnet-4',
            messages: [{ role: 'user', content: 'hello' }],
        });

        expect(result.id.startsWith('chatcmpl-')).toBe(true);
        expect(result.model).toBe('claude-sonnet-4');
        expect(result.content).toBe('Hello from legacy shape');
        expect(result.finishReason).toBe('stop');
        expect(result.toolCalls?.[0]?.function.name).toBe('lookup_user');
        expect(result.usage).toEqual({
            promptTokens: 21,
            completionTokens: 9,
            totalTokens: 30,
        });
    });

    it('parses legacy camelCase toolCalls responses', async () => {
        const ns = createNamespace();

        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            content: 'Structured',
            model: 'gpt-4o',
            finish_reason: 'tool_calls',
            toolCalls: [{
                id: 'call_camel',
                type: 'function',
                function: {
                    name: 'generate_object',
                    arguments: '{"ok":true}',
                },
            }],
            usage: {
                prompt_tokens: 5,
                completion_tokens: 3,
                total_tokens: 8,
            },
        }), { status: 200 }));

        const result = await ns.chat({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'hello' }],
        });

        expect(result.finishReason).toBe('tool_calls');
        expect(result.toolCalls?.[0]?.id).toBe('call_camel');
    });
});

describe('AINamespace generateObject', () => {
    it('reads structured output from top-level tool_calls', async () => {
        const ns = createNamespace();

        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            id: 'chatcmpl-structured-1',
            model: 'gpt-4o',
            tool_calls: [{
                id: 'call_structured',
                type: 'function',
                function: {
                    name: 'generate_object',
                    arguments: '{"name":"Ada","age":30}',
                },
            }],
            usage: {
                prompt_tokens: 12,
                completion_tokens: 7,
                total_tokens: 19,
            },
        }), { status: 200 }));

        const result = await ns.generateObject<{ name: string; age: number }>({
            model: 'gpt-4o',
            prompt: 'Generate a user profile',
            schema: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
                required: ['name', 'age'],
            },
        });

        expect(result.object).toEqual({ name: 'Ada', age: 30 });
        expect(result.usage.totalTokens).toBe(19);
    });

    it('reads structured output from top-level toolCalls', async () => {
        const ns = createNamespace();

        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            id: 'chatcmpl-structured-2',
            model: 'gpt-4o',
            toolCalls: [{
                id: 'call_structured_camel',
                type: 'function',
                function: {
                    name: 'generate_object',
                    arguments: '{"name":"Lin","age":28}',
                },
            }],
            usage: {
                prompt_tokens: 11,
                completion_tokens: 6,
                total_tokens: 17,
            },
        }), { status: 200 }));

        const result = await ns.generateObject<{ name: string; age: number }>({
            model: 'gpt-4o',
            prompt: 'Generate a user profile',
            schema: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
                required: ['name', 'age'],
            },
        });

        expect(result.object).toEqual({ name: 'Lin', age: 28 });
        expect(result.usage.totalTokens).toBe(17);
    });
});
