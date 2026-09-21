import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { deliverWebhook, createWebhookEvent } from '@/lib/webhooks/deliver';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/webhook-deliveries/:deliveryId/replay — re-fire a logged delivery.
export async function POST(req: NextRequest, ctx: { params: Promise<{ deliveryId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { deliveryId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: delivery } = await supabase.from('webhook_deliveries').select('*').eq('id', deliveryId).maybeSingle();
    if (!delivery) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Delivery not found', { requestId }), { requestId });
    const d = delivery as { endpoint_id: string; event_id: string; event_type: string };
    const { data: endpoint } = await supabase.from('webhooks').select('id, name, url, secret, events, is_active, project_id').eq('id', d.endpoint_id).maybeSingle();
    if (!endpoint || (endpoint.project_id as string) !== validation.context.projectId) {
        return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Webhook endpoint not found', { requestId }), { requestId });
    }
    const payload = createWebhookEvent(d.event_type, validation.context.projectId, { event_id: d.event_id, replayed: true });
    const result = await deliverWebhook(
        endpoint as { id: string; name: string; url: string; secret: string; events: string[]; is_active: boolean },
        payload,
        3,
    );
    await supabase.from('webhook_deliveries').update({ status: result.success ? 'delivered' : 'failed', attempt_count: (delivery as { attempt_count: number }).attempt_count + 1, response_code: result.statusCode ?? null }).eq('id', deliveryId);
    return addGatewayHeaders(NextResponse.json({ delivery_id: deliveryId, success: result.success, status_code: result.statusCode ?? null }), { requestId });
}
