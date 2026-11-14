import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { dePrefixId } from '@/lib/embedded/http';
import { serializeAction } from '@/lib/embedded/public-ids';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /v1/actions/:actionId — sanitized (no secrets ever stored).
export async function GET(req: NextRequest, ctx: { params: Promise<{ actionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { actionId } = await ctx.params;
    const supabase = createAdminClient();
    const { data } = await supabase.from('actions').select('*').eq('project_id', validation.context.projectId).eq('id', dePrefixId(actionId)).maybeSingle();
    if (!data) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Action not found', { requestId }), { requestId });
    const row = data as Record<string, unknown>;
    if (row.expires_at && Date.parse(row.expires_at as string) <= Date.now() && row.status === 'pending') {
        await supabase.from('actions').update({ status: 'expired' }).eq('id', row.id as string);
        row.status = 'expired';
    }
    return addGatewayHeaders(NextResponse.json(serializeAction(row)), { requestId });
}
