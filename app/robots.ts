import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: [
                    '/',
                    '/api/og',       // Allow social crawlers to fetch OG images
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
