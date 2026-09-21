import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { PROVIDER_SYNC_PREFIX } from '@/lib/embedded/types';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ connectionId: string; syncId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId, syncId } = await ctx.params;
    const supabase = createAdminClient();
    const { data } = await supabase
        .from('provider_model_syncs')
        .select('*')
        .eq('project_id', validation.context.projectId)
        .eq('provider_connection_id', dePrefixId(connectionId))
        .eq('id', dePrefixId(syncId))
        .maybeSingle();
    if (!data) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Model sync not found', { requestId }), { requestId });
    const s = data as Record<string, unknown>;
    return addGatewayHeaders(
        NextResponse.json({ id: withPrefix(PROVIDER_SYNC_PREFIX, s.id as string), status: s.status, counts: (s.diff_json as { counts?: unknown })?.counts ?? {}, diff: s.diff_json, expires_at: s.expires_at, applied_at: s.applied_at }),
        { requestId },
    );
}
