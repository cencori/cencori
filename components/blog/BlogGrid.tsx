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

export function BlogGrid({ posts }: { posts: BlogCardPost[] }) {
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
    <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-3">
      {posts.map((post) => (
        <Link
          className="group block"
          href={getBlogPostUrl(post)}
          key={post.slug}
        >
          <span className="relative block aspect-square w-full overflow-hidden rounded-xl bg-muted">
            <Image
              alt={post.title}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              src={post.coverImage || `/newsroom/og/v1/${post.slug}.jpg`}
              unoptimized
            />
          </span>
          <span className="mt-5 block text-xl font-medium leading-snug tracking-tight">
            {post.title}
          </span>
          <span className="mt-3 flex items-center gap-4 text-base normal-case text-muted-foreground">
            <span className="text-foreground">{formatBlogCategory(post.category)}</span>
            <span>{formatDate(post.date)}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
