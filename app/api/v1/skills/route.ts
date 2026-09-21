import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    return {
        id: withPrefix('skl', row.id as string),
        project_id: row.project_id,
        tenant_id: row.tenant_id ? withPrefix('ten', row.tenant_id as string) : null,
        name: row.name,
        slug: row.slug,
        description: row.description ?? null,
        visibility: row.visibility,
        status: row.status,
        created_by: row.created_by ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function resolveTenant(supabase: ReturnType<typeof createAdminClient>, projectId: string, tenantId: string | undefined) {
    if (!tenantId) return null;
    const raw = dePrefixId(tenantId);
    const { data } = await supabase.from('platform_tenants').select('id').eq('project_id', projectId).eq('id', raw).maybeSingle();
    if (data) return data.id as string;
    const { data: byExt } = await supabase.from('platform_tenants').select('id').eq('project_id', projectId).eq('external_id', tenantId).maybeSingle();
    return (byExt?.id as string) ?? null;
}

function slugify(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || `skill-${Date.now().toString(36)}`;
}

// POST /v1/skills — create the stable skill identity (content arrives via versions/imports).
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();

    let body: { name?: string; slug?: string; description?: string; visibility?: string; tenant_id?: string };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.name?.trim()) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'name is required', { requestId }), { requestId });
    const visibility = body.visibility ?? 'private';
    if (!['private', 'tenant', 'public'].includes(visibility)) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid visibility', { requestId }), { requestId });
    }
    let tenantId: string | null = null;
    if (body.tenant_id) {
        tenantId = await resolveTenant(supabase, validation.context.projectId, body.tenant_id);
        if (!tenantId) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
    }
    if (visibility !== 'tenant' && tenantId) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'tenant_id requires tenant visibility', { requestId }), { requestId });
    }

    // Plan caps on library size.
    {
        const { getEmbeddedLimits } = await import('@/lib/entitlements');
        const limits = getEmbeddedLimits((validation.context.tier as import('@/lib/entitlements').SubscriptionTier) ?? 'free');
        const { count } = await supabase.from('skills').select('id', { count: 'exact', head: true }).eq('project_id', validation.context.projectId);
        if ((count ?? 0) >= limits.maxSkills) {
            return addGatewayHeaders(embeddedError(402, 'skill_limit_exceeded', `Skill limit reached for this plan (${limits.maxSkills})`, { requestId }), { requestId });
        }
    }

    const { data, error } = await supabase
        .from('skills')
        .insert({
            project_id: validation.context.projectId,
            tenant_id: tenantId,
            name: body.name.trim(),
            slug: (body.slug?.trim() || slugify(body.name)).toLowerCase(),
            description: body.description ?? null,
            visibility,
        })
        .select('*')
        .single();
    if (error || !data) {
        const conflict = error?.code === '23505';
        return addGatewayHeaders(embeddedError(conflict ? 409 : 500, 'invalid_request_error', error?.message ?? 'Failed to create skill', { requestId }), { requestId });
    }
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>), { status: 201 }), { requestId });
}

// GET /v1/skills — project library (default excludes archived).
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const url = new URL(req.url);
    const visibility = url.searchParams.get('visibility');
    const tenantFilter = url.searchParams.get('tenant_id');
    let query = supabase.from('skills').select('*').eq('project_id', validation.context.projectId).order('created_at', { ascending: false }).limit(100);
    if (visibility) {
        if (!['private', 'tenant', 'public'].includes(visibility)) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid visibility', { requestId }), { requestId });
        }
        query = query.eq('visibility', visibility);
    }
    if (tenantFilter) {
        const tenantId = await resolveTenant(supabase, validation.context.projectId, tenantFilter);
        if (!tenantId) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
        query = query.eq('tenant_id', tenantId);
    }
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: ((data ?? []) as Record<string, unknown>[]).map(serialize), next_cursor: null }), { requestId });
}
