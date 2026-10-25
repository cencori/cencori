/**
 * Web pages as agent knowledge: one URL, every page in a sitemap, or a whole
 * website. Imports of more than one page go through a queue (knowledge_sources
 * rows with status 'queued') so no single request has to read hundreds of
 * pages. The queue is worked by the Knowledge page while it's open and by the
 * knowledge-refresh cron for everything else. A website import is crawled
 * through the same queue: each page read queues its same-site links until the
 * import's page limit is reached.
 *
 * All fetching goes through fetchWebResource, which refuses private and
 * internal addresses and honours robots.txt.
 */

import { randomUUID } from 'node:crypto';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { checksumText } from './knowledge';
import { ingestSourceText } from './knowledge-ingest';

type Admin = ReturnType<typeof createAdminClient>;

/** Most pages one sitemap or website import may add. */
export const WEB_IMPORT_MAX_PAGES = 500;
export const WEB_IMPORT_DEFAULT_PAGES = 100;
/** Auto-refreshed pages are re-read at most this often. */
export const WEB_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Pages read at once: polite to the sites, quick enough to watch. */
const CONCURRENCY = 4;
/** A page "processing" longer than this was dropped by a crashed worker. */
const STUCK_AFTER_MS = 10 * 60 * 1000;
/** Links to these are never pages worth reading. */
const SKIP_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|mjs|json|xml|zip|gz|tar|rar|7z|mp3|mp4|mov|avi|webm|woff2?|ttf|eot|pdf|docx?|xlsx?|pptx?)(?:$|[?#])/i;

export type WebImportKind = 'single' | 'sitemap' | 'website';

/** Stored on every page a sitemap or website import queues. */
export interface WebImportMeta {
    import_id: string;
    import_kind: Exclude<WebImportKind, 'single'>;
    import_root: string;
    pattern: string | null;
    exclude: string[];
    max_pages: number;
}

type SourceRow = { id: string; knowledge_base_id: string; content_ref: string | null; checksum: string | null; metadata: Record<string, unknown> | null };

/**
 * `*` matches anything, everything else is literal; matched against the whole
 * URL, so `*\/blog/*` keeps blog pages on any host.
 */
export function globToRegExp(pattern: string): RegExp {
    const escaped = pattern.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
}

export function urlAllowed(url: string, opts: { pattern?: string | null; exclude?: string[] }): boolean {
    if (opts.pattern?.trim() && !globToRegExp(opts.pattern).test(url)) return false;
    return !(opts.exclude ?? []).some((item) => item.trim() && globToRegExp(item).test(url));
}

/** One public web page as plain text, plus its links for crawling. */
export async function readWebPage(url: string) {
    const { fetchWebResource } = await import('@/lib/web/fetch');
    const { extractWebDocument } = await import('@/lib/web/html');
    const resource = await fetchWebResource(url);
    const document = extractWebDocument(resource);
    if (document.content.trim().length < 20) throw new Error('That page has no readable text.');
    const host = (() => { try { return new URL(resource.finalUrl).hostname; } catch { return resource.finalUrl; } })();
    return {
        url: resource.finalUrl,
        title: (document.title?.trim() || host).slice(0, 200),
        text: document.content,
        mime: resource.mimeType,
        bytes: resource.bytes,
        links: document.links.filter((link) => !link.rel.includes('nofollow')).map((link) => link.url),
    };
}

/**
 * Page URLs listed in a site's sitemap. Takes a sitemap URL or any page on
 * the site (then robots.txt sitemaps, then /sitemap.xml), and follows nested
 * sitemap indexes a little way.
 */
export async function discoverSitemapPages(input: string, opts: { pattern?: string | null; max: number }): Promise<string[]> {
    const { fetchWebResource } = await import('@/lib/web/fetch');
    const { parseSitemap, looksLikeSitemap } = await import('@/lib/web/sitemap');
    const { getRobotsSitemaps } = await import('@/lib/web/robots');
    const { normalizeWebUrl } = await import('@/lib/web/url');

    const start = normalizeWebUrl(input);
    const candidates = /\.xml(?:\.gz)?(?:$|[?#])/i.test(start)
        ? [start]
        : [...(await getRobotsSitemaps(start).catch(() => [] as string[])), new URL('/sitemap.xml', start).toString()];

    const pages: string[] = [];
    const seen = new Set<string>();
    const sitemaps = [...new Set(candidates)];
    let fetched = 0;
    let lastError: unknown = null;
    while (sitemaps.length > 0 && pages.length < opts.max && fetched < 25) {
        const next = sitemaps.shift()!;
        fetched++;
        try {
            const resource = await fetchWebResource(next);
            if (!looksLikeSitemap(resource.finalUrl, resource.mimeType, resource.body)) continue;
            for (const entry of parseSitemap(resource.body, resource.finalUrl)) {
                if (entry.kind === 'sitemap') {
                    if (!seen.has(entry.url)) { seen.add(entry.url); sitemaps.push(entry.url); }
                } else if (!seen.has(entry.url) && !SKIP_EXTENSIONS.test(entry.url) && urlAllowed(entry.url, { pattern: opts.pattern })) {
                    seen.add(entry.url);
                    pages.push(entry.url);
                    if (pages.length >= opts.max) break;
                }
            }
        } catch (error) {
            lastError = error;
        }
    }
    if (pages.length === 0) {
        if (lastError instanceof Error) throw new Error(`Couldn't read a sitemap for that site: ${lastError.message}`);
        throw new Error(opts.pattern?.trim() ? 'No sitemap pages match that pattern.' : "Couldn't find a sitemap for that site.");
    }
    return pages;
}

/** Queue pages the base doesn't already have. Returns how many were queued. */
export async function queueWebPages(db: Admin, opts: { knowledgeBaseId: string; urls: string[]; meta: WebImportMeta | null; autoRefresh: boolean }): Promise<number> {
    const urls = [...new Set(opts.urls)];
    if (urls.length === 0) return 0;
    const known = new Set<string>();
    for (let index = 0; index < urls.length; index += 100) {
        const { data } = await db.from('knowledge_sources').select('content_ref').eq('knowledge_base_id', opts.knowledgeBaseId).in('content_ref', urls.slice(index, index + 100));
        for (const row of (data ?? []) as Array<{ content_ref: string | null }>) if (row.content_ref) known.add(row.content_ref);
    }
    const rows = urls.filter((url) => !known.has(url)).map((url) => ({
        knowledge_base_id: opts.knowledgeBaseId,
        source_type: 'url',
        mime: 'text/html',
        status: 'queued',
        content_ref: url,
        metadata: { name: url.replace(/^https?:\/\//, ''), url, auto_refresh: opts.autoRefresh, ...(opts.meta ?? {}) },
    }));
    for (let index = 0; index < rows.length; index += 100) {
        const { error } = await db.from('knowledge_sources').insert(rows.slice(index, index + 100));
        if (error) throw new Error(error.message);
    }
    return rows.length;
}

export function newImportMeta(kind: WebImportMeta['import_kind'], root: string, opts: { pattern?: string | null; exclude?: string[]; maxPages?: number }): WebImportMeta {
    return {
        import_id: randomUUID(),
        import_kind: kind,
        import_root: root,
        pattern: opts.pattern?.trim() || null,
        exclude: (opts.exclude ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 20),
        max_pages: Math.min(Math.max(Math.floor(opts.maxPages ?? WEB_IMPORT_DEFAULT_PAGES), 1), WEB_IMPORT_MAX_PAGES),
    };
}

/** For a website import, queue the page's same-site links while the import has room. */
async function followLinks(db: Admin, source: SourceRow, links: string[]) {
    const meta = source.metadata as unknown as WebImportMeta;
    let origin: string;
    try { origin = new URL(meta.import_root).origin; } catch { return; }
    const candidates = [...new Set(links.map((link) => link.split('#')[0]))]
        .filter((link) => {
            try { return new URL(link).origin === origin; } catch { return false; }
        })
        .filter((link) => !SKIP_EXTENSIONS.test(link) && urlAllowed(link, { pattern: meta.pattern, exclude: meta.exclude }));
    if (candidates.length === 0) return;
    const { count } = await db.from('knowledge_sources').select('id', { count: 'exact', head: true }).eq('knowledge_base_id', source.knowledge_base_id).eq('metadata->>import_id', meta.import_id);
    const room = meta.max_pages - (count ?? 0);
    if (room <= 0) return;
    await queueWebPages(db, { knowledgeBaseId: source.knowledge_base_id, urls: candidates.slice(0, room * 2), meta, autoRefresh: source.metadata?.auto_refresh === true })
        .catch(() => 0);
}

/** Read and index one queued page. Claims it first, so two workers never read the same page. */
async function processOne(db: Admin, row: SourceRow, ctx: { projectId: string; organizationId: string }) {
    const now = new Date().toISOString();
    const { data: claimed } = await db.from('knowledge_sources').update({ status: 'processing', error: null, updated_at: now }).eq('id', row.id).eq('status', 'queued').select('id').maybeSingle();
    if (!claimed) return;
    const url = row.content_ref ?? (row.metadata?.url as string | undefined);
    try {
        if (!url) throw new Error('No URL to read.');
        const page = await readWebPage(url);
        await db.from('knowledge_sources').update({ bytes: page.bytes, mime: page.mime, metadata: { ...(row.metadata ?? {}), name: page.title, url: page.url, refreshed_at: now } }).eq('id', row.id);
        await ingestSourceText(db, { projectId: ctx.projectId, organizationId: ctx.organizationId, knowledgeBaseId: row.knowledge_base_id, tenantId: null, sourceId: row.id, text: page.text });
        if ((row.metadata as { import_kind?: string } | null)?.import_kind === 'website') await followLinks(db, row, page.links);
    } catch (error) {
        await db.from('knowledge_sources').update({ status: 'failed', error: error instanceof Error ? error.message.slice(0, 500) : "Couldn't read the page." }).eq('id', row.id).neq('status', 'ready');
    }
}

/**
 * Work the queue until `deadline` (ms timestamp). Scoped to one knowledge
 * base, or every agent base when `knowledgeBaseId` is omitted (the cron).
 * Returns how many pages are still waiting.
 */
export async function processWebQueue(db: Admin, opts: { knowledgeBaseId?: string; deadline: number }): Promise<{ processed: number; remaining: number }> {
    const contexts = new Map<string, { projectId: string; organizationId: string } | null>();
    const contextFor = async (kbId: string) => {
        if (contexts.has(kbId)) return contexts.get(kbId)!;
        const { data: kb } = await db.from('knowledge_bases').select('project_id').eq('id', kbId).maybeSingle();
        const projectId = (kb as { project_id?: string } | null)?.project_id;
        const { data: project } = projectId ? await db.from('projects').select('organization_id').eq('id', projectId).maybeSingle() : { data: null };
        const organizationId = (project as { organization_id?: string } | null)?.organization_id;
        const ctx = projectId && organizationId ? { projectId, organizationId } : null;
        contexts.set(kbId, ctx);
        return ctx;
    };

    let processed = 0;
    while (Date.now() < opts.deadline) {
        let query = db.from('knowledge_sources').select('id,knowledge_base_id,content_ref,checksum,metadata').eq('status', 'queued').eq('source_type', 'url').order('created_at', { ascending: true }).limit(CONCURRENCY * 2);
        if (opts.knowledgeBaseId) query = query.eq('knowledge_base_id', opts.knowledgeBaseId);
        const { data } = await query;
        const batch = (data ?? []) as SourceRow[];
        if (batch.length === 0) break;
        const queue = [...batch];
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
            for (let row = queue.shift(); row && Date.now() < opts.deadline; row = queue.shift()) {
                const ctx = await contextFor(row.knowledge_base_id);
                if (!ctx) {
                    await db.from('knowledge_sources').update({ status: 'failed', error: 'Project not found.' }).eq('id', row.id);
                    continue;
                }
                await processOne(db, row, ctx);
                processed++;
            }
        }));
    }

    let remaining = db.from('knowledge_sources').select('id', { count: 'exact', head: true }).in('status', ['queued', 'processing']).eq('source_type', 'url');
    if (opts.knowledgeBaseId) remaining = remaining.eq('knowledge_base_id', opts.knowledgeBaseId);
    const { count } = await remaining;
    return { processed, remaining: count ?? 0 };
}

/** Put pages a crashed worker left "processing" back in the queue. */
export async function requeueStuckPages(db: Admin): Promise<number> {
    const { data } = await db.from('knowledge_sources').update({ status: 'queued' }).eq('status', 'processing').eq('source_type', 'url').lt('updated_at', new Date(Date.now() - STUCK_AFTER_MS).toISOString()).select('id');
    return (data ?? []).length;
}

/**
 * Re-read one page and re-index it if it changed. A page that can't be read
 * keeps its last good copy; the error is noted for the dashboard.
 */
export async function refreshWebPage(db: Admin, source: SourceRow, ctx: { projectId: string; organizationId: string }): Promise<'updated' | 'unchanged' | 'failed'> {
    const url = source.content_ref ?? (source.metadata?.url as string | undefined);
    const now = new Date().toISOString();
    if (!url) return 'failed';
    try {
        const page = await readWebPage(url);
        if (checksumText(page.text) === source.checksum) {
            await db.from('knowledge_sources').update({ error: null, metadata: { ...(source.metadata ?? {}), refreshed_at: now } }).eq('id', source.id);
            return 'unchanged';
        }
        // Clear the old passages first: ingest skips sources that already have chunks.
        await db.from('knowledge_chunks').delete().eq('source_id', source.id);
        await db.from('knowledge_sources').update({ bytes: page.bytes, metadata: { ...(source.metadata ?? {}), name: page.title, url: page.url, refreshed_at: now } }).eq('id', source.id);
        await ingestSourceText(db, { projectId: ctx.projectId, organizationId: ctx.organizationId, knowledgeBaseId: source.knowledge_base_id, tenantId: null, sourceId: source.id, text: page.text });
        return 'updated';
    } catch (error) {
        await db.from('knowledge_sources').update({
            error: `Last sync failed: ${error instanceof Error ? error.message.slice(0, 400) : 'could not read the page'}`,
            metadata: { ...(source.metadata ?? {}), refreshed_at: now },
        }).eq('id', source.id);
        return 'failed';
    }
}

/** Refresh many pages a few at a time, until done or `deadline`. */
export async function refreshWebPages(db: Admin, sources: SourceRow[], ctx: (source: SourceRow) => Promise<{ projectId: string; organizationId: string } | null>, deadline: number) {
    const counts = { updated: 0, unchanged: 0, failed: 0 };
    const queue = [...sources];
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (let source = queue.shift(); source && Date.now() < deadline; source = queue.shift()) {
            const context = await ctx(source);
            if (!context) { counts.failed++; continue; }
            counts[await refreshWebPage(db, source, context)]++;
        }
    }));
    return counts;
}
