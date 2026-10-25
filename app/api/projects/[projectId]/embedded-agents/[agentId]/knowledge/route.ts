/**
 * /api/projects/:projectId/embedded-agents/:agentId/knowledge
 *
 * The agent's own documents: one knowledge base per agent that every run
 * searches, whichever customer it runs for. Live, not versioned.
 *   GET    list the documents
 *   POST   add documents:
 *            multipart `file`
 *            JSON { name, text }
 *            JSON { url, kind?: 'single' | 'sitemap' | 'website', pattern?, exclude?, max_pages?, auto_refresh? }
 *          A sitemap or website import queues its pages and reads as many as
 *          it can before replying; the rest are read from the queue.
 *   DELETE ?source_id=  remove one
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { detectMime, extractKnowledgeText, isSupportedKnowledgeMime, KNOWLEDGE_MAX_FILE_BYTES } from '@/lib/embedded/knowledge';
import { ingestSourceText } from '@/lib/embedded/knowledge-ingest';
import { ensureAgentKnowledgeBase, isMissingAgentKnowledgeColumn } from '@/lib/embedded/agent-knowledge';
import { discoverSitemapPages, newImportMeta, processWebQueue, queueWebPages, readWebPage, type WebImportKind } from '@/lib/embedded/knowledge-web';

export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;
type Context = { params: Promise<{ projectId: string; agentId: string }> };

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
/** Time a web import spends reading pages before it replies (the queue does the rest). */
const IMPORT_BUDGET_MS = 25_000;
const NOT_READY = 'Agent knowledge needs a database update (migration 20261025_030000_agent_knowledge_bases).';

async function canManage(db: Admin, organizationId: string, userId: string) {
    const { data: organization } = await db.from('organizations').select('owner_id').eq('id', organizationId).maybeSingle();
    if (organization?.owner_id === userId) return true;
    const { data: membership } = await db.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
    return ['owner', 'admin'].includes((membership?.role as string) ?? '');
}

async function scopedAgent(db: Admin, projectId: string, agentId: string) {
    const { data } = await db.from('agents').select('id,name').eq('project_id', projectId).eq('id', agentId).maybeSingle();
    return data as { id: string; name: string } | null;
}

function serialize(row: Record<string, unknown>) {
    const metadata = (row.metadata ?? {}) as { filename?: string; name?: string; url?: string; pages?: number | null; auto_refresh?: boolean; import_kind?: string };
    return {
        id: row.id as string,
        name: metadata.name ?? metadata.filename ?? 'Untitled',
        type: row.source_type as string,
        url: metadata.url ?? null,
        auto_refresh: metadata.auto_refresh === true,
        import_kind: metadata.import_kind ?? null,
        mime: (row.mime as string | null) ?? null,
        bytes: (row.bytes as number | null) ?? null,
        status: row.status as string,
        error: (row.error as string | null) ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    };
}

export async function GET(_request: Request, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await scopedAgent(db, projectId, agentId)) return fail('Agent not found in this project.', 404);

    const { data: kb, error } = await db.from('knowledge_bases').select('id').eq('project_id', projectId).eq('agent_id', agentId).is('tenant_id', null).maybeSingle();
    if (error) {
        if (isMissingAgentKnowledgeColumn(error)) return NextResponse.json({ ready: false, message: NOT_READY, sources: [] });
        return fail('Could not load knowledge.', 502);
    }
    const [manage, sources] = await Promise.all([
        canManage(db, access.organizationId, access.userId),
        kb ? db.from('knowledge_sources').select('*').eq('knowledge_base_id', (kb as { id: string }).id).order('created_at', { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null }),
    ]);
    if (sources.error) return fail('Could not load knowledge.', 502);
    return NextResponse.json({ ready: true, can_manage: manage, sources: ((sources.data ?? []) as Array<Record<string, unknown>>).map(serialize) });
}

