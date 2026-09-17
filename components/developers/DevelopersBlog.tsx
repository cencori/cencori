import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { getAllPosts, getPostUrl } from "@/lib/blog";

export function DevelopersBlog() {
  const posts = getAllPosts().slice(0, 3);

  return (
    <section className="relative px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-medium tracking-tight text-muted-foreground">
            News
          </h2>
          <Link
            href="/developers/blog"
            className="inline-flex items-center gap-1 text-[15px] font-medium text-white transition-colors hover:text-white/70"
          >
            View all
            <ChevronRight className="size-4" strokeWidth={2.2} />
          </Link>
        </div>
        <div className="mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
          {posts.map((post) => (
            <Link key={post.slug} href={getPostUrl(post)} className="group block w-[80vw] max-w-[340px] shrink-0 snap-start sm:w-auto sm:max-w-none">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/5">
                {post.coverImage ? (
                  <Image
                    alt={post.title}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    src={post.coverImage}
                  />
                ) : null}
              </div>
              <h3 className="mt-5 line-clamp-2 text-[17px] leading-snug font-medium tracking-tight text-white">
                {post.title}
              </h3>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {format(new Date(post.date), "MMM d, yyyy")}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
