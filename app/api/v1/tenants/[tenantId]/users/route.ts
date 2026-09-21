import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, withPrefix } from '@/lib/embedded/http';
import { TENANT_PREFIX, USER_PREFIX } from '@/lib/embedded/types';
import { dePrefixId } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

async function resolveTenantId(supabase: ReturnType<typeof createAdminClient>, projectId: string, tenantId: string): Promise<string | null> {
    const raw = dePrefixId(tenantId);
    const { data } = await supabase.from('platform_tenants').select('id').eq('project_id', projectId).eq('id', raw).maybeSingle();
    if (data) return data.id as string;
    const { data: byExternal } = await supabase
        .from('platform_tenants')
        .select('id')
        .eq('project_id', projectId)
        .eq('external_id', tenantId)
        .maybeSingle();
    return (byExternal?.id as string) ?? null;
}

function serializeUser(row: Record<string, unknown>) {
    return {
        id: withPrefix(USER_PREFIX, row.id as string),
        tenant_id: withPrefix(TENANT_PREFIX, row.tenant_id as string),
        external_id: row.external_id,
        display_name: row.display_name ?? null,
        status: row.status,
        roles: row.roles ?? [],
        groups: row.groups ?? [],
        rate_plan_id: row.rate_plan_id ?? null,
        metadata: row.metadata ?? {},
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function ensureActiveTenant(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string,
    tenantParam: string,
    requestId: string,
): Promise<{ id: string } | NextResponse> {
    const id = await resolveTenantId(supabase, projectId, tenantParam);
    if (!id) return embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId });
    const { data } = await supabase.from('platform_tenants').select('id, status').eq('id', id).maybeSingle();
    if (!data) return embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId });
    if ((data.status as string) === 'suspended') {
        return embeddedError(403, 'tenant_suspended', 'Tenant is suspended', { requestId });
    }
    return { id: data.id as string };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ tenantId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { tenantId } = await ctx.params;
    const supabase = createAdminClient();
    const resolved = await ensureActiveTenant(supabase, validation.context.projectId, tenantId, requestId);
    if (resolved instanceof NextResponse) return addGatewayHeaders(resolved, { requestId });
    const { data, error } = await supabase
        .from('platform_users')
        .select('*')
        .eq('project_id', validation.context.projectId)
        .eq('tenant_id', resolved.id)
        .order('created_at', { ascending: false })
        .limit(100);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: ((data ?? []) as Record<string, unknown>[]).map(serializeUser), next_cursor: null }), { requestId });
}
