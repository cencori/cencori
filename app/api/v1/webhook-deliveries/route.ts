import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /v1/webhook-deliveries — delivery log for customer debugging/replay.
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const { data: endpoints } = await supabase.from('webhooks').select('id').eq('project_id', validation.context.projectId);
    const ids = ((endpoints ?? []) as Array<{ id: string }>).map((e) => e.id);
    if (ids.length === 0) return addGatewayHeaders(NextResponse.json({ data: [], next_cursor: null }), { requestId });
    const { data, error } = await supabase.from('webhook_deliveries').select('*').in('endpoint_id', ids).order('created_at', { ascending: false }).limit(100);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: data ?? [], next_cursor: null }), { requestId });
}
