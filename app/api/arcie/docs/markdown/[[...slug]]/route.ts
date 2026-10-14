import { notFound } from "next/navigation";
import { arcieSource } from "@/lib/arcie-source";
import { pageMarkdown } from "@/lib/docs/page-markdown";

// Reached via the `/arcie/docs.md` and `/arcie/docs/:path+.md` rewrites in
// next.config.ts (the index page lives at /arcie/docs, hence the optional
// catch-all). See app/api/docs/markdown for why this is prerendered.
export const dynamic = "force-static";

export function generateStaticParams() {
  return arcieSource.generateParams();
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const page = arcieSource.getPage((await params).slug);
  if (!page) notFound();
  return pageMarkdown(page);
}
