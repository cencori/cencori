import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { assertSafeOutboundUrl } from '@/lib/security/outbound-url';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

const M1_EVENT_FAMILIES = [
    'provider_connection.*', 'provider_model_sync.*', 'tenant.*', 'agent.*', 'installation.*',
    'knowledge_source.*', 'connection.*', 'session.*', 'run.*', 'action.*', 'usage.*',
    // Backward-compat concrete events:
    'request.completed', 'request.failed', 'run.queued', 'run.started', 'run.completed', 'run.failed', 'run.cancelled',
    'knowledge_source.queued', 'knowledge_source.ready', 'knowledge_source.failed',
];

function serialize(row: Record<string, unknown>) {
    const { secret, ...rest } = row;
    void secret;
    return rest;
}

// GET /v1/webhooks — public bearer-auth list.
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('webhooks').select('id, project_id, name, url, events, is_active, failure_count, last_triggered_at, created_at').eq('project_id', validation.context.projectId).order('created_at', { ascending: false }).limit(100);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: (data ?? []).map((r) => serialize(r as Record<string, unknown>)), next_cursor: null }), { requestId });
}

// POST /v1/webhooks — secret-key only (client tokens cannot configure webhooks).
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    let body: { name?: string; url?: string; events?: string[]; secret?: string };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.name?.trim() || !body.url?.trim()) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'name and url are required', { requestId }), { requestId });
    }
    try {
        await assertSafeOutboundUrl(body.url.trim());
    } catch (e) {
        return addGatewayHeaders(embeddedError(400, 'unsafe_provider_url', e instanceof Error ? e.message : 'Unsafe URL', { requestId }), { requestId });
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('webhooks')
        .insert({
            project_id: validation.context.projectId,
            name: body.name.trim(),
            url: body.url.trim(),
            events: body.events ?? ['run.completed'],
            secret: body.secret ?? crypto.randomBytes(32).toString('hex'),
            is_active: true,
        })
        .select('id, project_id, name, url, events, is_active, created_at')
        .single();
    if (error || !data) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to create webhook', { requestId }), { requestId });
    }
    return addGatewayHeaders(NextResponse.json({ ...serialize(data as Record<string, unknown>), api_version: '2026-09-21', event_families: M1_EVENT_FAMILIES }, { status: 201 }), { requestId });
}
