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
        id: withPrefix('kb', row.id as string),
        project_id: row.project_id,
        tenant_id: row.tenant_id ? withPrefix('ten', row.tenant_id as string) : null,
        name: row.name, scope_type: row.scope_type, region: row.region ?? null,
        retention_policy: row.retention_policy ?? {}, status: row.status,
        created_at: row.created_at, updated_at: row.updated_at,
    };
}

async function loadKb(supabase: ReturnType<typeof createAdminClient>, projectId: string, kbId: string) {
    const { data } = await supabase.from('knowledge_bases').select('*').eq('project_id', projectId).eq('id', dePrefixId(kbId)).maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ knowledgeBaseId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { knowledgeBaseId } = await ctx.params;
    const row = await loadKb(createAdminClient(), validation.context.projectId, knowledgeBaseId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Knowledge base not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(row)), { requestId });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ knowledgeBaseId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { knowledgeBaseId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadKb(supabase, validation.context.projectId, knowledgeBaseId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Knowledge base not found', { requestId }), { requestId });
    let body: Record<string, unknown> = {};
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
    if (body.status === 'active' || body.status === 'archived') patch.status = body.status;
    if (body.retention_policy && typeof body.retention_policy === 'object') patch.retention_policy = body.retention_policy;
    if (Object.keys(patch).length === 0) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No updatable fields', { requestId }), { requestId });
    }
    const { data, error } = await supabase.from('knowledge_bases').update(patch).eq('id', row.id as string).select('*').single();
    if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Update failed', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>)), { requestId });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ knowledgeBaseId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { knowledgeBaseId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadKb(supabase, validation.context.projectId, knowledgeBaseId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Knowledge base not found', { requestId }), { requestId });
    // Delete chunks first (no cascade from chunks→kb in all environments), then sources, then base.
    await supabase.from('knowledge_chunks').delete().eq('knowledge_base_id', row.id as string);
    await supabase.from('knowledge_sources').delete().eq('knowledge_base_id', row.id as string);
    const { error } = await supabase.from('knowledge_bases').delete().eq('id', row.id as string);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ deleted: true }), { requestId });
}
