import { crawlWeb } from '@/lib/web/crawl';
import { createWebDataStore } from '@/lib/web/store';
import { fetchWebResource } from '@/lib/web/fetch';
import { extractWebDocument } from '@/lib/web/html';
import { indexWebDocument } from '@/lib/web/index';
import { parseSitemap } from '@/lib/web/sitemap';
import { normalizePorterHost, normalizePorterUrl } from '@/lib/porter/urls';
import type { createAdminClient } from '@/lib/supabaseAdmin';

/**
 * Reading a Porter's site, and answering out of what was read.
 *
 * The crawler, the store and the ranked retrieval already exist and are used by /v1/web. Nothing
 * here reimplements them: a Porter's knowledge is an ordinary project-scoped web collection, which
 * is why it inherits robots handling, canonicalisation, content hashing and recrawl scheduling for
 * free. What this adds is the two ends -- when a Porter is allowed to start answering, and what it
 * is given to answer with.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

/** A first read is deliberately shallow. Depth and breadth are what the paid plans buy. */
const CRAWL_MAX_PAGES = 25;
const CRAWL_MAX_DEPTH = 2;

/**
 * A Porter promises a weekly refresh, so its pages come due seven days after they were last read.
 * The public corpus schedules itself by how often a page changes; a customer's own site is a
 * product promise rather than an estimate, and one interval is easier to explain than four.
 */
const RECRAWL_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** One sweep should not spend an hour on one large site while every other Porter waits. */
const RECRAWL_BATCH = 40;

/** Enough context to answer from, small enough to leave the model room to be brief. */
const RETRIEVAL_LIMIT = 5;
const PASSAGE_CHARS = 1200;

export type PorterCrawlSummary = {
    indexed: number;
    skipped: number;
    failed: number;
    pages: { url: string; status: string; error?: string }[];
};

export type PorterPassage = {
    title: string;
    url: string;
    content: string;
};

/**
 * The words in a question that a full-text index can actually use. Everything a question is made of
 * -- how, what, does, your, the -- appears in no document and excludes every one of them.
 */
const STOPWORDS = new Set([
    'a', 'about', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'by', 'can', 'could',
    'did', 'do', 'does', 'for', 'from', 'get', 'give', 'had', 'has', 'have', 'how', 'i', 'if', 'in',
    'is', 'it', 'its', 'me', 'much', 'my', 'of', 'on', 'or', 'our', 'please', 'she', 'should', 'so',
    'some', 'tell', 'that', 'the', 'their', 'there', 'they', 'this', 'to', 'was', 'we', 'were',
    'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your',
]);

function keywordsOf(query: string): string {
    const words = query
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1 && !STOPWORDS.has(word));
    // Beyond a handful of terms the AND semantics start excluding documents again.
    return words.slice(0, 4).join(' ');
}

function text(row: Record<string, unknown>, key: string): string {
    const value = row[key];
    return typeof value === 'string' ? value : '';
}

/**
 * Read the site and, if anything came back, let the Porter start answering.
 *
 * enabled is the whole point of this function. A Porter that answers before its pages exist has
 * only its own description to work from, which produces confident answers about a business nobody
 * has read -- worse than admitting it is not ready. So the flag is set here and nowhere else, and
 * only when at least one page was indexed.
 */
export async function readPorterSite(
    supabase: AdminClient,
    porter: { id: string; organization_id: string; project_id: string; source_url: string },
): Promise<PorterCrawlSummary> {
    const result = await crawlWeb(
        { supabase, organizationId: porter.organization_id, projectId: porter.project_id },
        {
            seeds: [porter.source_url],
            maxPages: CRAWL_MAX_PAGES,
            maxDepth: CRAWL_MAX_DEPTH,
            sameOrigin: true,
        },
    );

    const pages = result.pages ?? [];
    const indexed = pages.filter(page => page.status === 'indexed').length;
    const skipped = pages.filter(page => page.status === 'skipped').length;
    const failed = pages.length - indexed - skipped;

    if (indexed > 0) {
        await scheduleNextRefresh(supabase, porter.project_id);
        await supabase
            .from('porters')
            .update({
                // indexWebDocument files project pages under this collection, and one Porter per
                // project means it is that Porter's collection too.
                collection_id: `project:${porter.project_id}`,
                enabled: true,
            })
            .eq('id', porter.id);
    }

    return { indexed, skipped, failed, pages };
}

