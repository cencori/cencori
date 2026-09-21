import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, withPrefix, dePrefixId } from '@/lib/embedded/http';
import { TENANT_PREFIX, USER_PREFIX } from '@/lib/embedded/types';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
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

async function resolveTenantId(supabase: ReturnType<typeof createAdminClient>, projectId: string, tenantId: string): Promise<string | null> {
    const raw = dePrefixId(tenantId);
    const { data } = await supabase.from('platform_tenants').select('id').eq('project_id', projectId).eq('id', raw).maybeSingle();
    if (data) return data.id as string;
    const { data: byExternal } = await supabase.from('platform_tenants').select('id').eq('project_id', projectId).eq('external_id', tenantId).maybeSingle();
    return (byExternal?.id as string) ?? null;
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ tenantId: string; externalUserId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { tenantId, externalUserId } = await ctx.params;
    const supabase = createAdminClient();
    const tid = await resolveTenantId(supabase, validation.context.projectId, tenantId);
    if (!tid) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
    const { data: tenantRow } = await supabase.from('platform_tenants').select('id, status').eq('id', tid).maybeSingle();
    if (!tenantRow) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
    if ((tenantRow.status as string) !== 'active') {
        return addGatewayHeaders(embeddedError(403, 'tenant_suspended', 'Tenant is not active', { requestId }), { requestId });
    }
    let body: { display_name?: string; roles?: string[]; groups?: string[]; metadata?: Record<string, unknown>; rate_plan_id?: string } = {};
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }
    const { data, error } = await supabase
        .from('platform_users')
        .upsert(
            {
                project_id: validation.context.projectId,
                tenant_id: tid,
                external_id: externalUserId,
                display_name: body.display_name ?? null,
                roles: body.roles ?? [],
                groups: body.groups ?? [],
                metadata: body.metadata ?? {},
                rate_plan_id: body.rate_plan_id ?? null,
                status: 'active',
            },
            { onConflict: 'tenant_id,external_id' },
        )
        .select('*')
        .single();
    if (error || !data) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to upsert user', { requestId }), { requestId });
    }
    return addGatewayHeaders(NextResponse.json(serializeUser(data as Record<string, unknown>), { status: 201 }), { requestId });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ tenantId: string; externalUserId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { tenantId, externalUserId } = await ctx.params;
    const supabase = createAdminClient();
    const tid = await resolveTenantId(supabase, validation.context.projectId, tenantId);
    if (!tid) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
    const { data } = await supabase
        .from('platform_users')
        .select('*')
        .eq('project_id', validation.context.projectId)
        .eq('tenant_id', tid)
        .eq('external_id', externalUserId)
        .maybeSingle();
    if (!data) return addGatewayHeaders(embeddedError(404, 'user_not_found', 'User not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serializeUser(data as Record<string, unknown>)), { requestId });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ tenantId: string; externalUserId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { tenantId, externalUserId } = await ctx.params;
    const supabase = createAdminClient();
    const tid = await resolveTenantId(supabase, validation.context.projectId, tenantId);
    if (!tid) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
    let body: Record<string, unknown> = {};
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const patch: Record<string, unknown> = {};
    if (typeof body.display_name !== 'undefined') patch.display_name = body.display_name;
    if (Array.isArray(body.roles)) patch.roles = body.roles;
    if (Array.isArray(body.groups)) patch.groups = body.groups;
    if (typeof body.metadata !== 'undefined') patch.metadata = body.metadata;
    if (typeof body.rate_plan_id !== 'undefined') patch.rate_plan_id = body.rate_plan_id;
    if (typeof body.status === 'string' && ['active', 'blocked', 'deleted'].includes(body.status as string)) patch.status = body.status;
    if (Object.keys(patch).length === 0) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No updatable fields', { requestId }), { requestId });
    }
    const { data, error } = await supabase
        .from('platform_users')
        .update(patch)
        .eq('project_id', validation.context.projectId)
        .eq('tenant_id', tid)
        .eq('external_id', externalUserId)
        .select('*')
        .maybeSingle();
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    if (!data) return addGatewayHeaders(embeddedError(404, 'user_not_found', 'User not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serializeUser(data as Record<string, unknown>)), { requestId });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ tenantId: string; externalUserId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { tenantId, externalUserId } = await ctx.params;
    const supabase = createAdminClient();
    const tid = await resolveTenantId(supabase, validation.context.projectId, tenantId);
    if (!tid) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
    const url = new URL(req.url);
    // M4: ?hard=true fully forgets the user (row + user-scoped memories); default soft-deletes.
    if (url.searchParams.get('hard') === 'true') {
        const { hardDeleteUser } = await import('@/lib/embedded/deletion');
        await hardDeleteUser(supabase as never, validation.context.projectId, tid, externalUserId);
        return addGatewayHeaders(NextResponse.json({ deleted: true, hard: true }), { requestId });
    }
    const { error } = await supabase
        .from('platform_users')
        .update({ status: 'deleted' })
        .eq('project_id', validation.context.projectId)
        .eq('tenant_id', tid)
        .eq('external_id', externalUserId);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ deleted: true }), { requestId });
}
