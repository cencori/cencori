"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BlogPost } from "@/lib/blog";
import { format } from "date-fns";

interface ChangelogListProps {
    posts: BlogPost[];
}

function postUrl(post: BlogPost): string {
    return post.category === "changelog" ? `/changelog/${post.slug}` : `/blog/${post.slug}`;
}

export function ChangelogList({ posts }: ChangelogListProps) {
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
        <div className="container mx-auto px-4 py-6 max-w-3xl">
            <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[7px] top-2 bottom-0 w-px bg-border/40" />

                <div className="space-y-0">
                    {filtered.map((post) => (
                        <article key={post.slug} className="relative py-6">
                            <div className="grid grid-cols-[16px_1fr] gap-x-5">
                                {/* Dot */}
                                <div className="relative flex justify-center pt-1">
                                    <div className="h-2.5 w-2.5 rounded-full border border-border bg-background" />
                                </div>

                                {/* Content */}
                                <div className="min-w-0 space-y-2">
                                    <p className="text-[11px] text-muted-foreground">
                                        {format(new Date(post.date), "MMM d, yyyy")}
                                    </p>

                                    <Link href={postUrl(post)} className="group block">
                                        <h2 className="text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-foreground/80">
                                            {post.title}
                                        </h2>
                                    </Link>

                                    <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                                        {post.excerpt}
                                    </p>

                                    {/* Author */}
                                    {post.authorDetails && post.authorDetails.length > 0 && (
                                        <div className="flex items-center gap-2 pt-1">
                                            <span className="text-[10px] text-muted-foreground">
                                                {post.authorDetails.map((a) => a.name).join(", ")}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-16">
                    <h3 className="text-sm font-semibold mb-1">No changelog entries yet</h3>
                    <p className="text-xs text-muted-foreground">
                        Updates will appear here as features ship.
                    </p>
                </div>
            )}
        </div>
    );
}
