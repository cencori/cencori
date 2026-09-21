import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /v1/connectors/:connectorId — by slug or id. No secrets stored here.
export async function GET(req: NextRequest, ctx: { params: Promise<{ connectorId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectorId } = await ctx.params;
    const supabase = createAdminClient();
    const { data } = await supabase.from('connectors').select('slug, name, auth_type, default_scopes, mcp_transport, risk_defaults, status').eq('slug', connectorId).maybeSingle();
    const row = data ?? (await supabase.from('connectors').select('slug, name, auth_type, default_scopes, mcp_transport, risk_defaults, status').eq('id', connectorId).maybeSingle()).data;
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Connector not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(row), { requestId });
}
