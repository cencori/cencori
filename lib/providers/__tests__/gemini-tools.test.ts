import { describe, expect, it } from 'vitest';
import { geminiCallId, geminiCallSignature, geminiToolCalls, toGeminiSchema, toGeminiToolConfig, toGeminiTools } from '../gemini-tools';
import { toGeminiMessages } from '../utils';

describe('Gemini function calling', () => {
    it('reduces JSON Schema to what Gemini accepts', () => {
        const schema = toGeminiSchema({
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            additionalProperties: false,
            properties: {
                query: { type: 'string', description: 'Search text', minLength: 1 },
                limit: { type: ['integer', 'null'], default: 10 },
                state: { anyOf: [{ type: 'string', enum: ['open', 'closed'] }, { type: 'null' }] },
                labels: { type: 'array', items: { type: 'string' } },
                filters: { type: 'object', additionalProperties: true },
                when: { type: 'string', format: 'uri' },
            },
            required: ['query', 'missing'],
        });
        expect(schema).toEqual({
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search text' },
                limit: { type: 'integer', nullable: true },
                state: { type: 'string', enum: ['open', 'closed'], format: 'enum', nullable: true },
                labels: { type: 'array', items: { type: 'string' } },
                filters: { type: 'string', description: '(a JSON object)' },
                when: { type: 'string' },
            },
            required: ['query'],
        });
    });

    it('declares tools, leaving out parameters for tools without inputs', () => {
        const tools = toGeminiTools([
            { type: 'function', function: { name: 'search', description: 'Search', parameters: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] } } },
            { type: 'function', function: { name: 'list_teams', description: 'List teams', parameters: { type: 'object', properties: {} } } },
        ] as never);
        expect(tools).toEqual([{ functionDeclarations: [
            { name: 'search', description: 'Search', parameters: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] } },
            { name: 'list_teams', description: 'List teams' },
        ] }]);
        expect(toGeminiTools([])).toBeUndefined();
        expect(toGeminiToolConfig('required', true)).toEqual({ functionCallingConfig: { mode: 'ANY' } });
        expect(toGeminiToolConfig({ type: 'function', function: { name: 'search' } }, true)).toEqual({ functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['search'] } });
        expect(toGeminiToolConfig('auto', true)).toBeUndefined();
    });

    it('carries thought signatures through the call id', () => {
        const [call] = geminiToolCalls([{ text: 'Looking it up' }, { functionCall: { name: 'search', args: { q: 'x' } }, thoughtSignature: 'c2lnMTIz' }]);
        expect(call.function).toEqual({ name: 'search', arguments: '{"q":"x"}' });
        expect(geminiCallSignature(call.id)).toBe('c2lnMTIz');
        expect(geminiCallSignature(geminiCallId())).toBeUndefined();
        expect(geminiCallSignature('call_openai_123')).toBeUndefined();
    });

    it('rebuilds tool turns: calls with signatures, then one function turn of results', () => {
        const id1 = geminiCallId('sigA');
        const id2 = geminiCallId();
        const { history, prompt } = toGeminiMessages([
            { role: 'system', content: 'Be brief.' },
            { role: 'user', content: 'Find bugs' },
            { role: 'assistant', content: '', tool_calls: [
                { id: id1, type: 'function', function: { name: 'search', arguments: '{"q":"bug"}' } },
                { id: id2, type: 'function', function: { name: 'count', arguments: '{}' } },
            ] },
            { role: 'tool', content: '2 issues', toolCallId: id1 },
            { role: 'tool', content: '7', toolCallId: id2 },
        ]);
        expect(history.map((m) => m.role)).toEqual(['user', 'user', 'model']);
        expect(history[2].parts).toEqual([
            { functionCall: { name: 'search', args: { q: 'bug' } }, thoughtSignature: 'sigA' },
            { functionCall: { name: 'count', args: {} } },
        ]);
        expect(prompt).toEqual([
            { functionResponse: { name: 'search', response: { content: '2 issues' } } },
            { functionResponse: { name: 'count', response: { content: '7' } } },
        ]);
    });

    it('leaves conversations without tools exactly as before', () => {
        expect(toGeminiMessages([{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }, { role: 'user', content: 'Bye' }])).toEqual({
            history: [{ role: 'user', parts: [{ text: 'Hi' }] }, { role: 'model', parts: [{ text: 'Hello' }] }],
            prompt: 'Bye',
        });
    });
});
