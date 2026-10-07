/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
    extractReasoningText,
    translateResponsesInputItems,
    translateResponsesOutputItems,
    validateToolPairing,
    findTracelessCallTurns,
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
        // The Responses shape a client stores and echoes back: content parts.
        expect(
            extractReasoningText({ content: [{ type: 'reasoning_text', text: 'part one' }, { type: 'text', text: 'part two' }] }),
        ).toBe('part one\npart two');
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
        // And the provider wire format echoes it back verbatim, to a provider that takes it.
        expect(toOpenAIMessages(messages, { echoReasoning: true })).toEqual([
            { role: 'user', content: 'think hard' },
            { role: 'assistant', content: '', reasoning_content: 'the trace' },
        ]);
        // Anyone else gets the history without the vendor field, as before echoing existed.
        expect(toOpenAIMessages(messages)).toEqual([
            { role: 'user', content: 'think hard' },
            { role: 'assistant', content: '' },
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
        expect(toOpenAIMessages(messages, { echoReasoning: true })[0]).toMatchObject({
            reasoning_content: 'trace',
        });
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

describe('findTracelessCallTurns', () => {
    const tracedCall = (id: string) => ({
        role: 'assistant' as const,
        content: '',
        reasoningContent: 'trace',
        tool_calls: [{ id, type: 'function' as const, function: { name: 'shell', arguments: '{}' } }],
    });
    const untracedCall = (id: string) => ({
        role: 'assistant' as const,
        content: '',
        tool_calls: [{ id, type: 'function' as const, function: { name: 'shell', arguments: '{}' } }],
    });

    it('returns empty when the thread never thought', () => {
        expect(findTracelessCallTurns([
            { role: 'user', content: 'run it' },
            untracedCall('call-1'),
            { role: 'tool' as const, content: 'ok', toolCallId: 'call-1' },
        ])).toEqual([]);
    });

    it('returns empty when every call turn carries its trace', () => {
        expect(findTracelessCallTurns([
            tracedCall('call-1'),
            { role: 'tool' as const, content: 'ok', toolCallId: 'call-1' },
        ])).toEqual([]);
    });

    it('names the call ids on traceless turns in a thinking thread', () => {
        expect(findTracelessCallTurns([
            tracedCall('call-1'),
            { role: 'tool' as const, content: 'ok', toolCallId: 'call-1' },
            untracedCall('call-2'),
            { role: 'tool' as const, content: 'ok', toolCallId: 'call-2' },
        ])).toEqual(['call-2']);
    });
});

describe('a thinking model reply with text and a tool call', () => {
    /**
     * What Tensor's runtime echoes after DeepSeek thinks, says what it will do, and calls a tool:
     * three items for one response. Split into separate turns, the trace landed on a text-only
     * turn and the turn with `tool_calls` went without it, and DeepSeek 400'd the follow-up.
     */
    it('is one assistant turn carrying the trace, the text and the call together', () => {
        const { messages, dropped } = translateResponsesInputItems([
            { type: 'message', role: 'user', content: 'what is this project?' },
            {
                type: 'reasoning',
                summary: [{ type: 'summary_text', text: 'read the repo first' }],
                content: [{ type: 'reasoning_text', text: 'read the repo first' }],
            },
            { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: "I'll look at the repo." }] },
            { type: 'function_call', id: 'fc-1', call_id: 'call-1', name: 'exec_command', arguments: '{"cmd":"ls"}' },
            { type: 'function_call_output', call_id: 'call-1', output: 'README.md' },
            {
                type: 'reasoning',
                summary: [{ type: 'summary_text', text: 'now read the readme' }],
            },
            { type: 'function_call', id: 'fc-2', call_id: 'call-2', name: 'exec_command', arguments: '{"cmd":"cat README.md"}' },
            { type: 'function_call_output', call_id: 'call-2', output: '# Tensor' },
        ] as never);
        expect(dropped).toEqual([]);
        expect(validateToolPairing(messages)).toEqual([]);

        const wire = toOpenAIMessages(messages, { echoReasoning: true });
        expect(wire).toEqual([
            { role: 'user', content: 'what is this project?' },
            {
                role: 'assistant',
                content: "I'll look at the repo.",
                reasoning_content: 'read the repo first',
                tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'exec_command', arguments: '{"cmd":"ls"}' } }],
            },
            { role: 'tool', content: 'README.md', tool_call_id: 'call-1' },
            // The next response keeps its own trace on its own call.
            {
                role: 'assistant',
                content: '',
                reasoning_content: 'now read the readme',
                tool_calls: [
                    { id: 'call-2', type: 'function', function: { name: 'exec_command', arguments: '{"cmd":"cat README.md"}' } },
                ],
            },
            { role: 'tool', content: '# Tensor', tool_call_id: 'call-2' },
        ]);
        // Every assistant turn that calls a tool carries its thinking: what DeepSeek checks.
        for (const turn of wire.filter((message) => message.tool_calls)) {
            expect(turn.reasoning_content).toBeTruthy();
        }
    });

    it('keeps two replies in a row as two turns', () => {
        const { messages } = translateResponsesInputItems([
            { type: 'message', role: 'user', content: 'hi' },
            { type: 'message', role: 'assistant', content: 'Hello.' },
            { type: 'message', role: 'assistant', content: 'Anything else?' },
        ] as never);
        expect(messages).toEqual([
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'Hello.' },
            { role: 'assistant', content: 'Anything else?' },
        ]);
    });
});

