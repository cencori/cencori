import { describe, expect, it } from 'vitest';
import { DEVELOPER_PAGES, mainSiteSubdomainRedirect, marketingSubdomainFor, routeMarketingSubdomain } from '@/lib/marketing/subdomains';
import { generateStaticParams } from '@/app/(marketing)/developers/[slug]/page';

describe('front-door subdomains', () => {
    it('knows every developers page', () => {
        const slugs = generateStaticParams().map((params) => params.slug);
        expect([...DEVELOPER_PAGES].filter((page) => page && page !== 'blog').sort()).toEqual(slugs.sort());
    });

    it('serves each subdomain from its root and sends the rest to cencori.com', () => {
        expect(marketingSubdomainFor('business.cencori.com')).toBe('business');
        expect(marketingSubdomainFor('developers.localhost')).toBe('developers');
        expect(marketingSubdomainFor('cencori.com')).toBeNull();
        expect(routeMarketingSubdomain('business', '/')).toEqual({ kind: 'rewrite', pathname: '/business' });
        expect(routeMarketingSubdomain('developers', '/apis')).toEqual({ kind: 'rewrite', pathname: '/developers/apis' });
        expect(routeMarketingSubdomain('developers', '/developers/apis')).toEqual({ kind: 'redirect', host: 'self', pathname: '/apis' });
        expect(routeMarketingSubdomain('developers', '/docs/quick-start')).toEqual({ kind: 'redirect', host: 'main', pathname: '/docs/quick-start' });
        expect(routeMarketingSubdomain('business', '/pricing')).toEqual({ kind: 'redirect', host: 'main', pathname: '/pricing' });
    });

    it('moves the old cencori.com paths, on the production host only', () => {
        expect(mainSiteSubdomainRedirect('cencori.com', '/developers/apis')).toEqual({ host: 'developers.cencori.com', pathname: '/apis' });
        expect(mainSiteSubdomainRedirect('www.cencori.com', '/business')).toEqual({ host: 'business.cencori.com', pathname: '/' });
        expect(mainSiteSubdomainRedirect('cencori.com', '/developersx')).toBeNull();
        expect(mainSiteSubdomainRedirect('localhost', '/developers')).toBeNull();
    });
});
