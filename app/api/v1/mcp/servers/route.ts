import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { assertSafeOutboundUrl } from '@/lib/security/outbound-url';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    return { ...row, id: withPrefix('mcp', row.id as string) };
}

async function resolveTenant(supabase: ReturnType<typeof createAdminClient>, projectId: string, tenantId: string | undefined) {
    if (!tenantId) return null;
    const raw = dePrefixId(tenantId);
    const { data } = await supabase.from('platform_tenants').select('id').eq('project_id', projectId).eq('id', raw).maybeSingle();
    if (data) return data.id as string;
    const { data: byExt } = await supabase.from('platform_tenants').select('id').eq('project_id', projectId).eq('external_id', tenantId).maybeSingle();
    return (byExt?.id as string) ?? null;
}

async function snapshotFor(supabase: ReturnType<typeof createAdminClient>, projectId: string, url: string, authConnectionId: string | null, organizationId: string, transport?: string) {
    const { mcpAuthHeaders, discoverMcpTools } = await import('@/lib/embedded/mcp');
    const headers = await mcpAuthHeaders(supabase as never, projectId, organizationId, authConnectionId);
    return discoverMcpTools({ url, headers, transport: transport === 'sse' ? 'sse' : 'streamable-http' });
}

// POST /v1/mcp/servers — register + discover.
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();

    let body: { name?: string; url?: string; transport?: string; tenant_id?: string; auth_connection_id?: string };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.name?.trim() || !body.url?.trim()) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'name and url are required', { requestId }), { requestId });
    }
    // The legacy HTTP+SSE transport is deprecated by the spec and not
    // implemented: Streamable HTTP (modern stateless with legacy handshake
    // fallback) is the only supported transport for new servers. Rows created
    // before this change keep working through the legacy POST path.
    if (body.transport === 'sse') {
        return addGatewayHeaders(embeddedError(400, 'unsupported_transport', 'The sse transport is not supported; register the server URL with transport streamable-http', { requestId }), { requestId });
    }
    let safeUrl: URL;
    try {
        safeUrl = await assertSafeOutboundUrl(body.url.trim());
    } catch (e) {
        return addGatewayHeaders(embeddedError(400, 'unsafe_provider_url', e instanceof Error ? e.message : 'Unsafe URL', { requestId }), { requestId });
    }
    const tenantId = await resolveTenant(supabase, validation.context.projectId, body.tenant_id);
    if (body.tenant_id && !tenantId) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });

    let snapshot: Record<string, unknown> = { tools: [], discovered_at: null };
    let status = 'active';
    let lastError: string | null = null;
    try {
        const discovered = await snapshotFor(supabase, validation.context.projectId, safeUrl.toString(), body.auth_connection_id ? dePrefixId(body.auth_connection_id) : null, validation.context.organizationId, body.transport);
        snapshot = { tools: discovered.tools, discovered_at: new Date().toISOString(), transport_negotiated: discovered.transport };
    } catch (e) {
        status = 'unhealthy';
        lastError = e instanceof Error ? e.message.slice(0, 500) : 'Discovery failed';
    }

    const { data, error } = await supabase
        .from('mcp_servers')
        .insert({
            project_id: validation.context.projectId,
            tenant_id: tenantId,
            name: body.name.trim(),
            url: safeUrl.toString(),
            transport: body.transport === 'sse' ? 'sse' : 'streamable-http',
            auth_connection_id: body.auth_connection_id ? dePrefixId(body.auth_connection_id) : null,
            status,
            tool_snapshot: snapshot,
            last_discovered_at: snapshot.discovered_at as string | null,
            last_error: lastError,
        })
        .select('*')
        .single();
    if (error || !data) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to register MCP server', { requestId }), { requestId });
    }
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>), { status: 201 }), { requestId });
}
