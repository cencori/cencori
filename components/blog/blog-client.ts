import { BLOG_CATEGORIES } from "@/lib/blog-categories";

export type { BlogCategory, BlogCategoryMeta } from "@/lib/blog-categories";

export type BlogCardPost = {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  coverImage?: string;
  category?: string;
  tags?: string[];
};

export function getBlogPostUrl(post: Pick<BlogCardPost, "slug" | "category">): string {
  if (post.category === "changelog") return `/changelog/${post.slug}`;
  return `/newsroom/${post.slug}`;
}

export function formatBlogCategory(category?: string): string {
  if (!category) return "Newsroom";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

// Canonical category order for the newsroom filter list (from lib/blog-categories.ts).
export const BLOG_CATEGORY_ORDER: string[] = BLOG_CATEGORIES.filter(
  (c) => c.slug !== "all",
).map((c) => c.label);
