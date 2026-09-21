import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { encryptApiKey } from '@/lib/encryption';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    const { encrypted_access_ref, encrypted_refresh_ref, ...rest } = row;
    void encrypted_access_ref;
    void encrypted_refresh_ref;
    return { ...rest, id: withPrefix('con', row.id as string) };
}

async function resolveTenant(supabase: ReturnType<typeof createAdminClient>, projectId: string, tenantId: string | undefined) {
    if (!tenantId) return null;
    const raw = dePrefixId(tenantId);
    const { data } = await supabase.from('platform_tenants').select('id, status').eq('project_id', projectId).eq('id', raw).maybeSingle();
    if (data) return data as { id: string; status: string };
    const { data: byExt } = await supabase.from('platform_tenants').select('id, status').eq('project_id', projectId).eq('external_id', tenantId).maybeSingle();
    return (byExt ?? null) as { id: string; status: string } | null;
}

// POST /v1/connections — secret-key only for credential writes.
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();

    let body: {
        connector?: string; owner_type?: string; tenant_id?: string; external_user_id?: string;
        api_key?: string; scopes?: string[]; metadata?: Record<string, unknown>;
    };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const slug = (body.connector ?? 'gmail').toLowerCase();
    const { data: connector } = await supabase.from('connectors').select('id, slug, auth_type').eq('slug', slug).maybeSingle();
    if (!connector) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Connector not found', { requestId }), { requestId });

    const owner = body.owner_type ?? (body.external_user_id ? 'user' : body.tenant_id ? 'tenant' : 'tenant');
    if (!['tenant', 'user', 'platform'].includes(owner)) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid owner_type', { requestId }), { requestId });
    }
    let tenantId: string | null = null;
    if (body.tenant_id) {
        const tenant = await resolveTenant(supabase, validation.context.projectId, body.tenant_id);
        if (!tenant) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
        tenantId = tenant.id;
    }
    if (owner === 'user' && (!tenantId || !body.external_user_id)) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'User connections require tenant_id and external_user_id', { requestId }), { requestId });
    }

    const patch: Record<string, unknown> = {
        project_id: validation.context.projectId,
        tenant_id: tenantId,
        external_user_id: body.external_user_id ?? null,
        connector_id: (connector.id as string),
        connector_slug: slug,
        owner_type: owner,
        status: body.api_key ? 'active' : 'pending',
        scopes: body.scopes ?? [],
        metadata: body.metadata ?? {},
    };
    if (body.api_key) {
        patch.encrypted_access_ref = encryptApiKey(body.api_key, validation.context.organizationId);
        patch.key_hint = body.api_key.length > 4 ? `...${body.api_key.slice(-4)}` : '****';
    }

    const { data, error } = await supabase.from('tool_connections').insert(patch).select('*').single();
    if (error || !data) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to create connection', { requestId }), { requestId });
    }
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>), { status: 201 }), { requestId });
}

// GET /v1/connections — secrets never returned.
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const url = new URL(req.url);
    const tenantFilter = url.searchParams.get('tenant_id');
    let query = supabase
        .from('tool_connections')
        .select('id, project_id, tenant_id, external_user_id, connector_slug, owner_type, status, key_hint, scopes, expires_at, last_tested_at, last_error, created_at, updated_at')
        .eq('project_id', validation.context.projectId)
        .order('created_at', { ascending: false })
        .limit(100);
    if (tenantFilter) {
        const tenant = await resolveTenant(supabase, validation.context.projectId, tenantFilter);
        if (!tenant) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
        query = query.eq('tenant_id', tenant.id);
    }
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, id: withPrefix('con', r.id as string) })), next_cursor: null }), { requestId });
}
