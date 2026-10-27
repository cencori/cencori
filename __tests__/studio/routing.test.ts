import { describe, expect, it } from 'vitest';
import { isStudioHostname, isStudioPassThrough, studioInternalPath, studioOrigin } from '@/lib/studio/routing';

describe('Studio routing', () => {
    it('knows its hosts', () => {
        expect(isStudioHostname('studio.cencori.com')).toBe(true);
        expect(isStudioHostname('studio.localhost:3000')).toBe(true);
        expect(isStudioHostname('console.cencori.com')).toBe(false);
        expect(isStudioHostname('cencori.com')).toBe(false);
    });

    it('serves its pages from the root and passes sign-in and the API through', () => {
        expect(studioInternalPath('/')).toBe('/studio-app');
        expect(studioInternalPath('/inbox')).toBe('/studio-app/inbox');
        expect(studioInternalPath('/inbox/abc')).toBe('/studio-app/inbox/abc');
        expect(studioInternalPath('/studio-app/inbox')).toBe('/studio-app/inbox');
        for (const path of ['/login', '/signup', '/auth/callback', '/forgot', '/reset-password', '/api/agent']) {
            expect(isStudioPassThrough(path)).toBe(true);
            expect(studioInternalPath(path)).toBeNull();
        }
        expect(isStudioPassThrough('/logins')).toBe(false);
    });

    it('points at itself locally and in production', () => {
        expect(studioOrigin('studio.localhost:3000')).toBe('http://studio.localhost:3000');
        expect(studioOrigin('localhost:3000')).toBe('http://studio.localhost:3000');
        expect(studioOrigin('cencori.com')).toBe('https://studio.cencori.com');
    });
});
