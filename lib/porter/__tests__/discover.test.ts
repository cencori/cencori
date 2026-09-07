import { describe, expect, it, vi } from 'vitest';

const fetchWebResource = vi.fn();
vi.mock('@/lib/web/fetch', () => ({ fetchWebResource: (...a: unknown[]) => fetchWebResource(...a) }));

import { discoverPorterLinks } from '@/lib/porter/knowledge';

const resource = (body: string, finalUrl = 'https://acme.com/') => ({
    url: finalUrl, finalUrl, statusCode: 200, mimeType: 'text/html', body,
    bytes: body.length, contentHash: 'h', retrievedAt: new Date().toISOString(),
    headers: { cacheControl: null, etag: null, lastModified: null },
});

const sitemap = (...urls: string[]) =>
    `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
        .map((u) => `<url><loc>${u}</loc></url>`)
        .join('')}</urlset>`;

describe('discoverPorterLinks', () => {
    it('prefers the sitemap and groups by section', async () => {
        fetchWebResource.mockImplementation(async (url: string) =>
            url.endsWith('/sitemap.xml')
                ? resource(sitemap(
                    'https://acme.com/docs/a', 'https://acme.com/docs/b',
                    'https://acme.com/pricing', 'https://acme.com/'))
                : resource('<html></html>')
        );

        const found = await discoverPorterLinks('acme.com');
        expect(found.source).toBe('sitemap');
        expect(found.total).toBe(4);
        // biggest section first, because that is the one worth a decision
        expect(found.groups[0]).toMatchObject({ path: '/docs' });
        expect(found.groups[0].urls).toHaveLength(2);
    });

    it('falls back to homepage links when there is no sitemap', async () => {
        fetchWebResource.mockImplementation(async (url: string) => {
            if (url.endsWith('/sitemap.xml')) throw new Error('404');
            return resource('<html><body><a href="/help">Help</a><a href="/about">About</a></body></html>');
        });

        const found = await discoverPorterLinks('acme.com');
        expect(found.source).toBe('homepage');
        expect(found.groups.map((g) => g.path).sort()).toEqual(['/about', '/help']);
    });

    it('drops other sites, assets and duplicates', async () => {
        fetchWebResource.mockImplementation(async (url: string) =>
            url.endsWith('/sitemap.xml')
                ? resource(sitemap(
                    'https://acme.com/pricing',
                    'https://acme.com/pricing/',        // the same page
                    'https://www.acme.com/pricing',     // still the same site
                    'https://acme.com/logo.png',        // not a page
                    'https://elsewhere.com/pricing'))   // not this site
                : resource('<html></html>')
        );

        const found = await discoverPorterLinks('acme.com');
        expect(found.total).toBe(1);
        expect(found.groups[0].urls).toEqual(['https://acme.com/pricing']);
    });

    it('returns nothing rather than failing when a site cannot be reached', async () => {
        fetchWebResource.mockImplementation(async () => {
            throw new Error('robots disallowed');
        });

        const found = await discoverPorterLinks('acme.com');
        expect(found).toMatchObject({ total: 0, groups: [] });
    });
});
