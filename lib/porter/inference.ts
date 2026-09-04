import { fetchWebResource } from '@/lib/web/fetch';
import { extractWebDocument } from '@/lib/web/html';

/**
 * Read a Porter's identity off the customer's own homepage.
 *
 * Setup asks for one thing, a website address, and everything else is derived from it. Before this
 * ran, a Porter was named after the registrable label in its hostname -- bolabanjo.com became
 * "Bolabanjo" -- which is a reasonable guess and often not what the business calls itself.
 *
 * Nothing here is required. Every field is optional and every failure is silent: a site that is
 * slow, blocked by robots, or simply has no metadata still produces a working Porter with the
 * hostname-derived name it had before. Provisioning must not fail because a homepage did not load.
 *
 * The fetch goes through lib/web, which re-validates DNS, refuses private address space, honours
 * robots and caps the response. That matters more here than anywhere else in the product: the URL
 * is typed by a stranger during signup, which is the textbook shape of an SSRF.
 */

const FETCH_TIMEOUT_MS = 5_000;
// Only <head> is read, but the cap applies to the whole response and a marketing homepage is
// routinely larger than it looks: stripe.com alone exceeds half a megabyte, and a cap that low
// silently produced a Porter with no name at all. The timeout, not the size, is what bounds how
// long signup can wait.
const MAX_BYTES = 3 * 1024 * 1024;

export type PorterBrand = {
    color?: string;
    logo?: string;
};

export type PorterInference = {
    name?: string;
    description?: string;
    systemPrompt?: string;
    contactEmail?: string;
    brand: PorterBrand;
};

/**
 * Read a handful of tags out of <head>.
 *
 * lib/web parses HTML properly but keeps its element list private and returns an empty metadata
 * map, and Porter needs four tags the crawler does not currently expose. Reading them here keeps
 * the crawler's behaviour unchanged -- what it stores for every page is not Porter's to alter --
 * at the cost of a small bounded scan. It looks only at <head>, so a page whose body quotes a meta
 * tag cannot rename someone's business.
 */
function readHeadTags(html: string): { meta: Map<string, string>; links: Map<string, string> } {
    const meta = new Map<string, string>();
    const links = new Map<string, string>();

    const headMatch = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
    const head = headMatch ? headMatch[1] : html.slice(0, 64_000);

    for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
        const key = (/\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '').toLowerCase();
        const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
        if (key && content && !meta.has(key)) meta.set(key, content.trim());
    }

    for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
        const rel = (/\brel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '').toLowerCase();
        const href = /\bhref\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
        if (rel && href && !links.has(rel)) links.set(rel, href.trim());
    }

    return { meta, links };
}

/** A colour is only useful if it is one CSS will accept and a person chose. */
function readBrandColor(meta: Map<string, string>): string | undefined {
    const candidate = meta.get('theme-color') || meta.get('msapplication-tilecolor');
    if (!candidate) return undefined;
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(candidate.trim()) ? candidate.trim() : undefined;
}

function absolute(href: string | undefined, base: string): string | undefined {
    if (!href) return undefined;
    try {
        return new URL(href, base).toString();
    } catch {
        return undefined;
    }
}

/** The first mailto on the page, which is usually the address a customer is meant to write to. */
function readContactEmail(html: string): string | undefined {
    const match = /mailto:([^"'?\s>]+@[^"'?\s>]+)/i.exec(html);
    const email = match?.[1]?.trim().toLowerCase();
    if (!email || email.length > 254) return undefined;
    return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email) ? email : undefined;
}

/**
 * What the Porter is told about the business, in the absence of any pages to quote from. The crawl
 * replaces the second sentence with real passages; until then this is honest about how little it
 * knows, which is why the refusal instructions matter more than the description does.
 */
function buildSystemPrompt(name: string, description: string | null, host: string): string {
    const opening = description?.trim()
        ? `You answer questions for ${name} (${host}), which describes itself this way: ${description.trim()}`
        : `You answer questions for ${name} (${host}).`;
    return [
        opening,
        'Be brief and concrete, and use plain language.',
        'If you do not know something about this business, say so and point the person at its own contact details.',
        'Never invent prices, policies, availability, delivery times, or contact details.',
    ].join(' ');
}

export async function inferPorterFromSite(siteUrl: string, host: string): Promise<PorterInference> {
    const empty: PorterInference = { brand: {} };

    try {
        const resource = await fetchWebResource(siteUrl, {
            timeoutMs: FETCH_TIMEOUT_MS,
            maxBytes: MAX_BYTES,
        });
        const document = extractWebDocument(resource);
        const { meta, links } = readHeadTags(resource.body);

        // og:site_name is the business naming itself; a <title> is usually the page, not the
        // company, so it is only worth taking when it is short enough to not be a sentence.
        const title = document.title?.trim();
        const name =
            meta.get('og:site_name')?.trim() ||
            (title && title.length <= 60 ? title.split(/\s+[|–—-]\s+/)[0].trim() : '') ||
            undefined;

        const description = document.description?.trim() || meta.get('og:description')?.trim() || null;

        return {
            name: name || undefined,
            description: description ?? undefined,
            systemPrompt: buildSystemPrompt(name || host, description, host),
            contactEmail: readContactEmail(resource.body),
            brand: {
                color: readBrandColor(meta),
                logo:
                    absolute(meta.get('og:image'), resource.finalUrl) ||
                    absolute(links.get('apple-touch-icon'), resource.finalUrl) ||
                    absolute(links.get('icon'), resource.finalUrl),
            },
        };
    } catch (error) {
        // A homepage that will not load is a worse Porter, not a failed signup.
        console.warn('[Porter inference] could not read', siteUrl, error instanceof Error ? error.message : error);
        return empty;
    }
}
