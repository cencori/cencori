/**
 * POST /api/projects/:projectId/embedded-agents/:agentId/knowledge/sync
 *
 * Re-reads every web page the agent knows and re-indexes the ones that
 * changed. Unchanged pages are left alone (no re-embedding).
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { refreshWebPages } from '@/lib/embedded/knowledge-web';

export const maxDuration = 60;

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
/** Stop starting new pages after this; the reply says how many were left. */
const BUDGET_MS = 50_000;

type UrlSource = { id: string; knowledge_base_id: string; content_ref: string | null; checksum: string | null; metadata: Record<string, unknown> | null };

export async function POST(_request: Request, ctx: { params: Promise<{ projectId: string; agentId: string }> }) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();

    const { data: organization } = await db.from('organizations').select('owner_id').eq('id', access.organizationId).maybeSingle();
    if (organization?.owner_id !== access.userId) {
        const { data: membership } = await db.from('organization_members').select('role').eq('organization_id', access.organizationId).eq('user_id', access.userId).maybeSingle();
        if (!['owner', 'admin'].includes((membership?.role as string) ?? '')) return fail('Only project admins can change agent knowledge.', 403);
    }

    const { data: kb } = await db.from('knowledge_bases').select('id').eq('project_id', projectId).eq('agent_id', agentId).is('tenant_id', null).maybeSingle();
    if (!kb) return NextResponse.json({ updated: 0, unchanged: 0, failed: 0, skipped: 0 });
    // Least recently read first, so repeated syncs of a big site make progress.
    const { data: rows, error } = await db.from('knowledge_sources')
        .select('id,knowledge_base_id,content_ref,checksum,metadata')
        .eq('knowledge_base_id', (kb as { id: string }).id)
        .eq('source_type', 'url')
        .eq('status', 'ready')
        .order('updated_at', { ascending: true })
        .limit(1000);
    if (error) return fail('Could not load web pages.', 502);

    const sources = (rows ?? []) as UrlSource[];
    const counts = await refreshWebPages(db, sources, async () => ({ projectId, organizationId: access.organizationId }), Date.now() + BUDGET_MS);
    return NextResponse.json({ ...counts, skipped: sources.length - counts.updated - counts.unchanged - counts.failed });
}
