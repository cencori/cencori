import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/documents/extract', () => ({
    extractDocument: vi.fn(async (_ctx: unknown, input: { filename?: string }) => ({ text: `PDF TEXT of ${input.filename}`, pageCount: 1 })),
}));

import { inlineFileParts, textOnlyModel, VISION_FALLBACK_MODEL } from '../file-inputs';

const ctx = {} as never;
const b64 = (s: string) => Buffer.from(s).toString('base64');

describe('inlineFileParts', () => {
    it('leaves plain text input alone', async () => {
        expect(await inlineFileParts('hello', ctx)).toEqual({ input: 'hello', hasImage: false, files: [] });
    });

    it('reads PDFs and text files into text, keeps images, and flags the image', async () => {
        const out = await inlineFileParts([{ role: 'user', content: [
            { type: 'input_text', text: 'Summarise these' },
            { type: 'input_file', filename: 'q3.pdf', file_data: `data:application/pdf;base64,${b64('%PDF-fake')}` },
            { type: 'input_file', filename: 'notes.md', file_data: `data:text/markdown;base64,${b64('# Notes\nShip it')}` },
            { type: 'input_image', image_url: 'https://example.com/a.png' },
        ] }], ctx);
        expect((out.input as Array<{ type: string }>)[0].type).toBe('message');
        const content = (out.input as Array<{ content: Array<Record<string, string>> }>)[0].content;
        expect(content[1]).toEqual({ type: 'input_text', text: '[Attached file: q3.pdf]\nPDF TEXT of q3.pdf' });
        expect(content[2]).toEqual({ type: 'input_text', text: '[Attached file: notes.md]\n# Notes\nShip it' });
        expect(content[3]).toEqual({ type: 'input_image', image_url: 'https://example.com/a.png' });
        expect(out.hasImage).toBe(true);
        expect(out.files).toEqual(['q3.pdf', 'notes.md']);
    });

    it('turns an image sent as a file into an image', async () => {
        const out = await inlineFileParts([{ role: 'user', content: [{ type: 'input_file', filename: 'shot.png', file_data: `data:image/png;base64,${b64('png')}` }] }], ctx);
        expect((out.input as Array<{ content: Array<Record<string, string>> }>)[0].content[0]).toMatchObject({ type: 'input_image' });
        expect(out.hasImage).toBe(true);
    });

    it('says why a file was not read, and caps files per message', async () => {
        const many = Array.from({ length: 6 }, (_, i) => ({ type: 'input_file', filename: `f${i}.txt`, file_data: `data:text/plain;base64,${b64('x')}` }));
        const out = await inlineFileParts([{ role: 'user', content: [
            { type: 'input_file', filename: 'a.exe', file_data: `data:application/x-msdownload;base64,${b64('MZ')}` },
            ...many,
        ] }], ctx);
        const texts = (out.input as Array<{ content: Array<{ text: string }> }>)[0].content.map((p) => p.text);
        expect(texts[0]).toContain("isn't supported");
        expect(texts[6]).toContain('at most 5 files');
    });
});

describe('vision fallback', () => {
    it('swaps text-only models only', () => {
        expect(textOnlyModel('gpt-oss-120b')).toBe(true);
        expect(textOnlyModel('openai/gpt-oss-120b')).toBe(true);
        expect(textOnlyModel('claude-sonnet-4-5')).toBe(false);
        expect(textOnlyModel('gpt-4o')).toBe(false);
        expect(VISION_FALLBACK_MODEL).toBe('claude-haiku-4-5');
    });
});
