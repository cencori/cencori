import { Suspense } from "react";
import { getPostsByCategory, getBlogCategoryMeta } from "@/lib/blog";
import { BlogList } from "@/components/blog/BlogList";
import { BlogTabs } from "@/components/blog/BlogTabs";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Security | Newsroom",
    description: "Security releases, safety engineering, and compliance at Cencori.",
};

export default function SecurityBlogPage() {
    const posts = getPostsByCategory("security");

    return (
        <main className="flex-1 pt-20">
                <div className="border-b border-border/40">
                    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-5">
                        <div>
                            <h1 className="text-lg font-semibold">Newsroom</h1>
                            <p className="text-xs text-muted-foreground mt-1">
                                {getBlogCategoryMeta("security")?.blurb}
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
