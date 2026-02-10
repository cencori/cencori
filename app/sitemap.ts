import { MetadataRoute } from 'next';

import { getAllDocs } from '@/lib/docs';
import { getAllPosts } from '@/lib/blog';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://cencori.com';
    const currentDate = new Date().toISOString();

    // Core pages with high priority
    const corePages = [
        { url: baseUrl, priority: 1.0, changeFrequency: 'daily' as const },
        { url: `${baseUrl}/pricing`, priority: 0.9, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/docs`, priority: 0.9, changeFrequency: 'weekly' as const },
    ];

    // Product pages - these target specific keywords
    const productPages = [
        { url: `${baseUrl}/ai`, priority: 0.9, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/audit`, priority: 0.8, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/knight`, priority: 0.8, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/sandbox`, priority: 0.8, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/insights`, priority: 0.8, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/network`, priority: 0.8, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/edge`, priority: 0.8, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/product-enterprise`, priority: 0.8, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/product-developer-tools`, priority: 0.8, changeFrequency: 'weekly' as const },
    ];

    // Marketing/Company pages
    const companyPages = [
        { url: `${baseUrl}/about`, priority: 0.7, changeFrequency: 'monthly' as const },
        { url: `${baseUrl}/blog`, priority: 0.8, changeFrequency: 'daily' as const },
        { url: `${baseUrl}/careers`, priority: 0.6, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/changelog`, priority: 0.7, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/contact`, priority: 0.6, changeFrequency: 'monthly' as const },
        { url: `${baseUrl}/customers`, priority: 0.7, changeFrequency: 'monthly' as const },
        { url: `${baseUrl}/events`, priority: 0.5, changeFrequency: 'weekly' as const },
        { url: `${baseUrl}/partners`, priority: 0.6, changeFrequency: 'monthly' as const },
        { url: `${baseUrl}/shipped`, priority: 0.7, changeFrequency: 'weekly' as const },
    ];

    // Auth pages (lower priority, still indexed)
    const authPages = [
        { url: `${baseUrl}/login`, priority: 0.4, changeFrequency: 'monthly' as const },
        { url: `${baseUrl}/signup`, priority: 0.5, changeFrequency: 'monthly' as const },
    ];

    // Legal pages
    const legalPages = [
        { url: `${baseUrl}/privacy-policy`, priority: 0.3, changeFrequency: 'yearly' as const },
        { url: `${baseUrl}/terms`, priority: 0.3, changeFrequency: 'yearly' as const },
    ];

    // Dynamic Documentation Pages
    const allDocs = getAllDocs();
    const docPages = allDocs.map((doc) => ({
        url: `${baseUrl}/docs/${doc.slug}`,
        lastModified: doc.lastUpdated || currentDate,
        priority: 0.8,
        changeFrequency: 'weekly' as const,
    }));

    // Dynamic Blog Posts
    const allPosts = getAllPosts();
    const blogPages = allPosts.map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.date || currentDate,
        priority: 0.7,
        changeFrequency: 'monthly' as const,
    }));

    const allPages = [
        ...corePages.map(page => ({ ...page, lastModified: currentDate })),
        ...productPages.map(page => ({ ...page, lastModified: currentDate })),
        ...companyPages.map(page => ({ ...page, lastModified: currentDate })),
        ...authPages.map(page => ({ ...page, lastModified: currentDate })),
        ...legalPages.map(page => ({ ...page, lastModified: currentDate })),
        ...docPages,
        ...blogPages,
    ];

    return allPages;
}
