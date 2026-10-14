import { notFound } from "next/navigation";
import { source } from "@/lib/source";
import { pageMarkdown } from "@/lib/docs/page-markdown";

// Reached via the `/docs/:path+.md` rewrite in next.config.ts. Prerendered at
// build time: getText("raw") reads the .mdx from disk, which isn't traced into
// the serverless bundle.
export const dynamic = "force-static";

export function generateStaticParams() {
  return source.generateParams().filter((p) => p.slug.length > 0);
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  return pageMarkdown(page);
}
