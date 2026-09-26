import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

async function loadServer(supabase: ReturnType<typeof createAdminClient>, projectId: string, serverId: string) {
    const { data } = await supabase.from('mcp_servers').select('*').eq('project_id', projectId).eq('id', dePrefixId(serverId)).maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
}

// GET /v1/mcp/servers/:serverId/tools — stored snapshot (no live call).
// Live re-discovery lives at POST .../refresh-tools (single canonical path).
export async function GET(req: NextRequest, ctx: { params: Promise<{ serverId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { serverId } = await ctx.params;
    const row = await loadServer(createAdminClient(), validation.context.projectId, serverId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'MCP server not found', { requestId }), { requestId });
    const snapshot = ((row.tool_snapshot ?? {}) as { tools?: unknown[] });
    return addGatewayHeaders(NextResponse.json({ server_id: withPrefix('mcp', row.id as string), tools: snapshot.tools ?? [], last_discovered_at: row.last_discovered_at ?? null, status: row.status }), { requestId });
}
