import { describe, expect, it, vi } from 'vitest';

const fetchWebResource = vi.fn();
vi.mock('@/lib/web/fetch', () => ({ fetchWebResource: (...args: unknown[]) => fetchWebResource(...args) }));

import { inferPorterFromSite } from '@/lib/porter/inference';

function resource(body: string, finalUrl = 'https://acme.com/') {
    return {
        url: finalUrl,
        finalUrl,
        statusCode: 200,
        mimeType: 'text/html',
        body,
        bytes: body.length,
        contentHash: 'hash',
        retrievedAt: new Date().toISOString(),
        headers: { cacheControl: null, etag: null, lastModified: null },
    };
}

const page = (head: string, body = '') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

// Every test installs its own implementation, which replaces the last one. There is deliberately
// no mockReset between them: resetting leaves the mock in a state where a rejecting implementation
// escapes the call it belongs to, which fails the test that proves failures are survivable.

describe('inferPorterFromSite', () => {
    it('prefers the name the business gives itself', async () => {
        fetchWebResource.mockImplementation(async () => resource(page(`
            <title>Cheap Widgets | Buy Online Today</title>
            <meta property="og:site_name" content="Acme Widgets">
        `)));

        const result = await inferPorterFromSite('https://acme.com', 'acme.com');
        expect(result.name).toBe('Acme Widgets');
    });

    it('falls back to the leading part of a short title', async () => {
        fetchWebResource.mockImplementation(async () => resource(page('<title>Acme Widgets — Home</title>')));

        const result = await inferPorterFromSite('https://acme.com', 'acme.com');
        expect(result.name).toBe('Acme Widgets');
    });

    it('ignores a title that is really a sentence', async () => {
        const long = 'We sell the finest widgets in the country and ship them everywhere, every day';
        fetchWebResource.mockImplementation(async () => resource(page(`<title>${long}</title>`)));

        const result = await inferPorterFromSite('https://acme.com', 'acme.com');
        expect(result.name).toBeUndefined();
    });

    it('takes a theme colour only when it is a usable hex value', async () => {
        fetchWebResource.mockImplementation(async () => resource(page('<meta name="theme-color" content="#0A7CFF">')));
        expect((await inferPorterFromSite('https://acme.com', 'acme.com')).brand.color).toBe('#0A7CFF');

        fetchWebResource.mockImplementation(async () => resource(page('<meta name="theme-color" content="rebeccapurple">')));
        expect((await inferPorterFromSite('https://acme.com', 'acme.com')).brand.color).toBeUndefined();
    });

    it('resolves a relative logo against the page it was found on', async () => {
        fetchWebResource.mockImplementation(async () => resource(page('<link rel="apple-touch-icon" href="/icons/logo.png">')));

        const result = await inferPorterFromSite('https://acme.com', 'acme.com');
        expect(result.brand.logo).toBe('https://acme.com/icons/logo.png');
    });

    it('reads a contact address out of the page', async () => {
        fetchWebResource.mockImplementation(async () => resource(page('', '<a href="mailto:Help@Acme.com">Contact</a>')));

        const result = await inferPorterFromSite('https://acme.com', 'acme.com');
        expect(result.contactEmail).toBe('help@acme.com');
    });

    it('will not let the body rename the business', async () => {
        fetchWebResource.mockImplementation(async () => resource(page(
            '<title>Acme Widgets</title>',
            '<meta property="og:site_name" content="Somebody Else">'
        )));

        const result = await inferPorterFromSite('https://acme.com', 'acme.com');
        expect(result.name).toBe('Acme Widgets');
    });

    it('returns a usable result when the site cannot be read', async () => {
        fetchWebResource.mockImplementation(async () => {
            throw new Error('robots disallowed');
        });

        const result = await inferPorterFromSite('https://acme.com', 'acme.com');
        expect(result.name).toBeUndefined();
        expect(result.brand).toEqual({});
        expect(result.systemPrompt).toBeUndefined();
    });

    it('always writes a prompt that forbids inventing details', async () => {
        fetchWebResource.mockImplementation(async () => resource(page(
            '<meta property="og:site_name" content="Acme"><meta name="description" content="We ship widgets.">'
        )));

        const result = await inferPorterFromSite('https://acme.com', 'acme.com');
        expect(result.systemPrompt).toContain('Acme');
        expect(result.systemPrompt).toContain('We ship widgets.');
        expect(result.systemPrompt).toMatch(/never invent/i);
    });
});
