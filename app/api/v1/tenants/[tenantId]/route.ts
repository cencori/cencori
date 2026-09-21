import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, withPrefix } from '@/lib/embedded/http';
import { TENANT_PREFIX } from '@/lib/embedded/types';
import { dePrefixId } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    return {
        id: withPrefix(TENANT_PREFIX, row.id as string),
        external_id: row.external_id,
        name: row.name,
        status: row.status,
        region: row.region ?? null,
        retention_policy: row.retention_policy ?? {},
        rate_plan_id: row.rate_plan_id ?? null,
        metadata: row.metadata ?? {},
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function loadTenant(supabase: ReturnType<typeof createAdminClient>, projectId: string, tenantId: string) {
    const id = dePrefixId(tenantId);
    // Accept uuid PK or external_id.
    const { data } = await supabase.from('platform_tenants').select('*').eq('project_id', projectId).eq('id', id).maybeSingle();
    if (data) return data as Record<string, unknown>;
    const { data: byExternal } = await supabase
        .from('platform_tenants')
        .select('*')
        .eq('project_id', projectId)
        .eq('external_id', tenantId)
        .maybeSingle();
    return (byExternal ?? null) as Record<string, unknown> | null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ tenantId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { tenantId } = await ctx.params;
    const supabase = createAdminClient();
    const tenant = await loadTenant(supabase, validation.context.projectId, tenantId);
    if (!tenant) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(tenant)), { requestId });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ tenantId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { tenantId } = await ctx.params;
    const supabase = createAdminClient();
    const tenant = await loadTenant(supabase, validation.context.projectId, tenantId);
    if (!tenant) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });

    let body: { name?: string; metadata?: Record<string, unknown>; rate_plan_id?: string | null; region?: string | null };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const patch: Record<string, unknown> = {};
    if (body.name?.trim()) patch.name = body.name.trim();
    if (body.metadata) patch.metadata = body.metadata;
    if (body.region !== undefined) patch.region = body.region;
    if (body.rate_plan_id !== undefined) patch.rate_plan_id = body.rate_plan_id;
    if (Object.keys(patch).length === 0) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No updatable fields', { requestId }), { requestId });
    }
    const { data, error } = await supabase.from('platform_tenants').update(patch).eq('id', tenant.id as string).select('*').single();
    if (error || !data) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Update failed', { requestId }), { requestId });
    }
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>)), { requestId });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ tenantId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { tenantId } = await ctx.params;
    const supabase = createAdminClient();
    const tenant = await loadTenant(supabase, validation.context.projectId, tenantId);
    if (!tenant) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });

    // M4: full cascade hard delete (idempotent — missing tenant is 404 above).
    // Mark deleting first so concurrent writers fail closed, then cascade.
    await supabase.from('platform_tenants').update({ status: 'deleting' }).eq('id', tenant.id as string);
    const { cascadeDeleteTenant } = await import('@/lib/embedded/deletion');
    const summary = await cascadeDeleteTenant(supabase as never, validation.context.projectId, tenant.id as string);
    try {
        const { emitEmbeddedEvent } = await import('@/lib/embedded/runs');
        await emitEmbeddedEvent(validation.context.projectId, 'tenant.deleted' as never, { tenant_id: tenant.id });
    } catch {
        // ignore
    }
    return addGatewayHeaders(NextResponse.json({ id: withPrefix(TENANT_PREFIX, tenant.id as string), status: 'deleted', deleted: summary.deleted }), { requestId });
}
