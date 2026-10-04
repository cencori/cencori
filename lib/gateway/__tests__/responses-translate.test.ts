/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
    extractReasoningText,
    translateResponsesInputItems,
    translateResponsesOutputItems,
    validateToolPairing,
} from '../responses-translate';
import { toOpenAIMessages } from '@/lib/providers/utils';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('extractReasoningText', () => {
    it('reads an OpenAI-style summary part list', () => {
        expect(extractReasoningText({
            summary: [{ type: 'summary_text', text: 'first' }, { type: 'summary_text', text: 'second' }],
        })).toBe('first\nsecond');
    });

    it('reads plain content and text spellings', () => {
        expect(extractReasoningText({ content: 'trace' })).toBe('trace');
        expect(extractReasoningText({ text: 'trace' })).toBe('trace');
        expect(extractReasoningText({ summary: 'trace' })).toBe('trace');
    });

    it('returns null when nothing readable is present', () => {
        expect(extractReasoningText({ summary: [] })).toBeNull();
        expect(extractReasoningText({})).toBeNull();
    });
});

describe('translateResponsesInputItems', () => {
    it('turns a reasoning item into an assistant turn carrying the trace', () => {
        const { messages, dropped } = translateResponsesInputItems([
            { type: 'message', role: 'user', content: 'think hard' },
            { type: 'reasoning', summary: [{ type: 'summary_text', text: 'the trace' }] },
        ]);
        expect(dropped).toEqual([]);
        expect(messages).toEqual([
            { role: 'user', content: 'think hard' },
            { role: 'assistant', content: '', reasoningContent: 'the trace' },
        ]);
        // And the provider wire format echoes it back verbatim.
        expect(toOpenAIMessages(messages)).toEqual([
            { role: 'user', content: 'think hard' },
            { role: 'assistant', content: '', reasoning_content: 'the trace' },
        ]);
    });

    it('keeps every function_call paired with its output, names and arguments intact', () => {
        const { messages, dropped } = translateResponsesInputItems([
            { type: 'message', role: 'user', content: 'run it' },
            { type: 'function_call', id: 'fc-1', call_id: 'call-1', name: 'shell', arguments: '{"cmd":"ls"}' },
            { type: 'function_call_output', call_id: 'call-1', output: 'ok' },
        ]);
        expect(dropped).toEqual([]);
        expect(validateToolPairing(messages)).toEqual([]);
        expect(toOpenAIMessages(messages)).toEqual([
            { role: 'user', content: 'run it' },
            {
                role: 'assistant',
                content: '',
                tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'shell', arguments: '{"cmd":"ls"}' } }],
            },
            { role: 'tool', content: 'ok', tool_call_id: 'call-1' },
        ]);
    });

    it('merges a parallel fan-out into one assistant turn carrying every call', () => {
        const { messages, dropped } = translateResponsesInputItems([
            { type: 'function_call', id: 'fc-1', call_id: 'call-1', name: 'read_a', arguments: '{}' },
            { type: 'function_call', id: 'fc-2', call_id: 'call-2', name: 'read_b', arguments: '{}' },
            { type: 'function_call', id: 'fc-3', call_id: 'call-3', name: 'read_c', arguments: '{}' },
            { type: 'function_call_output', call_id: 'call-1', output: 'a' },
            { type: 'function_call_output', call_id: 'call-2', output: 'b' },
            { type: 'function_call_output', call_id: 'call-3', output: 'c' },
        ]);
        expect(dropped).toEqual([]);
        expect(validateToolPairing(messages)).toEqual([]);
        expect(messages.map((m) => m.role)).toEqual(['assistant', 'tool', 'tool', 'tool']);
        expect(messages[0].tool_calls?.map((c) => c.id)).toEqual(['call-1', 'call-2', 'call-3']);
        // The canonical wire shape: one turn, every call, tools adjacent.
        expect(toOpenAIMessages(messages)[0]).toEqual({
            role: 'assistant',
            content: '',
            tool_calls: [
                { id: 'call-1', type: 'function', function: { name: 'read_a', arguments: '{}' } },
                { id: 'call-2', type: 'function', function: { name: 'read_b', arguments: '{}' } },
                { id: 'call-3', type: 'function', function: { name: 'read_c', arguments: '{}' } },
            ],
        });
    });

    it('keeps sequential call/output pairs on separate adjacent turns', () => {
        const { messages, dropped } = translateResponsesInputItems([
            { type: 'function_call', id: 'fc-1', call_id: 'call-1', name: 'a', arguments: '{}' },
            { type: 'function_call_output', call_id: 'call-1', output: 'a-out' },
            { type: 'function_call', id: 'fc-2', call_id: 'call-2', name: 'b', arguments: '{}' },
            { type: 'function_call_output', call_id: 'call-2', output: 'b-out' },
        ]);
        expect(dropped).toEqual([]);
        expect(validateToolPairing(messages)).toEqual([]);
        expect(messages.map((m) => m.role)).toEqual(['assistant', 'tool', 'assistant', 'tool']);
    });

    it('merges a reasoning trace into the call run it accompanies', () => {
        const { messages, dropped } = translateResponsesInputItems([
            { type: 'reasoning', summary: [{ type: 'summary_text', text: 'trace' }] },
            { type: 'function_call', id: 'fc-1', call_id: 'call-1', name: 'shell', arguments: '{}' },
            { type: 'function_call_output', call_id: 'call-1', output: 'ok' },
        ]);
        expect(dropped).toEqual([]);
        expect(messages).toEqual([
            {
                role: 'assistant',
                content: '',
                reasoningContent: 'trace',
                tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'shell', arguments: '{}' } }],
            },
            { role: 'tool', content: 'ok', toolCallId: 'call-1' },
        ]);
        expect(toOpenAIMessages(messages)[0]).toMatchObject({ reasoning_content: 'trace' });
    });

    it('never splits a tool block with its own image-caption follow-up', () => {
        const { messages, dropped } = translateResponsesInputItems([
            { type: 'function_call', id: 'fc-1', call_id: 'call-1', name: 'view_image', arguments: '{}' },
            {
                type: 'function_call_output', call_id: 'call-1',
                output: [{ type: 'input_image', image_url: PNG }],
            },
            { type: 'function_call', id: 'fc-2', call_id: 'call-2', name: 'shell', arguments: '{}' },
            { type: 'function_call_output', call_id: 'call-2', output: 'ok' },
        ]);
        expect(dropped).toEqual([]);
        expect(validateToolPairing(messages)).toEqual([]);
        const roles = messages.map((m) => m.role);
        // The caption flushes at the next non-output item, between the two
        // blocks — never inside one. Each assistant→tool adjacency is intact.
        expect(roles).toEqual(['assistant', 'tool', 'user', 'assistant', 'tool']);
        expect(messages[2]).toMatchObject({ role: 'user', content: expect.any(String) });
    });

    it('reports unsupported items instead of dropping them silently', () => {
        const { messages, dropped } = translateResponsesInputItems([
            { type: 'message', role: 'user', content: 'hi' },
            { type: 'telepathy', content: 'hi' },
        ]);
        expect(messages).toEqual([{ role: 'user', content: 'hi' }]);
        expect(dropped).toEqual(["unsupported input item type 'telepathy'"]);
    });

    it('reports an unreadable reasoning item instead of dropping it silently', () => {
        const { messages, dropped } = translateResponsesInputItems([
            { type: 'reasoning', summary: [] },
        ]);
        expect(messages).toEqual([]);
        expect(dropped).toEqual(['reasoning item with no readable summary or text']);
    });
});

