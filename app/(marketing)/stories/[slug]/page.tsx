import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getStories, storyHref } from "@/lib/stories";
import { StoriesGrid } from "@/components/stories/StoriesGrid";
import { StoryArticle } from "@/components/stories/StoryArticle";

export function generateStaticParams() {
  return getStories("story").map((story) => ({ slug: story.slug }));
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
  // Customers live at /customers/[slug]; old links to them land there.
  if (story.kind !== "story") permanentRedirect(storyHref(story));

  return (
    <main className="flex-1 pt-20 md:pt-28">
      <StoryArticle story={story} />

      <section className="container mx-auto max-w-5xl px-4 pb-20 pt-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          More stories
        </h2>
        <div className="mt-8">
          <StoriesGrid
            stories={getStories("story")
              .filter((s) => s.slug !== story.slug)
              .slice(0, 3)}
          />
        </div>
      </section>
    </main>
  );
}
