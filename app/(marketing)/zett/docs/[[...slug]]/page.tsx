import { ZettDocsPrevNext } from "@/components/zett/docs/prev-next";
import { zettMdxComponents } from "@/components/zett/docs/mdx";
import { ZettDocsToc } from "@/components/zett/docs/toc";
import { findNeighbour } from "fumadocs-core/page-tree";
import { zettSource } from "@/lib/zett-source";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export function generateStaticParams() {
  return zettSource.generateParams();
}

export async function generateMetadata(
  props: PageProps<"/zett/docs/[[...slug]]">,
): Promise<Metadata> {
  const params = await props.params;
  const page = zettSource.getPage(params.slug);
  if (!page) return {};

  const { title, description } = page.data;
  return {
    title,
    description,
    openGraph: { type: "article", title, description, siteName: "Zett" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function Page(props: PageProps<"/zett/docs/[[...slug]]">) {
  const params = await props.params;
  const page = zettSource.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;
  const neighbours = findNeighbour(zettSource.pageTree, page.url);

  return (
    <div className="flex">
      <article className="min-w-0 flex-1 px-6 py-10 sm:px-10">
        <div className="mx-auto max-w-3xl">
          {/* crop-mark framed title — echoes the /zett landing motif */}
          <div className="relative">
            <span className="pointer-events-none absolute -top-3 -left-3 select-none font-mono text-xs text-muted-foreground/30">
              +
            </span>
            <span className="pointer-events-none absolute -top-3 -right-3 select-none font-mono text-xs text-muted-foreground/30">
              +
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {page.data.title}
            </h1>
            {page.data.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {page.data.description}
              </p>
            )}
          </div>

          <div className="mt-8">
            <MDX components={zettMdxComponents} />
          </div>

          <ZettDocsPrevNext
            previous={neighbours.previous}
            next={neighbours.next}
          />
        </div>
      </article>

      <aside className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-56 shrink-0 overflow-y-auto px-6 py-10 xl:block">
        <ZettDocsToc toc={page.data.toc} />
      </aside>
    </div>
  );
}
