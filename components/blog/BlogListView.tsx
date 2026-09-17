import Image from "next/image";
import Link from "next/link";
import { formatBlogCategory, getBlogPostUrl, type BlogCardPost } from "./blog-client";

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BlogListView({ posts }: { posts: BlogCardPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-lg font-semibold">No articles found.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try a different combination of filters.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border/40">
      {posts.map((post) => (
        <Link
          className="group flex gap-5 py-6 first:pt-0 last:pb-0"
          href={getBlogPostUrl(post)}
          key={post.slug}
        >
          <span className="relative hidden h-24 w-40 shrink-0 overflow-hidden rounded-lg bg-muted sm:block">
            <Image
              alt={post.title}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              fill
              sizes="160px"
              src={post.coverImage || `/newsroom/og/v1/${post.slug}.jpg`}
              unoptimized
            />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-medium leading-snug tracking-tight">
              {post.title}
            </span>
            {post.excerpt ? (
              <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                {post.excerpt}
              </span>
            ) : null}
            <span className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="text-foreground">
                {formatBlogCategory(post.category)}
              </span>
              <span>{formatDate(post.date)}</span>
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
