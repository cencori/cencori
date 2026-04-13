import { BlogPost } from "@/lib/blog";
import { ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

interface PressCardProps {
    post: BlogPost;
}

export function PressCard({ post }: PressCardProps) {
    const href = post.externalUrl || `/blog/${post.slug}`;
    const isExternal = !!post.externalUrl;

    return (
        <a
            href={href}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className="block group"
        >
            <div className="h-full flex flex-col p-5 border border-border/50 rounded-lg bg-background hover:border-border transition-colors">
                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {post.tags.slice(0, 2).map((tag) => (
                            <span
                                key={tag}
                                className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Date */}
                <p className="text-[10px] text-muted-foreground mb-2">
                    {format(new Date(post.date), "MMM d, yyyy")}
                </p>

                {/* Title */}
                <h3 className="text-sm font-semibold mb-2 group-hover:text-primary transition-colors leading-snug">
                    {post.title}
                </h3>

                {/* Excerpt */}
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
                    {post.excerpt}
                </p>

                {/* Link indicator */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-auto">
                    {isExternal && (
                        <>
                            <span className="text-[10px]">{new URL(post.externalUrl!).hostname}</span>
                            <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-primary" />
                        </>
                    )}
                </div>
            </div>
        </a>
    );
}
