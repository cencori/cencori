/**
 * GET /api/widget/sources?ids=a,b
 *
 * Names and links for the documents a widget answer cited. Authorized by the
 * conversation's client token, and limited to the knowledge that agent's
 * installation can search, so ids from elsewhere resolve to nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { extractBearerToken } from '@/lib/api-keys';
import { verifyClientToken } from '@/lib/embedded/client-tokens';
import { agentKnowledgeBaseId } from '@/lib/embedded/agent-knowledge';

export async function GET(req: NextRequest) {
    const verified = verifyClientToken(extractBearerToken(req.headers.get('Authorization')) ?? '');
    if (!verified.ok) return NextResponse.json({ error: { code: verified.code, message: verified.message } }, { status: 401 });
    const installationId = verified.claims.installation_ids?.[0];
    const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 10);
    if (!installationId || ids.length === 0) return NextResponse.json({ sources: [] });

    const db = createAdminClient();
    const { data: installation } = await db.from('agent_installations').select('agent_id').eq('project_id', verified.claims.project_id).eq('id', installationId).maybeSingle();
    if (!installation) return NextResponse.json({ sources: [] });
    const [agentKbId, bound] = await Promise.all([
        agentKnowledgeBaseId(db, installation.agent_id as string),
        db.from('installation_knowledge_bases').select('knowledge_base_id').eq('installation_id', installationId),
    ]);
    const kbIds = [...new Set([...(agentKbId ? [agentKbId] : []), ...((bound.data ?? []) as Array<{ knowledge_base_id: string }>).map((b) => b.knowledge_base_id)])];
    if (kbIds.length === 0) return NextResponse.json({ sources: [] });

    const { data } = await db.from('knowledge_sources').select('id, metadata').in('id', ids).in('knowledge_base_id', kbIds);
    const sources = ((data ?? []) as Array<{ id: string; metadata: { name?: string; filename?: string; url?: string } | null }>).map((row) => ({
        id: row.id,
        name: row.metadata?.name ?? row.metadata?.filename ?? 'Source',
        url: typeof row.metadata?.url === 'string' && /^https?:\/\//.test(row.metadata.url) ? row.metadata.url : null,
    }));
    return NextResponse.json({ sources }, { headers: { 'Cache-Control': 'no-store' } });
}
