import { Suspense } from "react";
import { getPostsByCategory, getBlogCategoryMeta } from "@/lib/blog";
import { BlogList } from "@/components/blog/BlogList";
import { BlogTabs } from "@/components/blog/BlogTabs";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Engineering | Newsroom",
    description: "Technical deep-dives into how Cencori is built.",
};

export default function EngineeringBlogPage() {
    const posts = getPostsByCategory("engineering");

    return (
        <main className="flex-1 pt-20">
                <div className="border-b border-border/40">
                    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-5">
                        <div>
                            <h1 className="text-lg font-semibold">Newsroom</h1>
                            <p className="text-xs text-muted-foreground mt-1">
                                {getBlogCategoryMeta("engineering")?.blurb}
                            </p>
                        </div>
                        <Suspense>
                            <BlogTabs />
                        </Suspense>
                    </div>
                </div>
                <Suspense>
                    <BlogList posts={posts} />
                </Suspense>
            </main>
    );
}
