"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BlogPost } from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";
import { Search } from "lucide-react";

interface BlogListProps {
    posts: BlogPost[];
}

export function BlogList({ posts }: BlogListProps) {
    const searchParams = useSearchParams();
    const searchQuery = searchParams.get("q") || "";

    const filteredPosts = useMemo(() => {
        if (!searchQuery) return posts;
        return posts.filter((post) => {
            return (
                post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (post.excerpt?.toLowerCase() || "").includes(searchQuery.toLowerCase())
            );
        });
    }, [posts, searchQuery]);

    return (
        <div className="container mx-auto px-4 py-6 max-w-5xl">
            {filteredPosts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPosts.map((post) => (
                        <BlogCard key={post.slug} post={post} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mb-3">
                        <Search className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">No articles found</h3>
                    <p className="text-xs text-muted-foreground max-w-xs">
                        Try adjusting your search terms.
                    </p>
                </div>
            )}
        </div>
    );
}
