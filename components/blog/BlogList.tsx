"use client";

import { useState, useMemo } from "react";
import { BlogPost } from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { TechnicalBorder } from "@/components/landing/TechnicalBorder";
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
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Search and Filters */}
            <div className="mb-8 space-y-8">
                <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                    {/* Search */}
                    <div className="w-full md:max-w-md">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search articles..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11 h-12 rounded-full bg-background/50 border-zinc-900 focus-visible:ring-primary/20 transition-all duration-300 hover:border-primary/50 hover:bg-background/80"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                        {[
                            { value: null, label: "All Posts" },
                            { value: "Engineering", label: "Engineering" },
                            { value: "Announcement", label: "Announcement" },
                            { value: "Product", label: "Product" },
                            { value: "Company News", label: "Company News" },
                        ].map((tag) => (
                            <button
                                key={tag.label}
                                onClick={() => setSelectedTag(tag.value === selectedTag ? null : tag.value)}
                                className={cn(
                                    "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border",
                                    (tag.value === null ? !selectedTag : selectedTag === tag.value)
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredPosts.map((post) => (
                        <BlogCard key={post.slug} post={post} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <Search className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No articles found</h3>
                    <p className="text-muted-foreground max-w-sm">
                        We couldn&apos;t find any articles matching your search. Try adjusting your filters or search terms.
                    </p>
                    <button
                        onClick={() => { setSearchQuery(""); setSelectedTag(null); }}
                        className="mt-6 text-primary hover:underline underline-offset-4 font-medium"
                    >
                        Clear all filters
                    </button>
                </div>
            )}
        </div>
    );
}
