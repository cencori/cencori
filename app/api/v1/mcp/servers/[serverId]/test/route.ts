import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { assertSafeOutboundUrl } from '@/lib/security/outbound-url';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/mcp/servers/:serverId/test — live handshake probe without persisting.
export async function POST(req: NextRequest, ctx: { params: Promise<{ serverId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { serverId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: row } = await supabase.from('mcp_servers').select('*').eq('project_id', validation.context.projectId).eq('id', dePrefixId(serverId)).maybeSingle();
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'MCP server not found', { requestId }), { requestId });
    const r = row as Record<string, unknown>;

    let safeUrl: URL;
    try {
        safeUrl = await assertSafeOutboundUrl(r.url as string);
    } catch (e) {
        return addGatewayHeaders(embeddedError(400, 'unsafe_provider_url', e instanceof Error ? e.message : 'Unsafe URL', { requestId }), { requestId });
    }
    const started = Date.now();
    try {
        const { discoverMcpTools, mcpAuthHeaders } = await import('@/lib/embedded/mcp');
        const headers = await mcpAuthHeaders(supabase as never, validation.context.projectId, validation.context.organizationId, r.auth_connection_id as string | null);
        const discovered = await discoverMcpTools({ url: safeUrl.toString(), headers, transport: r.transport === 'sse' ? 'sse' : 'streamable-http' });
        return addGatewayHeaders(
            NextResponse.json({ id: withPrefix('mcp', r.id as string), success: true, transport: discovered.transport, tool_count: discovered.tools.length, latency_ms: Date.now() - started }),
            { requestId },
        );
    } catch (e) {
        return addGatewayHeaders(
            NextResponse.json({ id: withPrefix('mcp', r.id as string), success: false, error: e instanceof Error ? e.message.slice(0, 300) : 'Probe failed', latency_ms: Date.now() - started }),
            { requestId },
        );
    }
}
