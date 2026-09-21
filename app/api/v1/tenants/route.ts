import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, getIdempotencyKey, withPrefix } from '@/lib/embedded/http';
import { TENANT_PREFIX } from '@/lib/embedded/types';
import type { SubscriptionTier } from '@/lib/entitlements';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    return {
        id: withPrefix(TENANT_PREFIX, row.id as string),
        external_id: row.external_id,
        name: row.name,
        status: row.status,
        region: row.region ?? null,
        retention_policy: row.retention_policy ?? {},
        rate_plan_id: row.rate_plan_id ?? null,
        metadata: row.metadata ?? {},
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const ctx = validation.context;
    const respond = (r: NextResponse) => addGatewayHeaders(r, { requestId });

    let body: { external_id?: string; name?: string; region?: string; metadata?: Record<string, unknown>; rate_plan_id?: string };
    try {
        body = await req.json();
    } catch {
        return respond(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }));
    }
    if (!body.external_id?.trim() || !body.name?.trim()) {
        return respond(embeddedError(400, 'invalid_request_error', 'external_id and name are required', { requestId }));
    }

    const supabase = createAdminClient();
    // M4: plan caps (upsert is idempotent — only count when this external_id is new).
    {
        const { data: existing } = await supabase.from('platform_tenants').select('id').eq('project_id', ctx.projectId).eq('external_id', body.external_id.trim()).maybeSingle();
        if (!existing) {
            const { checkTenantCap } = await import('@/lib/embedded/limits');
            const cap = await checkTenantCap(supabase as never, ctx.projectId, (ctx.tier as SubscriptionTier) ?? 'free');
            if (!cap.ok) {
                return respond(embeddedError(402, cap.code, cap.message, { requestId }));
            }
        }
    }
    // Idempotent upsert by (project_id, external_id).
    const { data, error } = await supabase
        .from('platform_tenants')
        .upsert(
            {
                project_id: ctx.projectId,
                external_id: body.external_id.trim(),
                name: body.name.trim(),
                region: body.region ?? null,
                metadata: body.metadata ?? {},
                rate_plan_id: body.rate_plan_id ?? null,
                status: 'active',
            },
            { onConflict: 'project_id,external_id' },
        )
        .select('*')
        .single();
    void getIdempotencyKey(req.headers);
    if (error || !data) {
        return respond(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to create tenant', { requestId }));
    }
    return respond(NextResponse.json(serialize(data as Record<string, unknown>), { status: 201 }));
}

export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const ctx = validation.context;
    const respond = (r: NextResponse) => addGatewayHeaders(r, { requestId });

    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
    const cursor = url.searchParams.get('cursor');
    const status = url.searchParams.get('status');

    const supabase = createAdminClient();
    let query = supabase.from('platform_tenants').select('*').eq('project_id', ctx.projectId).order('created_at', { ascending: false }).limit(limit + 1);
    if (status) query = query.eq('status', status);
    if (cursor) query = query.lt('created_at', cursor);
    const { data, error } = await query;
    if (error) return respond(embeddedError(500, 'invalid_request_error', error.message, { requestId }));
    const rows = (data ?? []) as Record<string, unknown>[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return respond(
        NextResponse.json({
            data: page.map(serialize),
            next_cursor: hasMore ? (page[page.length - 1].created_at as string) : null,
        }),
    );
}
