import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import { BlogFilters } from "@/components/blog/BlogFilters";

// Developer lens onto the newsroom pool — not a second blog. Shows what a
// builder needs (guides/SDKs, engineering deep-dives, changelog) with the
// Developers tab selected by default.
const LENS_CATEGORIES = ["Developers", "Engineering", "Changelog"];

export const metadata: Metadata = {
  title: "Developer Blog | Cencori",
  description:
    "SDKs, guides, engineering deep-dives, and changelog for developers building on Cencori.",
};

export default function DevelopersBlogPage() {
  const allPosts = getAllPosts();

  return (
    <main className="flex-1 pt-20">
      <div className="container mx-auto max-w-5xl px-4 pb-8 pt-4 md:py-8">
        <BlogFilters
          posts={allPosts}
          initialCategory="Developers"
          titleFallback="Developers"
          visibleCategories={LENS_CATEGORIES}
        />
      </div>
    </main>
  );
}
