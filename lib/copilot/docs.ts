import { promises as fs } from "node:fs";
import path from "node:path";
import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";

/**
 * Copilot's knowledge of the product: the public docs (content/docs), split
 * into sections and searched by keyword. The files ship with the Copilot
 * route (outputFileTracingIncludes in next.config.ts) and are read once per
 * server instance.
 */

const DOCS_DIR = path.join(process.cwd(), "content/docs");
const DOCS_ORIGIN = "https://cencori.com";
const EXCERPT_CHARS = 1_500;
const PAGE_CHARS = 10_000;
const RESULTS = 5;

type DocSection = { page: string; title: string; heading: string | null; text: string };
type DocPage = { url: string; title: string; description: string; text: string; sections: DocSection[] };

const STOPWORDS = new Set("a an and are as at be by can do does for from how i in is it my of on or the to what where which with you your cencori".split(" "));

export const DOCS_TOOLS: ChatCompletionFunctionTool[] = [
    {
        type: "function",
        function: {
            name: "search_docs",
            description: "Search Cencori's documentation: what the product does, its features, integrations (e.g. CostGraph, Supabase, Vercel AI SDK), the console's pages and settings, SDKs and the API, pricing and plans. Use for any 'how do I…', 'can Cencori…', 'what is…' or 'where is…' question about the product.",
            parameters: {
                type: "object",
                properties: { query: { type: "string", description: "A few keywords, e.g. 'costgraph connect' or 'spend cap budget'." } },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "read_doc",
            description: "Read one documentation page in full, by its url from search_docs, when the excerpt isn't enough.",
            parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
        },
    },
];

export const DOCS_TOOL_NAMES = new Set(DOCS_TOOLS.map((tool) => tool.function.name));
export const DOCS_TOOL_STATUS: Record<string, string> = { search_docs: "Checking the docs", read_doc: "Reading the docs" };

/** MDX to plain-ish text: no frontmatter, imports or JSX tags; markdown kept. */
function toText(source: string): string {
    return source
        .replace(/^---[\s\S]*?\n---\n/, "")
        .replace(/^(import|export) .*$/gm, "")
        .replace(/<\/?[A-Z][^>]*>/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function frontmatter(source: string, key: string): string {
    const block = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? "";
    const line = new RegExp(`^${key}:\\s*"?(.*?)"?\\s*$`, "m").exec(block);
    return line?.[1] ?? "";
}

async function walk(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return Promise.resolve(entry.name.endsWith(".mdx") ? [full] : []);
    }));
    return nested.flat();
}

let loaded: Promise<DocPage[]> | null = null;

function loadDocs(): Promise<DocPage[]> {
    loaded ??= (async () => {
        const files = await walk(DOCS_DIR);
        const pages = await Promise.all(files.map(async (file) => {
            const source = await fs.readFile(file, "utf8");
            const slug = path.relative(DOCS_DIR, file).replace(/\.mdx$/, "").replace(/(^|\/)_?index$/, "");
            const url = `/docs${slug ? `/${slug}` : ""}`;
            const title = frontmatter(source, "title") || slug;
            const text = toText(source);
            // One section per "## " heading, plus whatever comes before the first.
            const sections: DocSection[] = [];
            for (const [index, chunk] of text.split(/^## /m).entries()) {
                if (!chunk.trim()) continue;
                const heading = index === 0 ? null : chunk.split("\n")[0].trim();
                sections.push({ page: url, title, heading, text: index === 0 ? chunk.trim() : `## ${chunk.trim()}` });
            }
            return { url, title, description: frontmatter(source, "description"), text, sections };
        }));
        return pages;
    })().catch((error) => {
        loaded = null;
        throw error;
    });
    return loaded;
}

const terms = (value: string) => value.toLowerCase().split(/[^a-z0-9.+-]+/).filter((term) => term.length > 1 && !STOPWORDS.has(term));

function score(section: DocSection, description: string, words: string[]): number {
    const title = section.title.toLowerCase();
    const heading = section.heading?.toLowerCase() ?? "";
    const body = section.text.toLowerCase();
    let total = 0;
    let matched = 0;
    for (const word of words) {
        const inBody = body.split(word).length - 1;
        const hit = (title.includes(word) ? 6 : 0) + (heading.includes(word) ? 4 : 0) + (description.toLowerCase().includes(word) ? 2 : 0) + Math.min(inBody, 5);
        if (hit) matched++;
        total += hit;
    }
    // Sections that match every word beat ones that repeat a single word.
    return total * (matched / words.length);
}

export async function runDocsTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const pages = await loadDocs();
    if (name === "read_doc") {
        const url = String(args.url ?? "").replace(DOCS_ORIGIN, "").split("#")[0].replace(/\/$/, "");
        const page = pages.find((item) => item.url === url);
        if (!page) return { error: `No docs page at ${url}. Use search_docs to find one.` };
        return { url: `${DOCS_ORIGIN}${page.url}`, title: page.title, text: page.text.slice(0, PAGE_CHARS) };
    }
    const words = terms(String(args.query ?? ""));
    if (!words.length) return { error: "Say what to look for." };
    const ranked = pages
        .flatMap((page) => page.sections.map((section) => ({ section, page, score: score(section, page.description, words) })))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, RESULTS);
    if (!ranked.length) return { results: [], note: "Nothing in the docs matches. Say so plainly rather than guessing." };
    return {
        results: ranked.map(({ section, page }) => ({
            url: `${DOCS_ORIGIN}${page.url}${section.heading ? `#${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : ""}`,
            page: page.title,
            section: section.heading,
            excerpt: section.text.slice(0, EXCERPT_CHARS),
        })),
    };
}
