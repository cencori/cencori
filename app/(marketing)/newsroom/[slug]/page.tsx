import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { getPostBySlug, getAllPosts, parseMDX } from "@/lib/blog";
import { NewsPostView } from "@/components/blog/NewsPostView";

interface BlogPostPageProps {
    params: Promise<{
        slug: string;
    }>;
}

export function generateStaticParams() {
    const posts = getAllPosts().filter((p) => p.category !== "changelog");
    return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
    const { slug } = await params;
    const post = getPostBySlug(slug);

    if (!post) return { title: "Post Not Found" };

    // Relative on purpose: Next resolves these against the root layout's
    // metadataBase (cencori.com). Building an absolute URL here from
    // NEXT_PUBLIC_APP_URL leaked cencori.vercel.app into the card tags in
    // production, and X's crawler gets a 404 on that domain — no preview card.
    const ogImage = post.coverImage ?? `/newsroom/og/v1/${post.slug}.jpg`;

    return {
        title: post.title,
        description: post.excerpt,
        openGraph: {
            title: post.title,
            description: post.excerpt,
            type: "article",
            publishedTime: post.date,
            authors: post.authorDetails.map((a) => a.name),
            images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
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
    if (slug === "computing-infrastructure-global-ai-runs-on") {
        redirect("/thesis");
    }
    const post = getPostBySlug(slug);

    if (!post || !post.published) notFound();

    // Redirect changelog posts to /changelog/[slug]
    if (post.category === "changelog") {
        redirect(`/changelog/${slug}`);
    }

    const content = await parseMDX(post.content);

    // Same category first, then newest — getAllPosts is already date-desc
    // and Array.sort is stable, so each group keeps newest-first order.
    const morePosts = getAllPosts()
        .filter(
            (p) => p.published && p.slug !== slug && p.category !== "changelog",
        )
        .sort((a, b) => Number(a.category !== post.category) - Number(b.category !== post.category))
        .slice(0, 3);

    return <NewsPostView post={post} content={content} morePosts={morePosts} />;
}
