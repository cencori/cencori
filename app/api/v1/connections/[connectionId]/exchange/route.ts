import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { completeOauthAuthorization } from '@/lib/embedded/oauth';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/connections/:id/exchange — finish an authorization whose consent
// screen redirected to the customer's own `redirect_uri`. Their server hands
// back the `code` and `state` it received; Cencori exchanges and stores the tokens.
export async function POST(req: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: conn } = await supabase.from('tool_connections').select('id').eq('project_id', validation.context.projectId).eq('id', dePrefixId(connectionId)).maybeSingle();
    if (!conn) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Connection not found', { requestId }), { requestId });

    let body: { code?: unknown; state?: unknown } = {};
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (typeof body.code !== 'string' || !body.code || typeof body.state !== 'string' || !body.state) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'code and state are required — pass the query parameters your redirect_uri received', { requestId }), { requestId });
    }

    const done = await completeOauthAuthorization(supabase as never, {
        state: body.state,
        code: body.code,
        expect: { projectId: validation.context.projectId, connectionId: conn.id as string },
    });
    if (!done.ok) {
        return addGatewayHeaders(embeddedError(done.status, done.code, done.message, { requestId }), { requestId });
    }
    const id = withPrefix('con', done.connectionId);
    try {
        const { triggerWebhooks } = await import('@/lib/webhooks/trigger');
        await triggerWebhooks(done.projectId, 'connection.active' as never, { connection_id: id, connector: done.connector });
    } catch {
        // ignore
    }
    return addGatewayHeaders(NextResponse.json({ connected: true, connection_id: id, connector: done.connector, status: 'active', scopes: done.scopes }), { requestId });
}
