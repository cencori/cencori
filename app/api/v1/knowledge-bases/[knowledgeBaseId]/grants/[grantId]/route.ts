import { NextRequest, NextResponse } from 'next/server';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// DELETE /v1/knowledge-bases/:id/grants/:grantId
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ knowledgeBaseId: string; grantId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { grantId } = await ctx.params;
    const { createAdminClient } = await import('@/lib/supabaseAdmin');
    const supabase = createAdminClient();
    const { error } = await supabase.from('knowledge_grants').delete().eq('id', grantId);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ deleted: true }), { requestId });
}
