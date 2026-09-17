/**
 * Shared post view for /newsroom/[slug] and /changelog/[slug].
 *
 * Everything both pages need to render a post — layout, header, cover
 * image, MDX content, TOC sidebar, share buttons, prev/next navigation.
 * The two page components become thin: fetch data, hand it here.
 *
 * Differences between blog + changelog are passed in via props:
 *   - breadcrumb: what shows at the top ("Blog" vs "Blog / Changelog")
 *   - prevPost / nextPost: scope of adjacent posts
 *   - showCopyMarkdown: whether the top-right "Copy as Markdown" pill shows
 *   - showToc: whether the sidebar TOC renders
 */

import type { ReactNode } from "react";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ShareButtons } from "@/components/blog/ShareButtons";
import { BlogTableOfContents } from "@/components/blog/BlogTableOfContents";
import { CopyMarkdownButton } from "@/components/blog/CopyMarkdownButton";
import { getPostUrl, type BlogPost, type BlogTocEntry } from "@/lib/blog";
import { cn } from "@/lib/utils";

interface PostViewProps {
    post: BlogPost;
    /** Rendered MDX children (from parseMDX). */
    content: ReactNode;
    /** Optional TOC entries. When empty (or omitted) the TOC is hidden. */
    toc?: BlogTocEntry[];
    /** Rendered breadcrumb — e.g. `<Link href="/newsroom">Newsroom</Link>`. */
    breadcrumb: ReactNode;
    /** Show the "Copy as Markdown" pill in the top-right. Default: true. */
    showCopyMarkdown?: boolean;
    /** Show the sidebar share buttons. Default: true. */
    showShare?: boolean;
    /** Previous post in the current scope (blog or changelog only). */
    prevPost?: BlogPost | null;
    /** Next post in the current scope. */
    nextPost?: BlogPost | null;
    /** Center the header block (breadcrumb, title, meta). Default: false. */
    centerHeader?: boolean;
    /** Extra classes merged onto the MDX body wrapper. */
    contentClassName?: string;
    /** Narrow the container (max-w-3xl instead of max-w-4xl). Default: false. */
    narrow?: boolean;
    /** Extra bottom gap before the footer. Default: false. */
    bottomGap?: boolean;
}

export function PostView({
    post,
    content,
    toc = [],
    breadcrumb,
    showCopyMarkdown = true,
    showShare = true,
    prevPost = null,
    nextPost = null,
    centerHeader = false,
    contentClassName,
    narrow = false,
    bottomGap = false,
}: PostViewProps) {
    const showSidebar = toc.length > 0 || showShare;
    return (
        <>
            <main className="flex-1 pt-20">
                <div className={cn("container mx-auto px-4 pt-12", bottomGap ? "pb-24 md:pb-32" : "pb-12", narrow ? "max-w-3xl" : "max-w-4xl")}>
                    <div className={showSidebar ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_200px] gap-12" : "grid grid-cols-1 gap-12"}>
                        {/* Main Content */}
                        <article className="min-w-0">
                            {/* Breadcrumb + Copy */}
                            <div className={centerHeader ? "mb-6 flex items-center justify-center gap-4 text-center" : "mb-6 flex items-center justify-between gap-4"}>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    {breadcrumb}
                                </div>
                                {showCopyMarkdown && !centerHeader && (
                                    <CopyMarkdownButton mdx={post.content} />
                                )}
                            </div>
                            {showCopyMarkdown && centerHeader && (
                                <div className="mb-6 flex justify-center">
                                    <CopyMarkdownButton mdx={post.content} />
                                </div>
                            )}

                            {/* Header */}
                            <header className={centerHeader ? "mb-8 text-center flex flex-col items-center" : "mb-8"}>
                                <h1 className="text-3xl font-bold mb-4 tracking-tight leading-tight">
                                    {post.title}
                                </h1>

                                <div className={centerHeader ? "flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground mb-8" : "flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-8"}>
                                    <span>{format(new Date(post.date), "dd MMMM yyyy")}</span>
                                    <span className="text-muted-foreground/40">•</span>
                                    <span>{post.readTime}</span>
                                </div>

                                {post.authorDetails.map((author) => (
                                    <div key={author.slug} className={centerHeader ? "flex items-center justify-center gap-3 text-center" : "flex items-center gap-3"}>
                                        {author.avatar && (
                                            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-border/50">
                                                <Image
                                                    src={author.avatar}
                                                    alt={author.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <span className="font-medium text-foreground block">
                                                {author.name}
                                            </span>
                                            {author.role && (
                                                <span className="text-xs text-muted-foreground">
                                                    {author.role}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </header>

                            {/* Cover Image */}
                            {post.coverImage && (
                                <div className="relative w-full aspect-[2/1] rounded-lg overflow-hidden border border-border/50 mb-10 bg-muted/30">
                                    <Image
                                        src={post.coverImage}
                                        alt={post.title}
                                        fill
                                        className="object-cover"
                                        priority
                                        unoptimized
                                    />
                                </div>
                            )}

                            {/* Content — blogMdxComponents styles everything.
                                Code blocks render as BlogCodeBlock (Shiki card). */}
                            <div className={cn("text-primary/85 w-full min-w-0 text-[15px] leading-[1.65]", contentClassName)}>
                                {content}
                            </div>

                            {/* Prev / Next Navigation */}
                            {(prevPost || nextPost) && (
                                <div className="mt-16 pt-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {prevPost && (
                                            <Link
                                                href={getPostUrl(prevPost)}
                                                className="group flex flex-col p-4 rounded-lg border border-border/50 hover:border-border transition-colors"
                                            >
                                                <span className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                                    <ArrowLeft className="w-3 h-3" />
                                                    Previous
                                                </span>
                                                <span className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">
                                                    {prevPost.title}
                                                </span>
                                            </Link>
                                        )}
                                        {nextPost && (
                                            <Link
                                                href={getPostUrl(nextPost)}
                                                className="group flex flex-col p-4 rounded-lg border border-border/50 hover:border-border transition-colors sm:text-right sm:ml-auto"
                                            >
                                                <span className="text-xs text-muted-foreground mb-1 flex items-center gap-1 sm:justify-end">
                                                    Next
                                                    <ArrowRight className="w-3 h-3" />
                                                </span>
                                                <span className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">
                                                    {nextPost.title}
                                                </span>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )}
                        </article>

                        {/* Sidebar — TOC + Share */}
                        {showSidebar && (
                        <aside className="hidden lg:block">
                            <div className="sticky top-28 space-y-6">
                                {toc.length > 0 && <BlogTableOfContents toc={toc} />}
                                {showShare && <ShareButtons title={post.title} slug={post.slug} />}
                            </div>
                        </aside>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
