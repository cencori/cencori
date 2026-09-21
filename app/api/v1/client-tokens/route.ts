import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import { mintClientToken } from '@/lib/embedded/client-tokens';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/client-tokens — secret-key only. Mints short-lived browser-safe ect_ token.
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const ctx = validation.context;
    const respond = (r: NextResponse) => addGatewayHeaders(r, { requestId });

    let body: { tenant_id?: string; external_user_id?: string; installation_ids?: string[]; permissions?: string[]; expires_in?: number; session_id?: string };
    try {
        body = await req.json();
    } catch {
        return respond(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }));
    }
    if (!body.tenant_id || !body.external_user_id) {
        return respond(embeddedError(400, 'invalid_request_error', 'tenant_id and external_user_id are required', { requestId }));
    }

    const supabase = createAdminClient();
    const rawTenant = dePrefixId(body.tenant_id);
    const { data: tenant } = await supabase.from('platform_tenants').select('id, status').eq('project_id', ctx.projectId).eq('id', rawTenant).maybeSingle();
    const tenantRow = tenant ?? (await supabase.from('platform_tenants').select('id, status').eq('project_id', ctx.projectId).eq('external_id', body.tenant_id).maybeSingle()).data;
    if (!tenantRow) return respond(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }));
    if ((tenantRow.status as string) !== 'active') return respond(embeddedError(403, 'tenant_suspended', 'Tenant is not active', { requestId }));

    const { data: user } = await supabase
        .from('platform_users')
        .select('id, status')
        .eq('project_id', ctx.projectId)
        .eq('tenant_id', (tenantRow as { id: string }).id)
        .eq('external_id', body.external_user_id)
        .maybeSingle();
    if (!user) return respond(embeddedError(404, 'user_not_found', 'User not found for tenant', { requestId }));
    if ((user.status as string) !== 'active') return respond(embeddedError(403, 'user_not_found', 'User is not active', { requestId }));

    const permissions = Array.isArray(body.permissions) && body.permissions.length > 0
        ? body.permissions
        : ['sessions:create', 'sessions:turn'];
    // Token cannot mint elevated scopes.
    const forbidden = ['tenants:create', 'tenants:delete', 'provider-connections:write', 'agents:publish', 'webhooks:write'];
    if (permissions.some((p) => forbidden.includes(p))) {
        return respond(embeddedError(403, 'invalid_request_error', 'Requested permission is not grantable to client tokens', { requestId }));
    }

    // Installation grants must belong to this project and tenant — a token
    // must never carry another tenant's installation IDs.
    if (body.installation_ids?.length) {
        const { data: installs } = await supabase
            .from('agent_installations')
            .select('id')
            .eq('project_id', ctx.projectId)
            .eq('tenant_id', (tenantRow as { id: string }).id)
            .in('id', body.installation_ids.map(dePrefixId));
        const found = new Set(((installs ?? []) as Array<{ id: string }>).map((i) => i.id));
        const unknown = body.installation_ids.filter((id) => !found.has(dePrefixId(id)));
        if (unknown.length > 0) {
            return respond(embeddedError(404, 'installation_not_found', `Installation not found for tenant: ${unknown[0]}`, { requestId }));
        }
    }

    // A session-scoped token must reference a session in this tenant.
    if (body.session_id) {
        const { data: sess } = await supabase
            .from('sessions')
            .select('id, tenant_id')
            .eq('project_id', ctx.projectId)
            .eq('id', dePrefixId(body.session_id))
            .maybeSingle();
        if (!sess || (sess as { tenant_id: string | null }).tenant_id !== (tenantRow as { id: string }).id) {
            return respond(embeddedError(404, 'invalid_request_error', 'Session not found for tenant', { requestId }));
        }
    }

    const { token, expiresAt } = mintClientToken({
        projectId: ctx.projectId,
        environment: ctx.environment,
        tenantId: (tenantRow as { id: string }).id,
        externalUserId: body.external_user_id,
        installationIds: body.installation_ids,
        permissions,
        sessionId: body.session_id,
        expiresInSeconds: body.expires_in,
    });
    return respond(NextResponse.json({ token, expires_at: expiresAt, tenant_id: body.tenant_id, external_user_id: body.external_user_id }, { status: 201 }));
}
