import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

async function loadKb(supabase: ReturnType<typeof createAdminClient>, projectId: string, kbId: string) {
    const { data } = await supabase.from('knowledge_bases').select('id, project_id').eq('project_id', projectId).eq('id', dePrefixId(kbId)).maybeSingle();
    return (data ?? null) as { id: string } | null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ knowledgeBaseId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { knowledgeBaseId } = await ctx.params;
    const supabase = createAdminClient();
    const kb = await loadKb(supabase, validation.context.projectId, knowledgeBaseId);
    if (!kb) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Knowledge base not found', { requestId }), { requestId });

    let body: { subject_type?: string; subject_id?: string; permissions?: string[] };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.subject_type || !body.subject_id) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'subject_type and subject_id are required', { requestId }), { requestId });
    }
    if (!['installation', 'group', 'role', 'user'].includes(body.subject_type)) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid subject_type', { requestId }), { requestId });
    }
    const { data, error } = await supabase
        .from('knowledge_grants')
        .upsert({ knowledge_base_id: kb.id, subject_type: body.subject_type, subject_id: body.subject_id, permissions: body.permissions ?? ['read'] }, { onConflict: 'knowledge_base_id,subject_type,subject_id' })
        .select('*')
        .single();
    if (error || !data) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to create grant', { requestId }), { requestId });
    }
    return addGatewayHeaders(NextResponse.json(data, { status: 201 }), { requestId });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ knowledgeBaseId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { knowledgeBaseId } = await ctx.params;
    const supabase = createAdminClient();
    const kb = await loadKb(supabase, validation.context.projectId, knowledgeBaseId);
    if (!kb) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Knowledge base not found', { requestId }), { requestId });
    const { data, error } = await supabase.from('knowledge_grants').select('*').eq('knowledge_base_id', kb.id).limit(100);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: data ?? [], next_cursor: null }), { requestId });
}
