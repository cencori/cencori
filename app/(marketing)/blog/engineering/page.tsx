import { Suspense } from "react";
import { getPostsByCategory } from "@/lib/blog";
import { BlogList } from "@/components/blog/BlogList";
import { BlogTabs } from "@/components/blog/BlogTabs";
import { AuthNavbar } from "@/components/landing/AuthNavbar";
import { Footer } from "@/components/landing/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Engineering | Blog",
    description: "Technical deep-dives into how Cencori is built.",
};

export default function EngineeringBlogPage() {
    const posts = getPostsByCategory("engineering");

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <AuthNavbar />
            <main className="flex-1 pt-20">
                <div className="border-b border-border/40">
                    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-5">
                        <div>
                            <h1 className="text-lg font-semibold">Blog</h1>
                            <p className="text-xs text-muted-foreground mt-1">
                                Updates, announcements, and engineering insights
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
            <Footer />
        </div>
    );
}
