import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function normalizeUrl(url: string): string {
    return url.replace(/\/+$/, '');
}

// GET /v1/mcp/registry — curated remote MCP server catalog (secret-key only).
// Reference data: rows come from mcp_server_registry; `registered` marks
// servers already connected by this project.
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const category = new URL(req.url).searchParams.get('category');
    const strip = 'slug, name, description, category, vendor, url, transport, requires_auth, docs_url, verified, verified_at';
    let query = supabase.from('mcp_server_registry').select(strip).order('category', { ascending: true }).order('name', { ascending: true });
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    const { data: registered } = await supabase.from('mcp_servers').select('url, status').eq('project_id', validation.context.projectId);
    const registeredUrls = new Set(((registered ?? []) as Array<{ url?: string | null }>).map((row) => (row.url ?? '').replace(/\/+$/, '')));
    const items = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        ...row,
        registered: registeredUrls.has(normalizeUrl(String(row.url))),
    }));
    return addGatewayHeaders(NextResponse.json({ data: items, next_cursor: null }), { requestId });
}
