"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";

type LatestPost = {
  slug: string;
  title: string;
  date: string;
  coverImage: string | null;
  url: string;
};

export function GatewayBlog() {
  const [posts, setPosts] = useState<LatestPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/blog/latest")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.posts) setPosts(data.posts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="relative px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-medium tracking-tight text-muted-foreground">
            News
          </h2>
          <Link
            href="/newsroom"
            className="inline-flex items-center gap-1 text-[15px] font-medium text-white transition-colors hover:text-white/70"
          >
            View all
            <ChevronRight className="size-4" strokeWidth={2.2} />
          </Link>
        </div>
        <div className="mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
          {(posts ?? [null, null, null]).map((post, i) => (
            <div
              key={post?.slug ?? `skeleton-${i}`}
              className="group block w-[80vw] max-w-[340px] shrink-0 snap-start sm:w-auto sm:max-w-none"
            >
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/5">
                {post?.coverImage ? (
                  <Image
                    alt={post.title}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    src={post.coverImage}
                  />
                ) : null}
              </div>
              {post ? (
                <Link href={post.url}>
                  <h3 className="mt-5 line-clamp-2 text-[17px] leading-snug font-medium tracking-tight text-white">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-[15px] text-muted-foreground">
                    {format(new Date(post.date), "MMM d, yyyy")}
                  </p>
                </Link>
              ) : (
                <>
                  <div className="mt-5 h-5 w-4/5 rounded bg-white/5" />
                  <div className="mt-2 h-4 w-2/5 rounded bg-white/5" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
