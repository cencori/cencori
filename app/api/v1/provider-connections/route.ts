import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, withPrefix } from '@/lib/embedded/http';
import { PROVIDER_CONNECTION_PREFIX } from '@/lib/embedded/types';
import { persistConnection, sanitizeConnection } from '@/lib/embedded/provider-connections';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    const clean = sanitizeConnection(row);
    return { ...clean, id: withPrefix(PROVIDER_CONNECTION_PREFIX, row.id as string) };
}

export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    const ctx = validation.context;
    const respond = (r: NextResponse) => addGatewayHeaders(r, { requestId });
    if (ctx.keyType !== 'secret') return respond(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }));
    let body: { name?: string; provider?: string; api_format?: 'openai' | 'anthropic' | 'openai-compatible' | 'anthropic-compatible'; base_url?: string; api_key?: string };
    try {
        body = await req.json();
    } catch {
        return respond(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }));
    }
    if (!body.name || !body.provider) {
        return respond(embeddedError(400, 'invalid_request_error', 'name and provider are required', { requestId }));
    }
    const supabase = createAdminClient();
    // M4: plan caps.
    {
        const { checkProviderConnectionCap } = await import('@/lib/embedded/limits');
        const cap = await checkProviderConnectionCap(supabase as never, ctx.projectId, (ctx.tier as import('@/lib/entitlements').SubscriptionTier) ?? 'free');
        if (!cap.ok) {
            return respond(embeddedError(402, cap.code, cap.message, { requestId }));
        }
    }
    try {
        const { id } = await persistConnection(supabase as never, {
            projectId: ctx.projectId,
            organizationId: ctx.organizationId,
            input: { name: body.name, provider: body.provider, apiFormat: body.api_format, baseUrl: body.base_url, apiKey: body.api_key },
            idempotencyKey: req.headers.get('Idempotency-Key'),
        });
        const { data } = await supabase.from('provider_connections').select('*').eq('id', id).single();
        return respond(NextResponse.json(serialize(data as Record<string, unknown>), { status: 201 }));
    } catch (e) {
        const err = e as { code?: string; message?: string; status?: number };
        return respond(embeddedError(err.status ?? 400, err.code ?? 'invalid_request_error', err.message ?? 'Failed to create connection', { requestId }));
    }
}

export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('provider_connections')
        .select('id, project_id, name, provider, api_format, base_url, key_hint, status, last_tested_at, last_synced_at, created_at, updated_at')
        .eq('project_id', validation.context.projectId)
        .order('created_at', { ascending: false })
        .limit(100);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: ((data ?? []) as Record<string, unknown>[]).map(serialize), next_cursor: null }), { requestId });
}
