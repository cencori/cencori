import type { source } from "@/lib/source";

type DocsPage = NonNullable<ReturnType<typeof source.getPage>>;

/**
 * Plain-markdown rendering of a docs page, served at `<page url>.md` for agents
 * and the "View as Markdown" menu item. The MDX source carries frontmatter the
 * reader doesn't need, so it's swapped for a title + description header.
 */
export async function pageMarkdown(page: Pick<DocsPage, "url" | "data">): Promise<Response> {
  const raw = await page.data.getText("raw");
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trimStart();
  const header = [`# ${page.data.title}`, page.data.description].filter(Boolean).join("\n\n");

  return new Response(`${header}\n\n${body}`, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
