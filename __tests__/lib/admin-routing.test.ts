import { describe, expect, it } from 'vitest';
import {
    adminHref,
    adminInternalPath,
    adminOrigin,
    adminPublicPath,
    isAdminHostname,
} from '@/lib/admin/routing';

describe('admin.cencori.com routing', () => {
    it('recognises the admin host', () => {
        expect(isAdminHostname('admin.cencori.com')).toBe(true);
        expect(isAdminHostname('admin.localhost:3000')).toBe(true);
        expect(isAdminHostname('cencori.com')).toBe(false);
        expect(isAdminHostname('console.cencori.com')).toBe(false);
    });

    it('serves the panel from the root and passes the API and sign-in through', () => {
        expect(adminInternalPath('/')).toBe('/internal');
        expect(adminInternalPath('/revenue')).toBe('/internal/revenue');
        expect(adminInternalPath('/emails/history')).toBe('/internal/emails/history');
        expect(adminInternalPath('/api/internal/metrics/revenue')).toBeNull();
        expect(adminInternalPath('/auth/callback')).toBeNull();
        expect(adminInternalPath('/team-invite')).toBeNull();
    });

    it('maps /internal paths to clean ones', () => {
        expect(adminPublicPath('/internal')).toBe('/');
        expect(adminPublicPath('/internal/analytics')).toBe('/analytics');
    });

    it('sends /internal on cencori hosts to the admin host, and nowhere else', () => {
        expect(adminOrigin('cencori.com')).toBe('https://admin.cencori.com');
        expect(adminOrigin('console.cencori.com')).toBe('https://admin.cencori.com');
        expect(adminOrigin('localhost:3000')).toBe('http://admin.localhost:3000');
        expect(adminOrigin('cencori.brimble.app')).toBeNull();
    });

    it('builds links for whichever way the panel is served', () => {
        expect(adminHref('/revenue', '/analytics')).toBe('/analytics');
        expect(adminHref('/', '/')).toBe('/');
        expect(adminHref('/internal/revenue', '/analytics')).toBe('/internal/analytics');
        expect(adminHref('/internal', '/')).toBe('/internal');
    });
});
