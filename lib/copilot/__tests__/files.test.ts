import { describe, expect, it } from 'vitest';
import { COPILOT_FILE_MAX_CHARS, COPILOT_FILES_PER_MESSAGE, COPILOT_IMAGES_PER_MESSAGE, looksLikeText, sanitizeFiles, sanitizeImages, withFiles } from '@/lib/copilot/files';

describe('copilot files', () => {
    it('keeps well-formed files, caps count and size, drops the rest', () => {
        const big = 'x'.repeat(COPILOT_FILE_MAX_CHARS + 10);
        const files = sanitizeFiles([
            { name: 'a.log', content: big },
            { name: 'b.csv', content: 'id,name' },
            { name: 1, content: 'bad' },
            null,
            ...Array.from({ length: 10 }, (_, i) => ({ name: `f${i}.txt`, content: 'ok' })),
        ]);
        expect(files).toHaveLength(COPILOT_FILES_PER_MESSAGE);
        expect(files[0].content).toHaveLength(COPILOT_FILE_MAX_CHARS);
        expect(sanitizeFiles('nope')).toEqual([]);
    });

    it('folds files and omissions into the prompt text', () => {
        const text = withFiles('Why is this failing?', [{ name: 'err.log', content: 'boom' }], ['huge.json']);
        expect(text).toContain('Why is this failing?');
        expect(text).toContain('<file name="err.log">\nboom\n</file>');
        expect(text).toContain('"huge.json" was left out');
    });

    it('tells text from binary', () => {
        expect(looksLikeText('hello')).toBe(true);
        expect(looksLikeText('PNG\u0000\u0001')).toBe(false);
    });

    it('takes only well-formed images that still need describing', () => {
        const ok = { name: 'shot.png', kind: 'image', content: '', dataUrl: 'data:image/jpeg;base64,AAAA' };
        const images = sanitizeImages([
            ok,
            { ...ok, dataUrl: 'data:text/html;base64,AAAA' },
            { ...ok, dataUrl: 'https://evil.example/x.png' },
            { ...ok, content: 'already described' },
            ...Array.from({ length: 5 }, () => ok),
        ]);
        expect(images).toHaveLength(COPILOT_IMAGES_PER_MESSAGE);
        expect(images[0]).toEqual({ name: 'shot.png', dataUrl: 'data:image/jpeg;base64,AAAA' });
    });

    it('keeps described images as text and drops undescribed ones from files', () => {
        const files = sanitizeFiles([
            { name: 'a.png', kind: 'image', content: 'A dashboard showing 5xx errors', dataUrl: 'data:image/png;base64,AA' },
            { name: 'b.png', kind: 'image', content: '', dataUrl: 'data:image/png;base64,AA' },
        ]);
        expect(files).toEqual([{ name: 'a.png', content: 'A dashboard showing 5xx errors', kind: 'image' }]);
        expect(withFiles('', files)).toContain('<image name="a.png">');
    });
});
