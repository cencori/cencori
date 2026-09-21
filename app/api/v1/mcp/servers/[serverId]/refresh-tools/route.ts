import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/mcp/servers/:serverId/refresh-tools — alias honoring the PRD path.
export async function POST(req: NextRequest, ctx: { params: Promise<{ serverId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { serverId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: row } = await supabase.from('mcp_servers').select('*').eq('project_id', validation.context.projectId).eq('id', dePrefixId(serverId)).maybeSingle();
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'MCP server not found', { requestId }), { requestId });

    const { assertSafeOutboundUrl } = await import('@/lib/security/outbound-url');
    const { discoverMcpTools, diffToolSnapshot, mcpAuthHeaders } = await import('@/lib/embedded/mcp');
    const r = row as Record<string, unknown>;

    let safeUrl: URL;
    try {
        safeUrl = await assertSafeOutboundUrl(r.url as string);
    } catch {
        await supabase.from('mcp_servers').update({ status: 'unhealthy', last_error: 'Unsafe URL' }).eq('id', r.id as string);
        return addGatewayHeaders(embeddedError(400, 'unsafe_provider_url', 'Stored MCP URL no longer passes safety checks', { requestId }), { requestId });
    }
    const headers = await mcpAuthHeaders(supabase as never, validation.context.projectId, validation.context.organizationId, r.auth_connection_id as string | null);
    const previous = (((r.tool_snapshot ?? {}) as { tools?: Array<{ name: string }> }).tools ?? []);
    try {
        const discovered = await discoverMcpTools({ url: safeUrl.toString(), headers, transport: r.transport === 'sse' ? 'sse' : 'streamable-http' });
        const diff = diffToolSnapshot(previous, discovered.tools);
        const snapshot = { tools: discovered.tools, discovered_at: new Date().toISOString(), transport_negotiated: discovered.transport };
        await supabase.from('mcp_servers').update({ tool_snapshot: snapshot, last_discovered_at: snapshot.discovered_at, status: 'active', last_error: null }).eq('id', r.id as string);
        return addGatewayHeaders(NextResponse.json({ tools: discovered.tools, diff }), { requestId });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Discovery failed';
        await supabase.from('mcp_servers').update({ status: 'unhealthy', last_error: message.slice(0, 500) }).eq('id', r.id as string);
        return addGatewayHeaders(embeddedError(502, 'invalid_request_error', message, { requestId }), { requestId });
    }
}
