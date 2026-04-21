import { notFound, redirect } from "next/navigation";
import { getPostBySlug, getAllPosts, getPostUrl } from "@/lib/blog";
import { parseMDX } from "@/lib/blog";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { AuthNavbar } from "@/components/landing/AuthNavbar";
import { Footer } from "@/components/landing/Footer";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { buildOgImageUrl } from "@/lib/og";

interface BlogPostPageProps {
    params: Promise<{
        slug: string;
    }>;
}

// Generate static params for non-changelog posts
export function generateStaticParams() {
    const posts = getAllPosts().filter((p) => p.category !== "changelog");
    return posts.map((post) => ({
        slug: post.slug,
    }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
    const { slug } = await params;
    const post = getPostBySlug(slug);

    if (!post) {
        return {
            title: "Post Not Found",
        };
    }

    // Use cover image or fall back to dynamic OG
    const authorName = post.authorDetails[0]?.name || "";
    const formattedDate = post.date ? new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

    const ogImage = post.coverImage
        ? post.coverImage
        : buildOgImageUrl({
            title: post.title,
            type: "blog",
            author: authorName,
            date: formattedDate,
        });

    return {
        title: post.title,
        description: post.excerpt,
        openGraph: {
            title: post.title,
            description: post.excerpt,
            type: "article",
            publishedTime: post.date,
            authors: post.authorDetails.map((a) => a.name),
            images: [
                {
                    url: ogImage,
                    width: 1200,
                    height: 630,
                    alt: post.title,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: post.title,
            description: post.excerpt,
            images: [ogImage],
        },
    };
}


export default async function BlogPostPage({ params }: BlogPostPageProps) {
    const { slug } = await params;
    const post = getPostBySlug(slug);

    if (!post || !post.published) {
        notFound();
    }

    // Redirect changelog posts to /changelog/[slug]
    if (post.category === "changelog") {
        redirect(`/changelog/${slug}`);
    }

    const content = await parseMDX(post.content);

    // Get non-changelog posts for prev/next navigation
    const allPosts = getAllPosts().filter(p => p.published && p.category !== "changelog");
    const currentIndex = allPosts.findIndex(p => p.slug === slug);
    const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;
    const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;

    return (
        <div className={`min-h-screen bg-background flex flex-col ${GeistSans.variable} ${GeistMono.variable}`} style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
            <AuthNavbar />

            <main className="flex-1 pt-20">
                <div className="container mx-auto px-4 max-w-4xl py-12">
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_200px] gap-12">
                        {/* Main Content */}
                        <article className="min-w-0">
                            {/* Back Link */}
                            <div className="mb-6">
                                <Link
                                    href="/blog"
                                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors"
                                >
                                    Blog
                                </Link>
                            </div>

                            {/* Header */}
                            <header className="mb-8">
                                {/* Title */}
                                <h1 className="text-3xl font-bold mb-4 tracking-tight leading-tight">
                                    {post.title}
                                </h1>

                                {/* Meta */}
                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-8">
                                    <span>{format(new Date(post.date), "dd MMMM yyyy")}</span>
                                    <span className="text-muted-foreground/40">•</span>
                                    <span>{post.readTime}</span>
                                </div>

                                {/* Author */}
                                {post.authorDetails.map((author) => (
                                    <div key={author.slug} className="flex items-center gap-3">
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
                                            <span className="font-medium text-foreground block">{author.name}</span>
                                            {author.role && (
                                                <span className="text-xs text-muted-foreground">{author.role}</span>
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

                            {/* Content */}
                            <div className="prose prose-zinc dark:prose-invert max-w-none prose-headings:leading-tight prose-p:leading-[1.55] prose-li:leading-[1.5] prose-ul:leading-[1.5] prose-ol:leading-[1.5]">
                                {content}
                            </div>

                            {/* Navigation */}
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

                        {/* Sidebar */}
                        <aside className="hidden lg:block">
                            <div className="sticky top-28">
                                <ShareButtons title={post.title} slug={slug} />
                            </div>
                        </aside>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
