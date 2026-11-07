/**
 * @vitest-environment node
 *
 * The request Tensor's agent sends right after it edits a file, replayed through every stage the
 * gateway runs before a provider sees it. The custom-tool translation shipped with unit tests of
 * the translator alone; the route's input validator rejected `custom_tool_call` with a 400, which
 * Tensor's proxy reported as a retryable 503, and every task that edited a file died after the
 * edit. This test runs the real captured input through the validator first.
 */
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/tensor-input-after-apply-patch.json';
import { validateResponsesInput } from '@/lib/gateway/responses-input';
import { translateResponsesInputItems, validateToolPairing, type TranslatableInputItem } from '@/lib/gateway/responses-translate';
import { toAnthropicMessages, toOpenAIMessages } from '@/lib/providers/utils';

const input = fixture.input as unknown as TranslatableInputItem[];

describe('the request after an apply_patch call', () => {
    it('passes input validation', () => {
        expect(validateResponsesInput(input)).toBeNull();
    });

    it('translates with nothing dropped and the call paired with its output', () => {
        const { messages, dropped } = translateResponsesInputItems(input);
        expect(dropped).toEqual([]);
        expect(validateToolPairing(messages)).toEqual([]);
        const call = messages.find((m) => m.tool_calls?.length);
        expect(call?.tool_calls?.[0].function.name).toBe('apply_patch');
        expect(JSON.parse(call!.tool_calls![0].function.arguments).input).toContain('*** Begin Patch');
    });

    it('reaches Anthropic as a tool_use answered by its tool_result', () => {
        const { messages } = translateResponsesInputItems(input);
        const anthropic = toAnthropicMessages(messages as never) as unknown as {
            messages: Array<{ role: string; content: Array<{ type: string; id?: string; tool_use_id?: string }> | string }>;
        };
        const blocks = anthropic.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : []));
        const use = blocks.find((b) => b.type === 'tool_use');
        expect(blocks.find((b) => b.type === 'tool_result')?.tool_use_id).toBe(use?.id);
    });

    it('reaches OpenAI-compatible providers as a tool call answered by a tool message', () => {
        const { messages } = translateResponsesInputItems(input);
        const chat = toOpenAIMessages(messages as never) as unknown as Array<{ role: string; tool_calls?: Array<{ id: string }>; tool_call_id?: string }>;
        const callId = chat.find((m) => m.tool_calls?.length)?.tool_calls?.[0].id;
        expect(chat.find((m) => m.role === 'tool')?.tool_call_id).toBe(callId);
    });

    it('rejects a custom tool call without its text', () => {
        expect(validateResponsesInput([{ type: 'custom_tool_call', call_id: 'c', name: 'apply_patch' }])).toMatch(/input/);
    });
});
