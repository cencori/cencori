import Image from "next/image";
import Link from "next/link";
import type { Story } from "@/lib/stories";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function StoriesGrid({ stories }: { stories: Story[] }) {
  if (stories.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-lg font-semibold">First stories are being written.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Teams are building and running AI on Cencori right now. Their stories
          will live here.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-foreground px-5 text-sm text-background"
          href="/contact"
        >
          Build with us
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-3">
      {stories.map((story) => (
        <Link className="group block" href={`/stories/${story.slug}`} key={story.slug}>
          <span className="relative block aspect-square w-full overflow-hidden rounded-xl bg-muted">
            <Image
              alt={`${story.company} cover`}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              src={story.cover}
            />
          </span>
          <span className="mt-5 block text-xl font-medium leading-snug tracking-tight">
            {story.title}
          </span>
          <span className="mt-3 flex items-center gap-4 text-base normal-case text-muted-foreground">
            <span className="text-foreground">{story.industry}</span>
            <span>{formatDate(story.publishedAt)}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
