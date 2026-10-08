import { describe, expect, it } from 'vitest';
import {
    toAnthropicMessages,
    toGeminiMessages,
    toOpenAIMessages,
    type AnthropicContentBlock,
} from '../utils';
import { InvalidRequestError } from '../errors';

// 1px PNG, valid base64 payload.
const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('toAnthropicMessages — images', () => {
    it('sends data: URLs as base64 image blocks after the text', () => {
        const { messages } = toAnthropicMessages([
            { role: 'user', content: 'what is this?', images: [{ url: PNG_DATA_URL }] },
        ]);

        expect(messages).toEqual([
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'what is this?' },
                    {
                        type: 'image',
                        source: { type: 'base64', media_type: 'image/png', data: expect.any(String) },
                    },
                ],
            },
        ]);
    });

    it('sends https: URLs as URL blocks Anthropic fetches itself', () => {
        const { messages } = toAnthropicMessages([
            { role: 'user', content: '', images: [{ url: 'https://example.com/cat.png' }] },
        ]);

        // No empty text block (Anthropic rejects those) — images alone.
        expect(messages).toEqual([
            {
                role: 'user',
                content: [
                    { type: 'image', source: { type: 'url', url: 'https://example.com/cat.png' } },
                ],
            },
        ]);
    });

    it('keeps text-only turns as plain strings', () => {
        const { messages } = toAnthropicMessages([{ role: 'user', content: 'hi' }]);
        expect(messages).toEqual([{ role: 'user', content: 'hi' }]);
    });

    it('carries images on assistant tool turns alongside the tool calls', () => {
        const { messages } = toAnthropicMessages([
            {
                role: 'assistant',
                content: 'checking',
                images: [{ url: PNG_DATA_URL }],
                tool_calls: [{ id: '1', type: 'function', function: { name: 'f', arguments: '{}' } }],
            },
        ]);

        const content = messages[0].content as AnthropicContentBlock[];
        expect(content.map(b => b.type)).toEqual(['text', 'image', 'tool_use']);
    });

    it('still drops images on tool_result turns, which cannot carry them', () => {
        const { messages } = toAnthropicMessages([
            { role: 'user', content: 'go' },
            { role: 'tool', content: 'result', toolCallId: '1', images: [{ url: PNG_DATA_URL }] },
        ]);

        expect(messages[1]).toEqual({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: '1', content: 'result' }],
        });
    });

    it('rejects non-https/non-data URLs instead of dropping them', () => {
        expect(() =>
            toAnthropicMessages([{ role: 'user', content: 'x', images: [{ url: 'ftp://example.com/a.png' }] }]),
        ).toThrow(InvalidRequestError);
    });

    it('rejects non-base64 data URLs and foreign mime types', () => {
        expect(() =>
            toAnthropicMessages([{ role: 'user', content: 'x', images: [{ url: 'data:image/png,iVBORw0KGgo=' }] }]),
        ).toThrow(/base64-encoded/);
        // HEIC is a Google-only format.
        expect(() =>
            toAnthropicMessages([{ role: 'user', content: 'x', images: [{ url: 'data:image/heic;base64,AAAA' }] }]),
        ).toThrow(/not supported by anthropic/);
    });

    it('rejects images over the 5MB Anthropic cap', () => {
        // ~6MB of base64 decodes to ~4.5MB... so go bigger: 8M chars ≈ 6MB.
        const big = `data:image/png;base64,${'A'.repeat(8_000_000)}`;
        expect(() =>
            toAnthropicMessages([{ role: 'user', content: 'x', images: [{ url: big }] }]),
        ).toThrow(/maximum of 5MB/);
    });

    it('attributes errors to the calling provider', () => {
        expect(() =>
            toAnthropicMessages(
                [{ role: 'user', content: 'x', images: [{ url: 'ftp://example.com/a.png' }] }],
                { provider: 'custom-acme' },
            ),
        ).toThrow(/\[custom-acme\]/);
    });
});

describe('toGeminiMessages — images', () => {
    it('keeps the legacy shape for text-only turns', () => {
        const { history, prompt } = toGeminiMessages([
            { role: 'user', content: 'a' },
            { role: 'assistant', content: 'b' },
            { role: 'user', content: 'c' },
        ]);

        expect(history).toEqual([
            { role: 'user', parts: [{ text: 'a' }] },
            { role: 'model', parts: [{ text: 'b' }] },
        ]);
        expect(prompt).toBe('c');
    });

    it('inlines data: URLs as inlineData parts', () => {
        const { history, prompt } = toGeminiMessages([
            { role: 'user', content: 'look', images: [{ url: PNG_DATA_URL }] },
        ]);

        expect(history).toEqual([]);
        expect(prompt).toEqual([
            { text: 'look' },
            { inlineData: { mimeType: 'image/png', data: expect.any(String) } },
        ]);
    });

    it('inlines history images too, and allows Google-only formats', () => {
        const heic = 'data:image/heic;base64,AAAA';
        const { history } = toGeminiMessages([
            { role: 'user', content: '', images: [{ url: heic }] },
            { role: 'user', content: 'follow-up' },
        ]);

        expect(history).toEqual([
            { role: 'user', parts: [{ inlineData: { mimeType: 'image/heic', data: 'AAAA' } }] },
        ]);
    });

    it('refuses https: URLs — the adapter must resolve them to bytes first', () => {
        expect(() =>
            toGeminiMessages([{ role: 'user', content: 'x', images: [{ url: 'https://example.com/a.png' }] }]),
        ).toThrow(/must be data: URLs/);
    });
});

describe('toOpenAIMessages — images (locked behavior)', () => {
    it('passes data: and https: URLs through untouched', () => {
        const converted = toOpenAIMessages([
            { role: 'user', content: 'x', images: [{ url: PNG_DATA_URL, detail: 'high' }, { url: 'https://example.com/a.png' }] },
        ]);

        expect(converted[0].content).toEqual([
            { type: 'text', text: 'x' },
            { type: 'image_url', image_url: { url: PNG_DATA_URL, detail: 'high' } },
            { type: 'image_url', image_url: { url: 'https://example.com/a.png' } },
        ]);
    });
});
