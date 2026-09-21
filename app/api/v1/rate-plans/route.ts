import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /v1/rate-plans — secret-key list.
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('rate_plans').select('*').eq('project_id', validation.context.projectId).order('created_at', { ascending: false }).limit(100);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: data ?? [], next_cursor: null }), { requestId });
}

// POST /v1/rate-plans — secret-key create (minimal fields; full config via dashboard).
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    let body: { name?: string; slug?: string; markup_percentage?: number; flat_rate?: number; currency?: string };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.name?.trim()) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'name is required', { requestId }), { requestId });
    const { data, error } = await supabase.from('rate_plans').insert({
        project_id: validation.context.projectId,
        name: body.name.trim(),
        slug: body.slug ?? body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        markup_percentage: body.markup_percentage ?? 0,
        flat_rate: body.flat_rate ?? 0,
        currency: body.currency ?? 'USD',
    }).select('*').single();
    if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Create failed', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(data, { status: 201 }), { requestId });
}
