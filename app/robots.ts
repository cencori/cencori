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
                    '/dashboard/',      // Don't index authenticated app
                    '/api/',            // Don't index API routes
                    '/sso-callback/',   // Auth callbacks
                ],
            },
        ],
        sitemap: 'https://cencori.com/sitemap.xml',
    };
}
