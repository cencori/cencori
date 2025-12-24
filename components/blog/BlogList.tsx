"use client";

import { useState, useMemo } from "react";
import { BlogPost } from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlogListProps {
    posts: BlogPost[];
    tags: string[];
}

export function BlogList({ posts, tags }: BlogListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    // Filter posts
    const filteredPosts = useMemo(() => {
        return posts.filter((post) => {
            const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesTag = !selectedTag || post.tags.includes(selectedTag);
            return matchesSearch && matchesTag;
        });
    }, [posts, searchQuery, selectedTag]);

    return (
        <div className="container mx-auto px-4 py-6 max-w-5xl">
            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Search */}
                    <div className="w-full md:max-w-xs">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-sm bg-background border-border/50 rounded-full"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 justify-center md:justify-end">
                        {[
                            { value: null, label: "All" },
                            { value: "Changelog", label: "Changelog" },
                            { value: "Engineering", label: "Engineering" },
                            { value: "Announcement", label: "Announcement" },
                            { value: "Product", label: "Product" },
                        ].map((tag) => (
                            <button
                                key={tag.label}
                                onClick={() => setSelectedTag(tag.value === selectedTag ? null : tag.value)}
                                className={cn(
                                    "h-7 px-3 rounded-full text-xs font-medium transition-colors border",
                                    (tag.value === null ? !selectedTag : selectedTag === tag.value)
                                        ? "bg-foreground text-background border-foreground"
                                        : "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                                )}
                            >
                                {tag.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Posts Grid */}
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
                        Try adjusting your filters or search terms.
                    </p>
                    <button
                        onClick={() => { setSearchQuery(""); setSelectedTag(null); }}
                        className="mt-4 text-xs text-primary hover:underline underline-offset-4 font-medium"
                    >
                        Clear filters
                    </button>
                </div>
            )}
        </div>
    );
}

