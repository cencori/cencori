import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    return {
        id: withPrefix('src', row.id as string),
        knowledge_base_id: withPrefix('kb', row.knowledge_base_id as string),
        source_type: row.source_type, mime: row.mime ?? null, bytes: row.bytes ?? null,
        status: row.status, checksum: row.checksum ?? null, error: row.error ?? null,
        metadata: row.metadata ?? {}, created_at: row.created_at, updated_at: row.updated_at,
    };
}

async function loadSource(supabase: ReturnType<typeof createAdminClient>, projectId: string, kbId: string, sourceId: string) {
    const { data: kb } = await supabase.from('knowledge_bases').select('id').eq('project_id', projectId).eq('id', dePrefixId(kbId)).maybeSingle();
    if (!kb) return null;
    const { data } = await supabase.from('knowledge_sources').select('*').eq('knowledge_base_id', (kb.id as string)).eq('id', dePrefixId(sourceId)).maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ knowledgeBaseId: string; sourceId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { knowledgeBaseId, sourceId } = await ctx.params;
    const row = await loadSource(createAdminClient(), validation.context.projectId, knowledgeBaseId, sourceId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Knowledge source not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(row)), { requestId });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ knowledgeBaseId: string; sourceId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { knowledgeBaseId, sourceId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadSource(supabase, validation.context.projectId, knowledgeBaseId, sourceId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Knowledge source not found', { requestId }), { requestId });
    await supabase.from('knowledge_chunks').delete().eq('source_id', row.id as string);
    const { error } = await supabase.from('knowledge_sources').delete().eq('id', row.id as string);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ deleted: true }), { requestId });
}
