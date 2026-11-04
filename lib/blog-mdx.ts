import 'server-only';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { blogMdxComponents } from '@/components/blog/mdx-components';

// Kept apart from lib/blog.ts on purpose: the MDX component set reaches the
// docs components, Shiki and the model catalog. Pages that only list posts
// (the homepage, newsroom, sitemap) import lib/blog.ts and stay light.

/**
 * Parse and render MDX content for the blog.
 *
 * Uses the same MDX component set and Shiki syntax highlighter as the
 * docs so blog posts get the same rendering quality — tables, code blocks,
 * headings, links, callouts all match the docs. Blog content typically
 * uses the "prose" subset (headings, tables, code, links, lists,
 * blockquote); docs-specific structural components like Steps or ApiTable
 * are available as escape hatches but shouldn't be common.
 */
export async function parseMDX(content: string) {
  const { content: mdxContent } = await compileMDX({
    source: content,
    options: {
      parseFrontmatter: false,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug],
      },
    },
    components: blogMdxComponents,
  });

  return mdxContent;
}