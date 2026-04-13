import 'server-only';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { compileMDX } from 'next-mdx-remote/rsc';
import readingTime from 'reading-time';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const AUTHORS_DIR = path.join(process.cwd(), 'content', 'authors');

export interface Author {
    slug: string;
    name: string;
    avatar: string;
    role: string;
    bio?: string;
    twitter?: string;
    github?: string;
}

export type BlogCategory =
    | "engineering"
    | "product"
    | "community"
    | "customers"
    | "changelog"
    | "press";

export const BLOG_CATEGORIES: { slug: BlogCategory | "all"; label: string }[] = [
    { slug: "all", label: "All" },
    { slug: "engineering", label: "Engineering" },
    { slug: "product", label: "Product" },
    { slug: "community", label: "Community" },
    { slug: "customers", label: "Customers" },
    { slug: "changelog", label: "Changelog" },
    { slug: "press", label: "Press" },
];

export interface BlogPostFrontmatter {
    title: string;
    slug: string;
    date: string;
    excerpt: string;
    coverImage: string;
    authors: string[]; // Author slugs
    tags: string[];
    category?: BlogCategory;
    externalUrl?: string; // For press links
    published: boolean;
}

export interface BlogPost extends BlogPostFrontmatter {
    content: string;
    readTime: string;
    authorDetails: Author[];
}

/**
 * Get all author profiles
 */
export function getAllAuthors(): Author[] {
    if (!fs.existsSync(AUTHORS_DIR)) {
        return [];
    }

    const files = fs.readdirSync(AUTHORS_DIR);
    return files
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
            const content = fs.readFileSync(path.join(AUTHORS_DIR, file), 'utf-8');
            return JSON.parse(content) as Author;
        });
}

/**
 * Get author by slug
 */
export function getAuthorBySlug(slug: string): Author | null {
    const authors = getAllAuthors();
    return authors.find((author) => author.slug === slug) || null;
}

/**
 * Get all blog posts
 */
export function getAllPosts(includeUnpublished = false): BlogPost[] {
    if (!fs.existsSync(BLOG_DIR)) {
        return [];
    }

    const files = fs.readdirSync(BLOG_DIR);
    const posts = files
        .filter((file) => file.endsWith('.mdx') || file.endsWith('.md'))
        .map((file) => {
            const filePath = path.join(BLOG_DIR, file);
            const fileContents = fs.readFileSync(filePath, 'utf-8');
            const { data, content } = matter(fileContents);

            const frontmatter = data as BlogPostFrontmatter;

            // Get author details
            const authorDetails = frontmatter.authors
                ? frontmatter.authors.map((slug) => getAuthorBySlug(slug)).filter(Boolean) as Author[]
                : [];

            // Calculate reading time
            const stats = readingTime(content);

            return {
                ...frontmatter,
                excerpt: frontmatter.excerpt || "",
                content,
                readTime: stats.text,
                authorDetails,
            };
        })
        .filter((post) => includeUnpublished || post.published)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return posts;
}

/**
 * Get a single post by slug
 */
export function getPostBySlug(slug: string): BlogPost | null {
    const posts = getAllPosts(true);
    return posts.find((post) => post.slug === slug) || null;
}

/**
 * Get posts by tag
 */
export function getPostsByTag(tag: string): BlogPost[] {
    const posts = getAllPosts();
    return posts.filter((post) => post.tags.includes(tag));
}

/**
 * Get posts by category
 */
export function getPostsByCategory(category: BlogCategory): BlogPost[] {
    const posts = getAllPosts();
    return posts.filter((post) => post.category === category);
}

/**
 * Get the URL path for a blog post based on its category
 */
export function getPostUrl(post: BlogPost | BlogPostFrontmatter): string {
    if (post.category === "changelog") return `/changelog/${post.slug}`;
    return `/blog/${post.slug}`;
}

/**
 * Get posts by author
 */
export function getPostsByAuthor(authorSlug: string): BlogPost[] {
    const posts = getAllPosts();
    return posts.filter((post) => post.authors.includes(authorSlug));
}

/**
 * Get all unique tags
 */
export function getAllTags(): string[] {
    const posts = getAllPosts();
    const tags = new Set<string>();
    posts.forEach((post) => {
        post.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
}

import { MDXComponents } from '@/components/blog/MDXComponents';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { CUSTOM_SHIKI_THEME } from './shiki-theme';

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
        components: MDXComponents,
    });

    return mdxContent;
}
