import { crawlWeb } from '@/lib/web/crawl';
import { createWebDataStore } from '@/lib/web/store';
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
        const store = createWebDataStore(supabase);
        const searchOptions = {
            limit: RETRIEVAL_LIMIT,
            // Scoped to the Porter's own site, not merely to its project. search_cencori_web_v2
            // also matches public documents from unrelated crawls -- a search of one customer's
            // project for "stripe" returned a GitHub Docs page -- and a Porter citing somebody
            // else's website would be worse than a Porter that says it does not know.
            domain: host,
            freshAfter: null,
            language: null,
            queryEmbedding: null,
        };

        // The store searches full text, which requires every term to match, so a whole question
        // finds nothing while its subject alone finds plenty. Ask with the question first, since a
        // full match is the best match, then fall back to just the words that carry meaning.
        let rows = await store.searchDocuments(projectId, query, searchOptions);
        if (rows.length === 0) {
            const reduced = keywordsOf(query);
            if (reduced && reduced !== query) {
                rows = await store.searchDocuments(projectId, reduced, searchOptions);
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
