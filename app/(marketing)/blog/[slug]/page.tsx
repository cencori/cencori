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
        <div className="min-h-screen bg-background">
            {/* Back Button */}
            <div className="border-b border-border/40">
                <div className="container mx-auto py-6 px-4 max-w-4xl">
                    <Link
                        href="/blog"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Blog
                    </Link>
                </div>
            </div>

            {/* Cover Image */}
            {post.coverImage && (
                <div className="relative w-full h-[400px] bg-muted">
                    <Image
                        src={post.coverImage}
                        alt={post.title}
                        fill
                        className="object-cover"
                        priority
                    />
                </div>
            )}

            {/* Article */}
            <article className="container mx-auto px-4 max-w-4xl">
                {/* Header */}
                <header className="py-12 border-b border-border/40">
                    {/* Tags */}
                    {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                            {post.tags.map((tag) => (
                                <TagChip key={tag} tag={tag} href={`/blog?tag=${tag}`} />
                            ))}
                        </div>
                    )}

                    {/* Title */}
                    <h1 className="text-4xl md:text-5xl font-bold mb-6">
                        {post.title}
                    </h1>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-8">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(post.date), "MMMM d, yyyy")}
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {post.readTime}
                        </div>
                    </div>

                    {/* Authors */}
                    <div className="flex flex-col gap-4">
                        {post.authorDetails.map((author) => (
                            <AuthorBadge
                                key={author.slug}
                                author={author}
                                size="lg"
                                showBio
                            />
                        ))}
                    </div>
                </header>

                {/* Content */}
                <div className="prose prose-neutral dark:prose-invert max-w-none py-12">
                    {content}
                </div>
            </article>
        </div>
    );
}
