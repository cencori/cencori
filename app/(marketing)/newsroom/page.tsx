import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import { BlogFilters } from "@/components/blog/BlogFilters";
import { BLOG_CATEGORY_ORDER, formatBlogCategory } from "@/components/blog/blog-client";

export const metadata: Metadata = {
  title: "Newsroom | Cencori",
  description: "Updates, announcements, and engineering insights.",
};

export default function BlogPage() {
  // Coverage from other outlets is on the About page ("In the news"), not here.
  const allPosts = getAllPosts().filter((post) => post.category !== "press");
  // Only tabs that have something in them: an empty tab is a dead end.
  const used = new Set(allPosts.map((post) => formatBlogCategory(post.category)));
  const categories = BLOG_CATEGORY_ORDER.filter((label) => used.has(label));

  return (
    <main className="flex-1 pt-20">
      <div className="container mx-auto max-w-5xl px-4 pb-8 pt-4 md:py-8">
        <BlogFilters posts={allPosts} visibleCategories={categories} />
      </div>
    </main>
  );
}
