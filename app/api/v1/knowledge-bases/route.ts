import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    return {
        id: withPrefix('kb', row.id as string),
        project_id: row.project_id,
        tenant_id: row.tenant_id ? withPrefix('ten', row.tenant_id as string) : null,
        name: row.name,
        scope_type: row.scope_type,
        region: row.region ?? null,
        retention_policy: row.retention_policy ?? {},
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function resolveTenant(supabase: ReturnType<typeof createAdminClient>, projectId: string, tenantId: string | null | undefined) {
    if (!tenantId) return null;
    const raw = dePrefixId(tenantId);
    const { data } = await supabase.from('platform_tenants').select('id, status').eq('project_id', projectId).eq('id', raw).maybeSingle();
    if (data) return data as { id: string; status: string };
    const { data: byExt } = await supabase.from('platform_tenants').select('id, status').eq('project_id', projectId).eq('external_id', tenantId).maybeSingle();
    return (byExt ?? null) as { id: string; status: string } | null;
}

export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();

    let body: { name?: string; tenant_id?: string; scope_type?: string; region?: string; retention_policy?: Record<string, unknown> };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.name?.trim()) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'name is required', { requestId }), { requestId });

    let tenantId: string | null = null;
    if (body.tenant_id) {
        const tenant = await resolveTenant(supabase, validation.context.projectId, body.tenant_id);
        if (!tenant) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
        tenantId = tenant.id;
    }
    const scope = body.scope_type ?? (tenantId ? 'tenant' : 'platform');
    if (!['platform', 'tenant', 'group'].includes(scope)) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid scope_type', { requestId }), { requestId });
    }

    const { data, error } = await supabase
        .from('knowledge_bases')
        .insert({ project_id: validation.context.projectId, tenant_id: tenantId, name: body.name.trim(), scope_type: scope, region: body.region ?? null, retention_policy: body.retention_policy ?? {} })
        .select('*')
        .single();
    if (error || !data) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to create knowledge base', { requestId }), { requestId });
    }
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>), { status: 201 }), { requestId });
}

export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const url = new URL(req.url);
    const tenantFilter = url.searchParams.get('tenant_id');
    let query = supabase.from('knowledge_bases').select('*').eq('project_id', validation.context.projectId).order('created_at', { ascending: false }).limit(100);
    if (tenantFilter) {
        const tenant = await resolveTenant(supabase, validation.context.projectId, tenantFilter);
        if (!tenant) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
        query = query.eq('tenant_id', tenant.id);
    }
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: ((data ?? []) as Record<string, unknown>[]).map(serialize), next_cursor: null }), { requestId });
}