/** What a customer is shown before anything is read, so they can say what not to read. */
export type DiscoveredLinks = {
    total: number;
    /** Grouped by first path segment, because "87 pages under /docs" is a decision and 87 URLs is not. */
    groups: { path: string; urls: string[] }[];
    source: 'sitemap' | 'homepage';
    /** Discovery stopped at its request, page, or time budget. */
    truncated?: boolean;
};

/**
 * Find out what a site contains without reading any of it.
 *
 * Crawling first and asking afterwards spends a customer's page allowance on whatever the crawler
 * happened to reach. A sitemap is the site telling us what it thinks it has, so it is tried first;
 * a site without one falls back to the links on its homepage, which is worse but is what there is.
 *
 * Nothing is indexed here and nothing is written. This is a question, not a crawl.
 */
export async function discoverPorterLinks(host: string): Promise<DiscoveredLinks> {
    const origin = `https://${host}`;
    let urls: string[] = [];
    let source: DiscoveredLinks['source'] = 'sitemap';
    const deadline = Date.now() + 32_000;
    const pending = [`${origin}/sitemap.xml`];
    const visited = new Set<string>();
    const normalize = (value: string, base: string) => {
        const url = normalizePorterUrl(new URL(value, base).toString(), host);
        if (!url) throw new Error('Sitemap URL is outside the Porter site');
        return url;
    };

    while (pending.length && visited.size < 8 && urls.length < 2_000 && Date.now() < deadline) {
        const url = pending.shift()!;
        const canonical = normalize(url, origin);
        if (visited.has(canonical)) continue;
        visited.add(canonical);
        try {
            const sitemap = await fetchWebResource(url, { timeoutMs: Math.min(8_000, deadline - Date.now()) });
            for (const entry of parseSitemap(sitemap.body, url, 2_000, normalize)) {
                if (entry.kind === 'sitemap') {
                    if (!visited.has(entry.url) && !pending.includes(entry.url)) pending.push(entry.url);
                } else if (urls.length < 2_000) {
                    urls.push(entry.url);
                }
            }
        } catch {
            // A failed child must not discard pages discovered in other sitemaps.
        }
    }
    const truncated = pending.length > 0 || urls.length >= 2_000;

    if (urls.length === 0) {
        source = 'homepage';
        try {
            const home = extractWebDocument(await fetchWebResource(origin, { timeoutMs: 8_000 }));
            urls = home.links.map(link => link.url);
        } catch {
            urls = [];
        }
    }

    // Only this site, only pages, and each address once.
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const raw of urls) {
        const clean = normalizePorterUrl(raw, host);
        if (!clean) continue;
        const url = new URL(clean);
        if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|pdf|zip|mp4|woff2?|xml|gz)$/i.test(url.pathname)) continue;
        if (seen.has(clean)) continue;
        seen.add(clean);
        kept.push(clean);
    }

    const groups = new Map<string, string[]>();
    for (const url of kept) {
        const segment = new URL(url).pathname.split('/').filter(Boolean)[0];
        const key = segment ? `/${segment}` : '/';
        const bucket = groups.get(key);
        if (bucket) bucket.push(url);
        else groups.set(key, [url]);
    }

    return {
        total: kept.length,
        source,
        truncated,
        groups: Array.from(groups.entries())
            .map(([path, groupUrls]) => ({ path, urls: groupUrls }))
            .sort((a, b) => b.urls.length - a.urls.length),
    };
}

/**
 * Read exactly these pages.
 *
 * crawlWeb follows links from a handful of seeds, which is right when nobody has said what they
 * want. Once a customer has chosen, following links would read pages they unchecked -- so this
 * fetches the list and nothing else.
 */
