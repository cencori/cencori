import { NextRequest, NextResponse } from 'next/server';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { validateConnectionInput } from '@/lib/embedded/provider-connections';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/provider-connections/validate — ephemeral check, persists nothing.
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const respond = (r: NextResponse) => addGatewayHeaders(r, { requestId });
    let body: { provider?: string; base_url?: string; api_key?: string; api_format?: 'openai' | 'anthropic' | 'openai-compatible' | 'anthropic-compatible'; discovery?: boolean };
    try {
        body = await req.json();
    } catch {
        return respond(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }));
    }
    if (!body.provider) return respond(embeddedError(400, 'invalid_request_error', 'provider is required', { requestId }));
    const checked = await validateConnectionInput(
        { name: 'validation', provider: body.provider, apiFormat: body.api_format, baseUrl: body.base_url, apiKey: body.api_key },
        { organizationId: validation.context.organizationId },
    );
    if (!checked.ok) {
        return respond(NextResponse.json({ valid: false, code: checked.code, message: checked.message }, { status: 422 }));
    }
    // M0: structural validation only (reachability + discovery happen in /test and model-syncs).
    return respond(NextResponse.json({ valid: true, base_url: checked.baseUrl, discovery_supported: body.discovery !== false }));
}
