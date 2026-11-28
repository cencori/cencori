import Image from "next/image";
import type { ReactNode } from "react";
import type { Story } from "@/lib/stories";

/**
 * The article body shared by /stories/[slug] and /customers/[slug].
 * `beforeBody` sits between the header and the first paragraph.
 */
export function StoryArticle({ story, beforeBody }: { story: Story; beforeBody?: ReactNode }) {
  return (
    <article className="container mx-auto max-w-3xl px-4 pb-10 pt-0 md:pb-10 md:pt-0">
      <div className="text-center">
        <div className="flex items-center justify-center gap-6 text-xs tracking-wide text-muted-foreground">
          <span>{story.industry}</span>
          <span>{story.product}</span>
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {story.title}
        </h1>
        <p className="mt-4 text-xs tracking-wide text-muted-foreground">
          {new Date(`${story.publishedAt}T00:00:00`).toLocaleDateString(
            "en-US",
            { month: "long", year: "numeric" },
          )}
        </p>
      </div>

      {beforeBody ? <div className="mt-10">{beforeBody}</div> : null}

      <div className="mt-10 space-y-6 text-lg leading-relaxed">
        {story.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      {story.inlineImage ? (
        <figure className="mt-10">
          <span className="relative block aspect-[3/2] w-full overflow-hidden rounded-2xl bg-muted">
            <Image
              alt={story.inlineImage.alt}
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              src={story.inlineImage.src}
            />
          </span>
        </figure>
      ) : null}

      {story.belowImage ? (
        <div className="mt-10 space-y-6 text-lg leading-relaxed">
          {story.belowImage.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      {story.quote ? (
        <blockquote className="mt-12 text-center">
          <p className="text-2xl font-medium leading-snug tracking-tight">
            “{story.quote.text}”
          </p>
          <cite className="mt-4 block text-sm not-italic text-muted-foreground">
            {story.quote.by}
          </cite>
        </blockquote>
      ) : null}

    </article>
  );
}
