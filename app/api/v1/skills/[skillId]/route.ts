import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { loadSkill as loadSkillRow, serializeSkill as serialize } from '@/lib/embedded/skills';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

async function loadSkill(supabase: ReturnType<typeof createAdminClient>, projectId: string, skillId: string) {
    return loadSkillRow(supabase as never, projectId, skillId);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ skillId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { skillId } = await ctx.params;
    const row = await loadSkill(createAdminClient(), validation.context.projectId, skillId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Skill not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(row)), { requestId });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ skillId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { skillId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadSkill(supabase, validation.context.projectId, skillId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Skill not found', { requestId }), { requestId });

    let body: Record<string, unknown> = {};
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
    if (typeof body.description !== 'undefined') patch.description = body.description;
    if (typeof body.visibility === 'string') {
        if (!['private', 'tenant', 'public'].includes(body.visibility)) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid visibility', { requestId }), { requestId });
        }
        if (body.visibility === 'tenant' && !(row.tenant_id as string | null)) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'tenant visibility requires a tenant-owned skill', { requestId }), { requestId });
        }
        patch.visibility = body.visibility;
    }
    if (body.status === 'active' || body.status === 'archived') patch.status = body.status;
    if (Object.keys(patch).length === 0) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No updatable fields', { requestId }), { requestId });
    }
    const { data, error } = await supabase.from('skills').update(patch).eq('id', row.id as string).select('*').single();
    if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Update failed', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>)), { requestId });
}
