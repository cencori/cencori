import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/connections/:id/test — health check without leaking secrets.
export async function POST(req: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: conn } = await supabase.from('tool_connections').select('*').eq('project_id', validation.context.projectId).eq('id', dePrefixId(connectionId)).maybeSingle();
    if (!conn) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Connection not found', { requestId }), { requestId });
    const c = conn as { id: string; encrypted_access_ref: string | null; encrypted_refresh_ref: string | null; expires_at: string | null };

    const hasCredential = Boolean(c.encrypted_access_ref);
    const expired = !c.expires_at || Date.parse(c.expires_at) <= Date.now();
    const healthy = hasCredential && !expired;
    await supabase.from('tool_connections').update({ last_tested_at: new Date().toISOString(), status: healthy ? 'active' : c.encrypted_refresh_ref ? 'expired' : 'error' }).eq('id', c.id);
    return addGatewayHeaders(NextResponse.json({ success: healthy, has_credential: hasCredential, expired, expires_at: c.expires_at }), { requestId });
}
