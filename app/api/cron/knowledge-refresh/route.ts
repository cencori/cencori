import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { cronDisabled } from '@/lib/cron';
import { processWebQueue, refreshWebPages, requeueStuckPages, WEB_REFRESH_INTERVAL_MS } from '@/lib/embedded/knowledge-web';

export const maxDuration = 60;

/** Queued imports first, then auto-refresh, both inside one invocation. */
const QUEUE_BUDGET_MS = 25_000;
const REFRESH_BUDGET_MS = 25_000;
const REFRESH_BATCH = 200;

type UrlSource = { id: string; knowledge_base_id: string; content_ref: string | null; checksum: string | null; metadata: Record<string, unknown> | null };

/**
 * Agent knowledge from the web: finish sitemap and website imports nobody is
 * watching, and re-read auto-refresh pages once a day.
 */
async function run(req: NextRequest) {
    const off = cronDisabled();
    if (off) return off;
    try {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            console.error('[Cron] Missing CRON_SECRET - refusing to refresh knowledge');
            return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
        }
        if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
            console.error('[Cron] Unauthorized knowledge refresh attempt');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = createAdminClient();
        const requeued = await requeueStuckPages(db);
        const queue = await processWebQueue(db, { deadline: Date.now() + QUEUE_BUDGET_MS });

        const { data } = await db.from('knowledge_sources')
            .select('id,knowledge_base_id,content_ref,checksum,metadata')
            .eq('source_type', 'url')
            .eq('status', 'ready')
            .eq('metadata->>auto_refresh', 'true')
            .order('updated_at', { ascending: true })
            .limit(REFRESH_BATCH);
        const cutoff = Date.now() - WEB_REFRESH_INTERVAL_MS;
        const due = ((data ?? []) as UrlSource[]).filter((source) => {
            const last = Date.parse(String(source.metadata?.refreshed_at ?? ''));
            return !Number.isFinite(last) || last < cutoff;
        });

        const contexts = new Map<string, { projectId: string; organizationId: string } | null>();
        const contextFor = async (source: UrlSource) => {
            if (contexts.has(source.knowledge_base_id)) return contexts.get(source.knowledge_base_id)!;
            const { data: kb } = await db.from('knowledge_bases').select('project_id, projects(organization_id)').eq('id', source.knowledge_base_id).maybeSingle();
            const row = kb as { project_id?: string; projects?: { organization_id?: string } | null } | null;
            const ctx = row?.project_id && row.projects?.organization_id ? { projectId: row.project_id, organizationId: row.projects.organization_id } : null;
            contexts.set(source.knowledge_base_id, ctx);
            return ctx;
        };
        const refreshed = await refreshWebPages(db, due, contextFor, Date.now() + REFRESH_BUDGET_MS);

        console.log('[Cron] ✓ Knowledge refresh complete', { requeued, ...queue, refreshed });
        return NextResponse.json({ success: true, requeued, queue, refreshed, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('[Cron] Error refreshing knowledge:', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

export const GET = run;
export const POST = run;