describe('translateResponsesOutputItems', () => {
    it('replays stored calls with their full tool_calls, not a bare id', () => {
        const { messages, dropped } = translateResponsesOutputItems([
            { type: 'function_call', id: 'fc-1', call_id: 'call-1', name: 'shell', arguments: '{"cmd":"ls"}' },
        ]);
        expect(dropped).toEqual([]);
        expect(messages).toEqual([
            {
                role: 'assistant',
                content: '',
                tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'shell', arguments: '{"cmd":"ls"}' } }],
            },
        ]);
    });

    it('replays stored reasoning traces', () => {
        const { messages, dropped } = translateResponsesOutputItems([
            { type: 'reasoning', summary: [{ type: 'summary_text', text: 'stored trace' }] },
        ]);
        expect(dropped).toEqual([]);
        expect(messages).toEqual([
            { role: 'assistant', content: '', reasoningContent: 'stored trace' },
        ]);
    });

    it('replays a reasoning trace kept only in the content field', () => {
        const { messages, dropped } = translateResponsesOutputItems([
            { type: 'reasoning', content: 'content-held trace' },
        ]);
        expect(dropped).toEqual([]);
        expect(messages).toEqual([
            { role: 'assistant', content: '', reasoningContent: 'content-held trace' },
        ]);
    });
});

describe('validateToolPairing', () => {
    const call = (id: string) => ({
        role: 'assistant' as const,
        content: '',
        tool_calls: [{ id, type: 'function' as const, function: { name: 'shell', arguments: '{}' } }],
    });
    const result = (id: string) => ({ role: 'tool' as const, content: 'ok', toolCallId: id });

    it('accepts a fully paired history', () => {
        expect(validateToolPairing([
            { role: 'user', content: 'run it' },
            call('call-1'),
            result('call-1'),
        ])).toEqual([]);
    });

    it('flags a declared call with no answering tool message', () => {
        expect(validateToolPairing([
            call('call-1'),
            { role: 'user', content: 'never mind' },
        ])).toEqual([{ kind: 'dangling_call', id: 'call-1', index: 0 }]);
    });

    it('flags a tool message answering a call the history never declares', () => {
        expect(validateToolPairing([
            { role: 'user', content: 'run it' },
            result('call-9'),
        ])).toEqual([{ kind: 'orphan_result', id: 'call-9', index: 1 }]);
    });

    it('warns on a user turn splitting a tool block without blocking on it', () => {
        const violations = validateToolPairing([
            {
                role: 'assistant',
                content: '',
                tool_calls: [
                    { id: 'call-1', type: 'function', function: { name: 'a', arguments: '{}' } },
                    { id: 'call-2', type: 'function', function: { name: 'b', arguments: '{}' } },
                ],
            },
            result('call-1'),
            { role: 'user', content: 'caption' },
            result('call-2'),
        ]);
        expect(violations).toEqual([{ kind: 'split_block', id: 'call-2', index: 2 }]);
        expect(violations.some((v) => v.kind !== 'split_block')).toBe(false);
    });
});
