import Link from "next/link";
import Image from "next/image";
import { BlogPost } from "@/lib/blog";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { TechnicalBorder } from "@/components/landing/TechnicalBorder";
import { Badge } from "@/components/ui/badge";

interface BlogCardProps {
    post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
    return (
        <Link href={`/blog/${post.slug}`} className="block h-full group">
            <TechnicalBorder
                className="h-full bg-background/50 backdrop-blur-sm"
                cornerSize={12}
                borderWidth={1}
                hoverEffect={true}
            >
                <div className="flex flex-col h-full">
                    {/* Cover Image */}
                    <div className="relative w-full h-52 overflow-hidden border-b border-border/40">
                        {post.coverImage ? (
                            <Image
                                src={post.coverImage}
                                alt={post.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                                <span className="text-4xl font-bold text-primary/20">Cencori</span>
                            </div>
                        )}

                        {/* Date Badge */}
                        <div className="absolute top-4 right-4">
                            <Badge variant="secondary" className="bg-background/80 backdrop-blur-md border-border/50 text-xs font-mono">
                                {format(new Date(post.date), "MMM d, yyyy")}
                            </Badge>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col flex-1 p-6">
                        {/* Tags */}
                        {post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {post.tags.slice(0, 2).map((tag) => (
                                    <span
                                        key={tag}
                                        className="text-[10px] uppercase tracking-wider font-semibold text-primary/80"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Title */}
                        <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                            {post.title}
                        </h3>

                        {/* Excerpt */}
                        <p className="text-muted-foreground text-sm mb-6 line-clamp-3 flex-1 leading-relaxed">
                            {post.excerpt}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-border/40 mt-auto">
                            {/* Author */}
                            <div className="flex items-center gap-2">
                                {post.authorDetails && post.authorDetails.length > 0 && (
                                    <div className="flex -space-x-2">
                                        {post.authorDetails.slice(0, 1).map((author) => (
                                            <div key={author.slug} className="flex items-center gap-2">
                                                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-border">
                                                    {author.avatar ? (
                                                        <Image
                                                            src={author.avatar}
                                                            alt={author.name}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-primary/20" />
                                                    )}
                                                </div>
                                                <span className="text-xs font-medium text-muted-foreground">{author.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Read Time & Arrow */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {post.readTime}
                                </div>
                                <ArrowRight className="h-3 w-3 -rotate-45 group-hover:rotate-0 transition-transform duration-300 text-primary" />
                            </div>
                        </div>
                    </div>
                </div>
            </TechnicalBorder>
        </Link>
    );
}
