import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getStories, storyHref } from "@/lib/stories";
import { StoriesGrid } from "@/components/stories/StoriesGrid";
import { StoryArticle } from "@/components/stories/StoryArticle";

export function generateStaticParams() {
  return getStories("customer").map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = getStories("customer").find((s) => s.slug === slug);
  if (!story) return { title: "Customer | Cencori" };
  return {
    title: `${story.company} | Cencori Customers`,
    description: story.excerpt,
  };
}

/** A customer case study: the same article as a story, with who they are and what they use above the story. */
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = getStories().find((s) => s.slug === slug);
  if (!story) notFound();
  // Stories about people and the ecosystem live at /stories/[slug].
  if (story.kind !== "customer") permanentRedirect(storyHref(story));

  const facts = [
    { label: "Company", value: story.company },
    { label: "Industry", value: story.industry },
    { label: "Use case", value: story.useCase },
    { label: "Built on", value: (story.uses ?? [story.product]).join(", ") },
  ];
  const others = getStories("customer").filter((s) => s.slug !== story.slug);

  return (
    <main className="flex-1 pt-20 md:pt-28">
      <StoryArticle
        story={story}
        beforeBody={
          <div className="relative border border-border/40 bg-foreground/[0.03]">
            {/* A + on each corner, centred on the border, like a logo sheet. */}
            {["-left-[6px] -top-[6px]", "-right-[6px] -top-[6px]", "-bottom-[6px] -left-[6px]", "-bottom-[6px] -right-[6px]"].map((corner) => (
              <span aria-hidden className={`pointer-events-none absolute h-[11px] w-[11px] ${corner}`} key={corner}>
                <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-foreground/60" />
                <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-foreground/60" />
              </span>
            ))}
            {/* Lines between columns: two per row on phones, four in a row above. */}
            <dl className="grid grid-cols-2 sm:grid-cols-4">
              {facts.map((fact, index) => (
                <div
                  className={[
                    "border-border/40 p-6 text-center",
                    index % 2 === 1 ? "border-l" : "",
                    index >= 2 ? "border-t sm:border-t-0" : "",
                    index === 2 ? "sm:border-l" : "",
                  ].join(" ")}
                  key={fact.label}
                >
                  <dt className="text-xs tracking-wide text-muted-foreground">{fact.label}</dt>
                  {/* One line; a long list scrolls sideways with no scrollbar. */}
                  <dd className="no-scrollbar mt-1 overflow-x-auto whitespace-nowrap text-sm">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        }
      />


      {others.length > 0 ? (
        <section className="container mx-auto max-w-5xl px-4 pb-20">
          <h2 className="text-2xl font-semibold tracking-tight">More customers</h2>
          <div className="mt-8">
            <StoriesGrid stories={others.slice(0, 3)} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
