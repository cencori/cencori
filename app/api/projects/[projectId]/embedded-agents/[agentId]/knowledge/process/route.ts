/**
 * POST /api/projects/:projectId/embedded-agents/:agentId/knowledge/process
 *
 * Reads queued web pages for a while. The Knowledge page calls this while a
 * sitemap or website import is in progress, so pages appear as you watch;
 * the knowledge-refresh cron finishes anything left when no one's looking.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { processWebQueue } from '@/lib/embedded/knowledge-web';

export const maxDuration = 60;

const BUDGET_MS = 20_000;

export async function POST(_request: Request, ctx: { params: Promise<{ projectId: string; agentId: string }> }) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const { data: kb } = await db.from('knowledge_bases').select('id').eq('project_id', projectId).eq('agent_id', agentId).is('tenant_id', null).maybeSingle();
    if (!kb) return NextResponse.json({ processed: 0, remaining: 0 });
    return NextResponse.json(await processWebQueue(db, { knowledgeBaseId: (kb as { id: string }).id, deadline: Date.now() + BUDGET_MS }));
}
