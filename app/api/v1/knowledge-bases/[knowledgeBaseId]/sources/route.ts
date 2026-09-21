import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { detectMime, extractKnowledgeText, isSupportedKnowledgeMime, KNOWLEDGE_MAX_FILE_BYTES } from '@/lib/embedded/knowledge';
import { ingestSourceText } from '@/lib/embedded/knowledge-ingest';
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

async function loadKb(supabase: ReturnType<typeof createAdminClient>, projectId: string, kbId: string) {
    const { data } = await supabase.from('knowledge_bases').select('id, project_id, tenant_id').eq('project_id', projectId).eq('id', dePrefixId(kbId)).maybeSingle();
    return (data ?? null) as { id: string; project_id: string; tenant_id: string | null } | null;
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

    const contentType = req.headers.get('content-type') ?? '';
    let text = '';
    let sourceType: 'inline' | 'file' = 'inline';
    let mime = 'text/plain';
    let bytes: number | null = null;
    let filename = 'inline.txt';
    let metadata: Record<string, unknown> = {};

    try {
        if (contentType.includes('multipart/form-data')) {
            const form = await req.formData();
            const file = form.get('file');
            if (!(file instanceof File)) {
                return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'file is required', { requestId }), { requestId });
            }
            filename = file.name || 'upload';
            mime = detectMime(filename, file.type || null);
            if (!isSupportedKnowledgeMime(mime)) {
                return addGatewayHeaders(embeddedError(415, 'invalid_request_error', `Unsupported file type: ${mime}`, { requestId }), { requestId });
            }
            const buffer = Buffer.from(await file.arrayBuffer());
            if (buffer.length > KNOWLEDGE_MAX_FILE_BYTES) {
                return addGatewayHeaders(embeddedError(413, 'invalid_request_error', 'File exceeds 8MB limit', { requestId }), { requestId });
            }
            bytes = buffer.length;
            sourceType = 'file';
            const metaRaw = form.get('metadata');
            if (typeof metaRaw === 'string' && metaRaw) {
                try {
                    metadata = JSON.parse(metaRaw) as Record<string, unknown>;
                } catch {
                    metadata = {};
                }
            }
            const extracted = await extractKnowledgeText(buffer, mime, filename);
            text = extracted.text;
            metadata = { ...metadata, filename, pages: extracted.pages ?? null };
        } else {
            const body = (await req.json()) as { text?: string; content?: string; metadata?: Record<string, unknown>; mime?: string };
            text = (body.text ?? body.content ?? '').toString();
            if (!text.trim()) {
                return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'text is required', { requestId }), { requestId });
            }
            mime = body.mime ?? 'text/plain';
            metadata = body.metadata ?? {};
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to read source';
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', message, { requestId }), { requestId });
    }

    const { data: source, error } = await supabase
        .from('knowledge_sources')
        .insert({ knowledge_base_id: kb.id, source_type: sourceType, mime, bytes, status: 'queued', metadata: { ...metadata, filename } })
        .select('*')
        .single();
    if (error || !source) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to create source', { requestId }), { requestId });
    }
    const src = source as Record<string, unknown>;
    try {
        const { triggerWebhooks } = await import('@/lib/webhooks/trigger');
        await triggerWebhooks(validation.context.projectId, 'knowledge_source.queued' as never, { knowledge_base_id: kb.id, source_id: src.id });
    } catch {
        // ignore
    }

    try {
        await ingestSourceText(supabase as never, {
            projectId: validation.context.projectId,
            organizationId: validation.context.organizationId,
            knowledgeBaseId: kb.id,
            tenantId: kb.tenant_id,
            sourceId: src.id as string,
            text,
        });
    } catch {
        // Status already set to failed inside ingest; return row with failure.
    }
    const { data: final } = await supabase.from('knowledge_sources').select('*').eq('id', src.id as string).single();
    return addGatewayHeaders(NextResponse.json(serialize((final ?? source) as Record<string, unknown>), { status: 201 }), { requestId });
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
    const { data, error } = await supabase.from('knowledge_sources').select('*').eq('knowledge_base_id', kb.id).order('created_at', { ascending: false }).limit(100);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: ((data ?? []) as Record<string, unknown>[]).map(serialize), next_cursor: null }), { requestId });
}
