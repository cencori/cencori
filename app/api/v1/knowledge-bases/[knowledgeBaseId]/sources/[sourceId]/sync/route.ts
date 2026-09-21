import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST .../sync — re-ingest (idempotent via checksum; M1 reuses stored content when available).
export async function POST(req: NextRequest, ctx: { params: Promise<{ knowledgeBaseId: string; sourceId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { knowledgeBaseId, sourceId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: kb } = await supabase.from('knowledge_bases').select('id, project_id').eq('project_id', validation.context.projectId).eq('id', dePrefixId(knowledgeBaseId)).maybeSingle();
    if (!kb) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Knowledge base not found', { requestId }), { requestId });

    let body: { text?: string } = {};
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }
    const { data: row } = await supabase.from('knowledge_sources').select('*').eq('knowledge_base_id', (kb.id as string)).eq('id', dePrefixId(sourceId)).maybeSingle();
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Knowledge source not found', { requestId }), { requestId });

    if (!body.text) {
        // No new content supplied: report current status (checksum-based idempotency happens at ingest).
        return addGatewayHeaders(NextResponse.json({ id: row.id, status: (row as { status: string }).status, checksum: (row as { checksum?: string }).checksum ?? null }), { requestId });
    }

    const { ingestSourceText } = await import('@/lib/embedded/knowledge-ingest');
    const { data: kbFull } = await supabase.from('knowledge_bases').select('tenant_id').eq('id', (kb.id as string)).single();
    try {
        const result = await ingestSourceText(supabase as never, {
            projectId: validation.context.projectId,
            organizationId: validation.context.organizationId,
            knowledgeBaseId: (kb.id as string),
            tenantId: ((kbFull?.tenant_id ?? null) as string | null),
            sourceId: (row.id as string),
            text: body.text,
        });
        return addGatewayHeaders(NextResponse.json({ id: row.id, status: 'ready', chunks: result.chunks }), { requestId });
    } catch (e) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', e instanceof Error ? e.message : 'Sync failed', { requestId }), { requestId });
    }
}
