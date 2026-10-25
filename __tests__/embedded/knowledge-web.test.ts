import { describe, expect, it } from 'vitest';
import { globToRegExp, newImportMeta, urlAllowed, WEB_IMPORT_MAX_PAGES } from '@/lib/embedded/knowledge-web';

describe('web knowledge patterns', () => {
    it('matches * across the whole URL', () => {
        expect(globToRegExp('*/blog/*').test('https://example.com/blog/post-1')).toBe(true);
        expect(globToRegExp('*/blog/*').test('https://example.com/docs/intro')).toBe(false);
    });

    it('treats everything but * literally', () => {
        expect(globToRegExp('https://example.com/a.b?x=1').test('https://example.com/a.b?x=1')).toBe(true);
        expect(globToRegExp('https://example.com/a.b').test('https://example.com/aXb')).toBe(false);
    });

    it('needs the pattern and none of the excludes', () => {
        expect(urlAllowed('https://a.com/docs/x', { pattern: '*/docs/*' })).toBe(true);
        expect(urlAllowed('https://a.com/blog/x', { pattern: '*/docs/*' })).toBe(false);
        expect(urlAllowed('https://a.com/docs/old/x', { pattern: '*/docs/*', exclude: ['*/old/*'] })).toBe(false);
        expect(urlAllowed('https://a.com/anything', { pattern: '  ', exclude: [''] })).toBe(true);
    });

    it('keeps import limits in range', () => {
        expect(newImportMeta('website', 'https://a.com', { maxPages: 99_999 }).max_pages).toBe(WEB_IMPORT_MAX_PAGES);
        expect(newImportMeta('website', 'https://a.com', { maxPages: 0 }).max_pages).toBe(1);
        expect(newImportMeta('sitemap', 'https://a.com', { exclude: [' */a/* ', ''] }).exclude).toEqual(['*/a/*']);
    });
});