export async function readPorterPages(
    supabase: AdminClient,
    porter: { id: string; organization_id: string; project_id: string },
    urls: string[],
): Promise<PorterCrawlSummary> {
    const store = createWebDataStore(supabase);
    const pages: PorterCrawlSummary['pages'] = [];

    for (const url of urls.slice(0, CRAWL_MAX_PAGES)) {
        try {
            const document = extractWebDocument(await fetchWebResource(url));
            if (document.content.length < 20) {
                pages.push({ url, status: 'skipped', error: 'Page did not contain enough indexable text' });
                continue;
            }
            await indexWebDocument(store, porter.organization_id, porter.project_id, document);
            pages.push({ url, status: 'indexed' });
        } catch (error) {
            pages.push({ url, status: 'failed', error: error instanceof Error ? error.message : 'Could not read the page' });
        }
    }

    const indexed = pages.filter(page => page.status === 'indexed').length;

    if (indexed > 0) {
        await scheduleNextRefresh(supabase, porter.project_id);
        await supabase
            .from('porters')
            .update({ collection_id: `project:${porter.project_id}`, enabled: true })
            .eq('id', porter.id);
    }

    return {
        indexed,
        skipped: pages.filter(page => page.status === 'skipped').length,
        failed: pages.filter(page => page.status === 'failed').length,
        pages,
    };
}

/**
 * Put this project's pages in the queue for a refresh a week from now.
 *
 * indexWebDocument leaves next_crawl_at null -- the public indexer sets one and the project indexer
 * does not -- so without this a Porter's pages are read once and never looked at again, and the
 * weekly refresh is a promise with no mechanism behind it.
 */
export async function scheduleNextRefresh(supabase: AdminClient, projectId: string): Promise<void> {
    const { error } = await supabase
        .from('web_documents')
        .update({ next_crawl_at: new Date(Date.now() + RECRAWL_INTERVAL_MS).toISOString() })
        .eq('project_id', projectId)
        .eq('visibility', 'project');

    if (error) console.warn('[Porter] could not schedule refresh', error.message);
}

export type PorterRefreshSummary = {
    checked: number;
    changed: number;
    unchanged: number;
    failed: number;
    /** Selected due pages left untouched when the run's time budget ended. */
    deferred: number;
};

export class PorterRefreshError extends Error {
    constructor(message: string, public readonly summary: PorterRefreshSummary) {
        super(message);
        this.name = 'PorterRefreshError';
    }
}

/**
 * Re-read the pages that have come due.
 *
 * This is deliberately not the public recrawl sweep. That one hands its work to a public crawl job,
 * which re-indexes whatever it fetches as a public document -- pointing it at project pages would
 * move a customer's site into the shared corpus. Re-reading here keeps every page in the collection
 * it belongs to.
 *
 * A page whose readable text has not moved is not written again. Nothing embeds documents yet, so
 * today that saves a write; when embeddings arrive it is the difference between refreshing a
 * thousand-page site and re-embedding it.
 *
 * The comparison is on the extracted text rather than web_documents.content_hash, which is a sha256
 * of the raw response bytes. On any modern site that hash moves on every fetch -- nonces, CSRF
 * tokens, cache-busting asset URLs -- so using it would report every page as changed forever and
 * quietly make this whole function a no-op with extra steps. Measured on two Stripe pages: the raw
 * hash differed across back-to-back fetches; the extracted text was identical.
 */
