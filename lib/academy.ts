import 'server-only';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { compileMDX } from 'next-mdx-remote/rsc';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { CUSTOM_SHIKI_THEME } from './shiki-theme';
import { DocsMDXComponents } from '@/components/docs/DocsMDXComponents';

const ACADEMY_DIR = path.join(process.cwd(), 'content', 'academy');

export interface LessonFrontmatter {
    title: string;
    description: string;
    section: string;
    order: number;
    duration: string;
}

export interface Lesson extends LessonFrontmatter {
    slug: string;
    content: string;
}

export interface Heading {
    id: string;
    text: string;
    level: number;
}

/**
 * Get all lessons for a course
 */
export function getCourseLessons(courseId: string): Lesson[] {
    const courseDir = path.join(ACADEMY_DIR, courseId);
    if (!fs.existsSync(courseDir)) return [];

    const files = fs.readdirSync(courseDir)
        .filter(f => f.endsWith('.mdx') || f.endsWith('.md'))
        .sort();

    return files.map((file) => {
        const filePath = path.join(courseDir, file);
        const fileContents = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = matter(fileContents);
        const frontmatter = data as LessonFrontmatter;
        const slug = file.replace(/\.(mdx|md)$/, '');

        return {
            ...frontmatter,
            slug,
            content,
        };
    });
}

/**
 * Get a single lesson by course and slug
 */
export function getLesson(courseId: string, lessonSlug: string): Lesson | null {
    const lessons = getCourseLessons(courseId);
    return lessons.find(l => l.slug === lessonSlug) || null;
}

/**
 * Get the course intro MDX (index.mdx in the course directory)
 */
export function getCourseIntro(courseId: string): { content: string; frontmatter: Record<string, unknown> } | null {
    const introPath = path.join(ACADEMY_DIR, courseId, 'index.mdx');
    if (!fs.existsSync(introPath)) return null;

    const fileContents = fs.readFileSync(introPath, 'utf-8');
    const { data, content } = matter(fileContents);
    return { content, frontmatter: data };
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

/**
 * Parse and render MDX content
 */
export async function parseAcademyMDX(content: string) {
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
