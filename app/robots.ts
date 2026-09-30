import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: [
                    '/',
                    '/og',           // Allow social crawlers to fetch OG images
                    '/api/og',       // Backward compatibility for existing shared links
                ],
                disallow: [
                    '/dashboard/',      // Legacy dashboard path (now redirects to console)
                    '/account/',        // Authenticated app (console-only)
                    '/onboarding/',     // Authenticated app (console-only)
                    '/api/',            // Don't index API routes
                    '/sso-callback/',   // Auth callbacks
                ],
            },
        ],
        sitemap: 'https://cencori.com/sitemap.xml',
    };
}