export async function refreshPorterKnowledge(
    supabase: AdminClient,
    porter: { id: string; organization_id: string; project_id: string },
    limit = RECRAWL_BATCH,
    options: { deadlineMs?: number } = {},
): Promise<PorterRefreshSummary> {
    const summary: PorterRefreshSummary = { checked: 0, changed: 0, unchanged: 0, failed: 0, deferred: 0 };

    const { data: due, error: queryError } = await supabase
        .from('web_documents')
        .select('id, canonical_url, content, porter_knowledge_documents!inner(porter_id)')
        .eq('porter_knowledge_documents.porter_id', porter.id)
        .eq('project_id', porter.project_id)
        .eq('visibility', 'project')
        .not('next_crawl_at', 'is', null)
        .lte('next_crawl_at', new Date().toISOString())
        .order('next_crawl_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);

    if (queryError) {
        throw new PorterRefreshError(`Could not list due Porter pages: ${queryError.message}`, summary);
    }
    if (!due || due.length === 0) return summary;

    const store = createWebDataStore(supabase);
    const nextCrawlAt = new Date(Date.now() + RECRAWL_INTERVAL_MS).toISOString();

    for (const row of due) {
        if (options.deadlineMs !== undefined && Date.now() >= options.deadlineMs) {
            summary.deferred = due.length - summary.checked;
            break;
        }
        summary.checked += 1;
        try {
            const resource = await fetchWebResource(String(row.canonical_url), {
                timeoutMs: options.deadlineMs === undefined
                    ? undefined
                    : Math.min(15_000, options.deadlineMs - Date.now()),
            });
            const document = extractWebDocument(resource);

            if (document.content === row.content) {
                summary.unchanged += 1;
            } else {
                await indexWebDocument(store, porter.organization_id, porter.project_id, document);
                summary.changed += 1;
            }
        } catch (error) {
            // A page that has moved or gone is not a reason to abandon the rest of the site. It is
            // simply looked at again next week, which is also how a temporary outage resolves.
            summary.failed += 1;
            console.warn('[Porter] refresh failed for', row.canonical_url, error instanceof Error ? error.message : error);
        }

        // Reschedule whatever happened, so one unreachable page cannot be retried on every sweep.
        const { error: scheduleError } = await supabase
            .from('web_documents')
            .update({ next_crawl_at: nextCrawlAt })
            .eq('id', row.id)
            .eq('project_id', porter.project_id)
            .eq('visibility', 'project');
        if (scheduleError) {
            summary.deferred = due.length - summary.checked;
            throw new PorterRefreshError(`Could not reschedule Porter page: ${scheduleError.message}`, summary);
        }
    }

    return summary;
}

/**
 * Find passages worth answering from.
 *
 * Retrieval is fail-open in the same way memory is: a Porter that cannot reach its own pages should
 * answer worse, not fail. The caller receives an empty list and the prompt tells the model to
 * decline rather than guess.
 */
export async function findPorterPassages(
    supabase: AdminClient,
    projectId: string,
    query: string,
    host: string,
): Promise<PorterPassage[]> {
    try {
        const search = async (question: string): Promise<Record<string, unknown>[]> => {
            const { data, error } = await supabase.rpc('search_porter_knowledge', {
                p_project_id: projectId,
                p_query: question,
                p_host: normalizePorterHost(host),
                p_limit: RETRIEVAL_LIMIT,
            });
            if (error) throw new Error(error.message);
            return (data ?? []) as Record<string, unknown>[];
        };

        // The store searches full text, which requires every term to match, so a whole question
        // finds nothing while its subject alone finds plenty. Ask with the question first, since a
        // full match is the best match, then fall back to just the words that carry meaning.
        let rows = await search(query);
        if (rows.length === 0) {
            const reduced = keywordsOf(query);
            if (reduced && reduced !== query) {
                rows = await search(reduced);
            }
        }

        // The ranked search returns a snippet, not the stored document body. Reading the wrong key
        // here is silent: every passage looks empty, the filter drops all of them, and the Porter
        // reports that it has no pages while sitting on two dozen of them.
        return rows
            .map(row => ({
                title: text(row, 'title'),
                url: text(row, 'canonical_url') || text(row, 'url'),
                content: (text(row, 'snippet') || text(row, 'content')).slice(0, PASSAGE_CHARS),
            }))
            .filter(passage => passage.url && passage.content);
    } catch (error) {
        console.warn('[Porter] retrieval failed', error instanceof Error ? error.message : error);
        return [];
    }
}

/**
 * Turn passages into something the model can cite.
 *
 * Each passage is numbered and carries its own URL, so "say where you got it" is an instruction the
 * model can actually follow. Without the URLs it can only claim, and a support answer that cannot
 * be checked is the thing this product exists to avoid.
 */
export function buildGroundedPrompt(basePrompt: string, passages: PorterPassage[]): string {
    if (passages.length === 0) {
        return [
            basePrompt,
            'You have no pages from this website to draw on right now.',
            'Do not guess. Say you cannot confirm the detail and point the person at the business directly.',
        ].join('\n\n');
    }

    const sources = passages
        .map((passage, index) => `[${index + 1}] ${passage.title || passage.url}\n${passage.url}\n${passage.content}`)
        .join('\n\n');

    return [
        basePrompt,
        'Answer only from the pages below. If they do not cover the question, say so plainly rather than guessing.',
        'Cite the pages you used by their number, like [1].',
        `Pages from this website:\n\n${sources}`,
    ].join('\n\n');
}
