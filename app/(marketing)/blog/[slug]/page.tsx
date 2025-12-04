import { notFound } from "next/navigation";
import { getPostBySlug, getAllPosts } from "@/lib/blog";
import { AuthorBadge } from "@/components/blog/AuthorBadge";
import { TagChip } from "@/components/blog/TagChip";
import { parseMDX } from "@/lib/blog";
import { format } from "date-fns";
import { Calendar, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { TechnicalBorder } from "@/components/landing/TechnicalBorder";
import { CodeBlock } from "@/components/ai-elements/code-block";

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
                {/* Background Elements */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

                <article className="container mx-auto px-4 max-w-4xl py-12">
                    {/* Back Link */}
                    <div className="mb-8">
                        <Link
                            href="/blog"
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
                        >
                            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                            Blog
                        </Link>
                    </div>

                    {/* Header */}
                    <header className="mb-10 text-center max-w-2xl mx-auto">
                        {/* Title */}
                        <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight leading-tight">
                            {post.title}
                        </h1>

                        {/* Meta & Author */}
                        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
                            {/* Author */}
                            {post.authorDetails.map((author) => (
                                <div key={author.slug} className="flex items-center gap-2">
                                    {author.avatar && (
                                        <div className="relative w-6 h-6 rounded-full overflow-hidden border border-border">
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

                            <span className="text-muted-foreground/30">•</span>

                            {/* Date */}
                            <div>
                                {format(new Date(post.date), "MMMM d, yyyy")}
                            </div>

                            <span className="text-muted-foreground/30">•</span>

                            {/* Read Time */}
                            <div>
                                {post.readTime}
                            </div>
                        </div>
                    </header>

                    {/* Hero Image - Hidden */}

                    {/* Content */}
                    <div className="prose prose-zinc dark:prose-invert max-w-none prose-lg prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary prose-img:rounded-lg prose-img:border prose-img:border-border/50 prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-border/50 prose-pre:rounded-xl">
                        {content}
                    </div>
                </article>
            </main>

            <Footer />
        </div>
    );
}
