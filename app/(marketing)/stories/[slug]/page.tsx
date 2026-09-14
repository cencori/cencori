import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStories } from "@/lib/stories";
import { StoriesGrid } from "@/components/stories/StoriesGrid";

export function generateStaticParams() {
  return getStories().map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = getStories().find((s) => s.slug === slug);
  if (!story) return { title: "Story | Cencori" };
  return {
    title: `${story.company} | Cencori Stories`,
    description: story.excerpt,
  };
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = getStories().find((s) => s.slug === slug);
  if (!story) notFound();

  return (
    <main className="flex-1 pt-0 md:pt-20">
      <article className="container mx-auto max-w-3xl px-4 pb-10 pt-4 md:py-10">
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

      <section className="container mx-auto max-w-5xl px-4 pb-20 pt-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          More stories
        </h2>
        <div className="mt-8">
          <StoriesGrid
            stories={getStories()
              .filter((s) => s.slug !== story.slug)
              .slice(0, 3)}
          />
        </div>
      </section>
    </main>
  );
}
