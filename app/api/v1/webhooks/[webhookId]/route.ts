import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { assertSafeOutboundUrl } from '@/lib/security/outbound-url';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ webhookId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { webhookId } = await ctx.params;
    const supabase = createAdminClient();
    let body: Record<string, unknown> = {};
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
    if (typeof body.url === 'string' && body.url.trim()) {
        try {
            await assertSafeOutboundUrl(body.url.trim());
        } catch (e) {
            return addGatewayHeaders(embeddedError(400, 'unsafe_provider_url', e instanceof Error ? e.message : 'Unsafe URL', { requestId }), { requestId });
        }
        patch.url = (body.url as string).trim();
    }
    if (Array.isArray(body.events)) patch.events = body.events;
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
    if (Object.keys(patch).length === 0) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No updatable fields', { requestId }), { requestId });
    }
    const { data, error } = await supabase.from('webhooks').update(patch).eq('project_id', validation.context.projectId).eq('id', webhookId).select('id, name, url, events, is_active, failure_count, last_triggered_at').single();
    if (error || !data) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Webhook not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(data), { requestId });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ webhookId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { webhookId } = await ctx.params;
    const supabase = createAdminClient();
    const { error } = await supabase.from('webhooks').delete().eq('project_id', validation.context.projectId).eq('id', webhookId);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ deleted: true }), { requestId });
}
