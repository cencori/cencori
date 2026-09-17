import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import { BlogFilters } from "@/components/blog/BlogFilters";

export const metadata: Metadata = {
  title: "Newsroom | Cencori",
  description: "Updates, announcements, and engineering insights.",
};

export default function BlogPage() {
  const allPosts = getAllPosts();

  return (
    <main className="flex-1 pt-20">
      <div className="container mx-auto max-w-5xl px-4 pb-8 pt-4 md:py-8">
        <BlogFilters posts={allPosts} />
      </div>
    </main>
  );
}
