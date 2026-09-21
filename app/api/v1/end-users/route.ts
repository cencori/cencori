import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /v1/end-users — secret-key list.
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
    const { data, error } = await supabase.from('end_users').select('id, external_id, display_name, email, rate_plan_id, is_blocked, metadata, created_at').eq('project_id', validation.context.projectId).order('created_at', { ascending: false }).limit(limit);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: data ?? [], next_cursor: null }), { requestId });
}

// POST /v1/end-users — secret-key upsert by external_id.
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();

    let body: { external_id?: string; display_name?: string; email?: string; rate_plan_id?: string | null; is_blocked?: boolean; metadata?: Record<string, unknown> };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.external_id?.trim()) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'external_id is required', { requestId }), { requestId });
    if (body.rate_plan_id) {
        const { data: plan } = await supabase.from('rate_plans').select('id').eq('id', body.rate_plan_id).eq('project_id', validation.context.projectId).maybeSingle();
        if (!plan) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Rate plan not found for this project', { requestId }), { requestId });
    }
    const { data: existing } = await supabase.from('end_users').select('id').eq('project_id', validation.context.projectId).eq('external_id', body.external_id.trim()).maybeSingle();
    if (existing) {
        const { data, error } = await supabase.from('end_users').update({
            display_name: body.display_name ?? undefined,
            email: body.email ?? undefined,
            rate_plan_id: body.rate_plan_id ?? undefined,
            is_blocked: body.is_blocked ?? undefined,
            metadata: body.metadata ?? undefined,
        }).eq('id', (existing as { id: string }).id).select('id, external_id, display_name, email, rate_plan_id, is_blocked, metadata').single();
        if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Update failed', { requestId }), { requestId });
        return addGatewayHeaders(NextResponse.json(data), { requestId });
    }
    const { data, error } = await supabase.from('end_users').insert({
        project_id: validation.context.projectId,
        external_id: body.external_id.trim(),
        display_name: body.display_name ?? null,
        email: body.email ?? null,
        rate_plan_id: body.rate_plan_id ?? null,
        is_blocked: body.is_blocked ?? false,
        metadata: body.metadata ?? {},
    }).select('id, external_id, display_name, email, rate_plan_id, is_blocked, metadata').single();
    if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Create failed', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(data, { status: 201 }), { requestId });
}
