"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BlogPost } from "@/lib/blog";
import { PressCard } from "@/components/blog/PressCard";

interface PressListProps {
    posts: BlogPost[];
}

export function PressList({ posts }: PressListProps) {
    const searchParams = useSearchParams();
    const query = searchParams.get("q") || "";

    const filtered = useMemo(() => {
        if (!query) return posts;
        return posts.filter((p) =>
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            (p.excerpt?.toLowerCase() || "").includes(query.toLowerCase())
        );
    }, [posts, query]);

    return (
        <div className="container mx-auto px-4 py-6 max-w-5xl">
            {filtered.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map((post) => (
                        <PressCard key={post.slug} post={post} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16">
                    <h3 className="text-sm font-semibold mb-1">No press coverage yet</h3>
                    <p className="text-xs text-muted-foreground">
                        Media mentions and features will appear here.
                    </p>
                </div>
            )}
        </div>
    );
}
