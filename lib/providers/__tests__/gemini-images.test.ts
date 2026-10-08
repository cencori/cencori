import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveMessageImages } from '../gemini';
import { InvalidRequestError } from '../errors';
import { safeProviderFetch } from '@/lib/security/outbound-url';

vi.mock('@/lib/security/outbound-url', async (importOriginal) => {
    const mod = await importOriginal<typeof import('@/lib/security/outbound-url')>();
    return {
        ...mod,
        safeProviderFetch: vi.fn(),
        // Return exactly the bytes the mocked fetch served.
        readResponseBuffer: async (response: Response) => Buffer.from(await response.arrayBuffer()),
    };
});

const mockedFetch = vi.mocked(safeProviderFetch);

function pngResponse(): Response {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' } });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockResolvedValue(pngResponse());
});

describe('resolveMessageImages', () => {
    it('rewrites https: images to data: URLs', async () => {
        const out = await resolveMessageImages([
            { role: 'user', content: 'look', images: [{ url: 'https://example.com/a.png' }] },
        ]);

        expect(mockedFetch).toHaveBeenCalledOnce();
        expect(out[0].images?.[0].url.startsWith('data:image/png;base64,')).toBe(true);
        expect(out[0].content).toBe('look');
    });

    it('leaves data: URLs and imageless turns untouched', async () => {
        const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
        const messages = [
            { role: 'user' as const, content: 'a', images: [{ url: dataUrl }] },
            { role: 'user' as const, content: 'b' },
        ];
        const out = await resolveMessageImages(messages);

        expect(mockedFetch).not.toHaveBeenCalled();
        expect(out[0].images?.[0].url).toBe(dataUrl);
        expect(out[1]).toBe(messages[1]);
    });

    it('rejects failed downloads and foreign content types', async () => {
        mockedFetch.mockResolvedValue(new Response('nope', { status: 404 }));
        await expect(
            resolveMessageImages([{ role: 'user', content: 'x', images: [{ url: 'https://example.com/missing.png' }] }]),
        ).rejects.toThrow(InvalidRequestError);

        mockedFetch.mockResolvedValue(
            new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
        );
        await expect(
            resolveMessageImages([{ role: 'user', content: 'x', images: [{ url: 'https://example.com/page' }] }]),
        ).rejects.toThrow(/not supported by google/);
    });

    it('rejects non-http(s) URLs without fetching', async () => {
        await expect(
            resolveMessageImages([{ role: 'user', content: 'x', images: [{ url: 'ftp://example.com/a.png' }] }]),
        ).rejects.toThrow(InvalidRequestError);
        expect(mockedFetch).not.toHaveBeenCalled();
    });
});
