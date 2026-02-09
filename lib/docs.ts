import 'server-only';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { compileMDX } from 'next-mdx-remote/rsc';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

const DOCS_DIR = path.join(process.cwd(), 'content', 'docs');

const CUSTOM_SHIKI_THEME = {
    name: 'cencori-custom',
    type: 'dark',
    colors: {
        'editor.background': 'transparent',
        'editor.foreground': '#e5e7eb',
    },
    tokenColors: [
        { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#6f6f71ff' } }, // grey
        { scope: ['string', 'string.quoted', 'string.template'], settings: { foreground: '#22c55e' } }, // green
        { scope: ['keyword', 'storage.type', 'storage.modifier'], settings: { foreground: '#ec4899' } }, // pink
        { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#60a5fa' } }, // blue
        { scope: ['entity.name.type', 'support.type', 'entity.name.class'], settings: { foreground: '#a78bfa' } }, // purple
        { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: '#60a5fa' } }, // blue
        { scope: ['variable', 'identifier'], settings: { foreground: '#ff9500ff' } }, // blue tint
        { scope: ['punctuation', 'meta.brace', 'meta.delimiter'], settings: { foreground: '#9ca3af' } }, // grey
    ],
};

export interface DocFrontmatter {
    title: string;
    description: string;
    section: string;
    order: number;
    lastUpdated?: string;
}

export interface Doc extends DocFrontmatter {
    slug: string;
    content: string;
    lastUpdated?: string;
}

export interface NavItem {
    title: string;
    href: string;
    order: number;
}

export interface NavSection {
    title: string;
    items: NavItem[];
}

export interface Heading {
    id: string;
    text: string;
    level: number;
}

/**
 * Recursively get all MDX files from a directory
 */
function getMdxFiles(dir: string, basePath = ''): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(basePath, entry.name);

        if (entry.isDirectory()) {
            files.push(...getMdxFiles(fullPath, relativePath));
        } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
            files.push(relativePath);
        }
    }

    return files;
}

/**
 * Convert file path to URL slug
 */
function filePathToSlug(filePath: string): string {
    return filePath
        .replace(/\.(mdx|md)$/, '')
        .replace(/\/_index$/, '')
        .replace(/\/index$/, '')
        .replace(/^\//, '');
}

/**
 * Get all documentation pages
 */
export function getAllDocs(): Doc[] {
    const files = getMdxFiles(DOCS_DIR);

    return files.map((file) => {
        const filePath = path.join(DOCS_DIR, file);
        const fileContents = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = matter(fileContents);
        const stats = fs.statSync(filePath);

        const frontmatter = data as DocFrontmatter;
        const slug = filePathToSlug(file);

        return {
            ...frontmatter,
            slug,
            content,
            lastUpdated: frontmatter.lastUpdated ?? stats.mtime.toISOString(),
        };
    });
}

/**
 * Get a single doc by slug
 */
export function getDocBySlug(slug: string): Doc | null {
    const docs = getAllDocs();
    return docs.find((doc) => doc.slug === slug) || null;
}

/**
 * Build navigation structure from docs frontmatter
 */
export function getDocsNavigation(): NavSection[] {
    const docs = getAllDocs();

    // Group by section
    const sections = new Map<string, NavItem[]>();

    for (const doc of docs) {
        const section = doc.section || 'Other';
        if (!sections.has(section)) {
            sections.set(section, []);
        }
        sections.get(section)!.push({
            title: doc.title,
            href: `/docs/${doc.slug}`,
            order: doc.order || 999,
        });
    }

    // Sort items within each section
    const result: NavSection[] = [];
    const sectionOrder = [
        'Getting Started',
        'AI',
        'AI Endpoints',
        'AI Memory',
        'Core Concepts',
        'Security',
        'Guides',
        'API Reference',
    ];

    for (const sectionTitle of sectionOrder) {
        const items = sections.get(sectionTitle);
        if (items) {
            result.push({
                title: sectionTitle,
                items: items.sort((a, b) => a.order - b.order),
            });
            sections.delete(sectionTitle);
        }
    }

    // Add any remaining sections
    for (const [sectionTitle, items] of sections) {
        result.push({
            title: sectionTitle,
            items: items.sort((a, b) => a.order - b.order),
        });
    }

    return result;
}

/**
 * Extract headings from MDX content for TOC
 */
export function extractHeadings(content: string): Heading[] {
    const headingRegex = /^(#{2,3})\s+(.+)$/gm;
    const headings: Heading[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-');

        headings.push({ id, text, level });
    }

    return headings;
}

// Import docs-specific MDX components
import { DocsMDXComponents } from '@/components/docs/DocsMDXComponents';

/**
 * Parse and render MDX content
 */
export async function parseMDX(content: string) {
    const { content: mdxContent } = await compileMDX({
        source: content,
        options: {
            parseFrontmatter: false,
            mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [
                    rehypeSlug,
                    [
                        rehypePrettyCode,
                        {
                            theme: CUSTOM_SHIKI_THEME,
                        },
                    ],
                ],
            },
        },
        components: DocsMDXComponents,
    });

    return mdxContent;
}

/**
 * Get previous and next docs for navigation
 */
export function getDocNavigation(currentSlug: string): { prev: Doc | null; next: Doc | null } {
    const docs = getAllDocs().sort((a, b) => {
        // Sort by section then by order
        if (a.section !== b.section) {
            const sectionOrder = [
                'Getting Started',
                'AI',
                'AI Endpoints',
                'AI Memory',
                'Core Concepts',
                'Security',
                'Guides',
                'API Reference',
            ];
            return sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section);
        }
        return (a.order || 999) - (b.order || 999);
    });

    const currentIndex = docs.findIndex((doc) => doc.slug === currentSlug);

    return {
        prev: currentIndex > 0 ? docs[currentIndex - 1] : null,
        next: currentIndex < docs.length - 1 ? docs[currentIndex + 1] : null,
    };
}
