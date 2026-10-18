import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import { ConnectorOpError, fetchOpenApiSpec, parseOpenApiOps, parseOpenApiBaseUrl } from '@/lib/embedded/connector-ops';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/connections/:id/import — extract connector operations from an
// OpenAPI 3.x spec (inline or fetchable URL) into the connection's metadata;
// granted manifest `connection_tools` become hosted tools from this catalog.
export async function POST(req: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { connectionId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: conn } = await supabase.from('tool_connections').select('*').eq('project_id', validation.context.projectId).eq('id', dePrefixId(connectionId)).maybeSingle();
    if (!conn) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Connection not found', { requestId }), { requestId });
    const c = conn as { id: string; metadata: Record<string, unknown>; status: string };

    let body: { spec?: unknown; spec_url?: string; operations?: string[] } = {};
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }
    if (!body.spec && !body.spec_url) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Provide an inline `spec` or a https `spec_url`', { requestId }), { requestId });
    }

    try {
        const raw = body.spec ?? await fetchOpenApiSpec(body.spec_url as string);
        const operations = parseOpenApiOps(raw, body.operations);
        const specBaseUrl = parseOpenApiBaseUrl(raw);
        const baseUrl = specBaseUrl
            ?? (typeof c.metadata.base_url === 'string' && c.metadata.base_url.startsWith('https://') ? c.metadata.base_url : null);
        if (!baseUrl) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Spec declares no https server; set connection metadata.base_url', { requestId }), { requestId });
        }
        const title = typeof (raw as Record<string, unknown>).info === 'object' && (raw as Record<string, unknown>).info !== null
            ? ((raw as Record<string, unknown>).info as Record<string, unknown>).title
            : undefined;
        const metadata = {
            ...(c.metadata ?? {}),
            base_url: baseUrl,
            operations,
            openapi: {
                imported_at: new Date().toISOString(),
                ...(typeof title === 'string' ? { title } : {}),
                ...(body.spec_url ? { source: body.spec_url } : {}),
            },
        };
        const { error } = await supabase.from('tool_connections').update({ metadata }).eq('id', c.id);
        if (error) {
            return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
        }
        return addGatewayHeaders(NextResponse.json({
            imported: operations.length,
            base_url: baseUrl,
            ...(typeof title === 'string' ? { title } : {}),
            operations: operations.map((op) => op.name),
        }), { requestId });
    } catch (e) {
        const status = e instanceof ConnectorOpError ? e.status : 400;
        const message = e instanceof Error ? e.message : 'Import failed';
        return addGatewayHeaders(embeddedError(status, 'invalid_request_error', message, { requestId }), { requestId });
    }
}
