import { notFound } from "next/navigation";
import { getPostBySlug, getAllPosts } from "@/lib/blog";
import { parseMDX } from "@/lib/blog";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

interface BlogPostPageProps {
    params: Promise<{
        slug: string;
    }>;
}

// Generate static params for all posts
export function generateStaticParams() {
    const posts = getAllPosts();
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
                    url: post.coverImage,
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
            images: [post.coverImage],
        },
    };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
    const { slug } = await params;
    const post = getPostBySlug(slug);

    if (!post || !post.published) {
        notFound();
    }

    const content = await parseMDX(post.content);

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />

            <main className="flex-1 pt-20">
                <article className="container mx-auto px-4 max-w-2xl py-12">
                    {/* Back Link */}
                    <div className="mb-6">
                        <Link
                            href="/blog"
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="h-3 w-3" />
                            Blog
                        </Link>
                    </div>

                    {/* Header */}
                    <header className="mb-8">
                        {/* Tags */}
                        {post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {post.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Title */}
                        <h1 className="text-2xl font-bold mb-4 tracking-tight leading-tight">
                            {post.title}
                        </h1>

                        {/* Meta */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {/* Author */}
                            {post.authorDetails.map((author) => (
                                <div key={author.slug} className="flex items-center gap-2">
                                    {author.avatar && (
                                        <div className="relative w-5 h-5 rounded-full overflow-hidden border border-border/50">
                                            <Image
                                                src={author.avatar}
                                                alt={author.name}
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                    )}
                                    <span className="font-medium text-foreground">{author.name}</span>
                                </div>
                            ))}

                            <span className="text-muted-foreground/40">·</span>
                            <span>{format(new Date(post.date), "MMMM d, yyyy")}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span>{post.readTime}</span>
                        </div>
                    </header>

                    {/* Content */}
                    <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:border prose-img:border-border/50 prose-p:text-muted-foreground prose-li:text-muted-foreground">
                        {content}
                    </div>
                </article>
            </main>

            <Footer />
        </div>
    );
}