export async function POST(request: Request, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await canManage(db, access.organizationId, access.userId)) return fail('Only project admins can change agent knowledge.', 403);
    const agent = await scopedAgent(db, projectId, agentId);
    if (!agent) return fail('Agent not found in this project.', 404);

    const isJson = !(request.headers.get('content-type') ?? '').includes('multipart/form-data');
    const json = isJson ? await request.json().catch(() => null) as Record<string, unknown> | null : null;
    const kind = (['single', 'sitemap', 'website'] as const).find((item) => item === json?.kind) ?? 'single';
    if (typeof json?.url === 'string' && json.url.trim() && kind !== 'single') {
        return importPages(db, { projectId, organizationId: access.organizationId, agent, kind, url: json.url.trim(), body: json });
    }

    let text = '';
    let sourceType: 'inline' | 'file' | 'url' = 'inline';
    let mime = 'text/plain';
    let bytes: number | null = null;
    let metadata: Record<string, unknown> = {};
    try {
        if (!isJson) {
            const file = (await request.formData()).get('file');
            if (!(file instanceof File)) return fail('Choose a file to upload.');
            const filename = file.name || 'upload';
            mime = detectMime(filename, file.type || null);
            if (!isSupportedKnowledgeMime(mime)) return fail('That file type isn\'t supported. Use PDF, Word, Markdown, HTML or plain text.', 415);
            const buffer = Buffer.from(await file.arrayBuffer());
            if (buffer.length > KNOWLEDGE_MAX_FILE_BYTES) return fail('Files can be up to 8 MB.', 413);
            const extracted = await extractKnowledgeText(buffer, mime, filename);
            text = extracted.text;
            bytes = buffer.length;
            sourceType = 'file';
            metadata = { filename, pages: extracted.pages ?? null };
        } else {
            const body = json;
            if (typeof body?.url === 'string' && body.url.trim()) {
                const page = await readWebPage(body.url.trim());
                text = page.text;
                sourceType = 'url';
                mime = page.mime;
                bytes = page.bytes;
                metadata = { name: page.title, url: page.url, auto_refresh: body.auto_refresh === true, refreshed_at: new Date().toISOString() };
            } else {
                text = typeof body?.text === 'string' ? body.text : '';
                if (!text.trim()) return fail('Paste some text to add.');
                const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : 'Pasted text';
                bytes = Buffer.byteLength(text);
                metadata = { name, filename: name };
            }
        }
    } catch (error) {
        return fail(error instanceof Error ? error.message : 'Could not read that document.');
    }

    let kbId: string;
    try {
        kbId = await ensureAgentKnowledgeBase(db, { projectId, agentId, agentName: agent.name });
    } catch (error) {
        return isMissingAgentKnowledgeColumn(error as { code?: string; message?: string }) ? fail(NOT_READY, 503) : fail('Could not set up knowledge for this agent.', 502);
    }

    const { data: source, error } = await db
        .from('knowledge_sources')
        .insert({ knowledge_base_id: kbId, source_type: sourceType, mime, bytes, status: 'queued', metadata, content_ref: sourceType === 'url' ? metadata.url as string : null })
        .select('*')
        .single();
    if (error || !source) return fail('Could not add the document.', 502);
    try {
        await ingestSourceText(db, { projectId, organizationId: access.organizationId, knowledgeBaseId: kbId, tenantId: null, sourceId: (source as { id: string }).id, text });
    } catch {
        // Ingest already marked the source failed with its reason.
    }
    const { data: final } = await db.from('knowledge_sources').select('*').eq('id', (source as { id: string }).id).single();
    return NextResponse.json({ source: serialize((final ?? source) as Record<string, unknown>) }, { status: 201 });
}

export async function DELETE(request: Request, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await canManage(db, access.organizationId, access.userId)) return fail('Only project admins can change agent knowledge.', 403);
    const sourceId = new URL(request.url).searchParams.get('source_id') ?? '';
    if (!sourceId) return fail('Choose a document to remove.');

    const { data: kb, error: kbError } = await db.from('knowledge_bases').select('id').eq('project_id', projectId).eq('agent_id', agentId).is('tenant_id', null).maybeSingle();
    if (kbError || !kb) return fail('Document not found.', 404);
    // Chunks cascade from the source.
    const { data, error } = await db.from('knowledge_sources').delete().eq('id', sourceId).eq('knowledge_base_id', (kb as { id: string }).id).select('id').maybeSingle();
    if (error) return fail('Could not remove the document.', 502);
    if (!data) return fail('Document not found.', 404);
    return NextResponse.json({ deleted: sourceId });
}

/** A sitemap or website: queue the pages, read what fits in the time budget, report the rest. */
async function importPages(
    db: Admin,
    opts: { projectId: string; organizationId: string; agent: { id: string; name: string }; kind: Exclude<WebImportKind, 'single'>; url: string; body: Record<string, unknown> },
) {
    const deadline = Date.now() + IMPORT_BUDGET_MS;
    const pattern = typeof opts.body.pattern === 'string' ? opts.body.pattern : null;
    const exclude = Array.isArray(opts.body.exclude) ? opts.body.exclude.filter((item): item is string => typeof item === 'string') : [];
    const meta = newImportMeta(opts.kind, opts.url, { pattern, exclude, maxPages: typeof opts.body.max_pages === 'number' ? opts.body.max_pages : undefined });
    const autoRefresh = opts.body.auto_refresh === true;

    let urls: string[];
    try {
        if (opts.kind === 'sitemap') {
            urls = await discoverSitemapPages(opts.url, { pattern, max: meta.max_pages });
        } else {
            const { normalizeWebUrl } = await import('@/lib/web/url');
            urls = [normalizeWebUrl(opts.url)];
            meta.import_root = urls[0];
        }
    } catch (error) {
        return fail(error instanceof Error ? error.message : "Couldn't read that site.", 422);
    }

    let kbId: string;
    try {
        kbId = await ensureAgentKnowledgeBase(db, { projectId: opts.projectId, agentId: opts.agent.id, agentName: opts.agent.name });
    } catch (error) {
        return isMissingAgentKnowledgeColumn(error as { code?: string; message?: string }) ? fail(NOT_READY, 503) : fail('Could not set up knowledge for this agent.', 502);
    }
    let queued: number;
    try {
        queued = await queueWebPages(db, { knowledgeBaseId: kbId, urls, meta, autoRefresh });
    } catch {
        return fail('Could not queue those pages.', 502);
    }
    if (queued === 0) return fail('Those pages are already in this agent\'s knowledge.', 409);
    const { processed, remaining } = await processWebQueue(db, { knowledgeBaseId: kbId, deadline });
    return NextResponse.json({ queued, processed, remaining }, { status: 201 });
}
