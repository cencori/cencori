import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/tenants/:tenantId/export — compliance export stub (M0): tenant + users snapshot.
export async function POST(req: NextRequest, ctx: { params: Promise<{ tenantId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { tenantId } = await ctx.params;
    const supabase = createAdminClient();
    const raw = dePrefixId(tenantId);
    const { data: tenant } = await supabase.from('platform_tenants').select('*').eq('project_id', validation.context.projectId).eq('id', raw).maybeSingle();
    const tenantRow = tenant ?? (await supabase.from('platform_tenants').select('*').eq('project_id', validation.context.projectId).eq('external_id', tenantId).maybeSingle()).data;
    if (!tenantRow) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
    const { data: users } = await supabase.from('platform_users').select('*').eq('tenant_id', (tenantRow as { id: string }).id);
    return addGatewayHeaders(NextResponse.json({ tenant: tenantRow, users: users ?? [], exported_at: new Date().toISOString() }), { requestId });
}
