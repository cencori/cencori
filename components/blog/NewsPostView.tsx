import type { ReactNode } from "react";
import type { BlogPost } from "@/lib/blog";
import { formatBlogCategory, type BlogCardPost } from "./blog-client";
import { BlogGrid } from "./BlogGrid";

function formatMonthYear(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

interface NewsPostViewProps {
  post: BlogPost;
  /** Rendered MDX children (from parseMDX). */
  content: ReactNode;
  /** Up to 3 posts for the "More articles" section. */
  morePosts: BlogCardPost[];
}

/**
 * Stories-style article view for /newsroom/[slug].
 *
 * Mirrors app/(marketing)/stories/[slug]/page.tsx: centered meta header,
 * large title, rounded cover, relaxed body type, and a 3-up "More" grid.
 * PostView stays untouched for /changelog/[slug] and /thesis.
 */
export function NewsPostView({ post, content, morePosts }: NewsPostViewProps) {
  return (
    <main className="flex-1 pt-20">
      <article className="container mx-auto max-w-3xl px-4 pb-10 pt-4 md:py-10">
        <div className="text-center">
          <div className="flex items-center justify-center gap-6 text-xs tracking-wide text-muted-foreground">
            <span>{formatBlogCategory(post.category)}</span>
            <span>{post.readTime}</span>
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-xs tracking-wide text-muted-foreground">
            {formatMonthYear(post.date)}
          </p>
        </div>

        {/* MDX body in the stories reading rhythm. Overrides target
            top-level paragraphs/lists only so callouts, cards, code
            blocks, and tables keep their own component styles. */}
        <div className="mt-10 w-full min-w-0 text-[15px] leading-[1.65] text-primary/85 [&>ol]:text-lg [&>p]:text-lg [&>p]:leading-relaxed [&>ul]:text-lg">
          {content}
        </div>
      </article>

      {morePosts.length > 0 ? (
        <section className="container mx-auto max-w-5xl px-4 pb-20 pt-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            More articles
          </h2>
          <div className="mt-8">
            <BlogGrid posts={morePosts} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
