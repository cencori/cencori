import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { loadSkillVersion, serializeSkillVersion } from '@/lib/embedded/skills';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST .../deprecate — published|deprecated → deprecated (idempotent).
export async function POST(req: NextRequest, ctx: { params: Promise<{ skillId: string; version: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { skillId, version } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadSkillVersion(supabase as never, validation.context.projectId, skillId, version);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Skill version not found', { requestId }), { requestId });
    const current = (row.status as string) ?? 'draft';
    if (!['published', 'deprecated'].includes(current)) {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Cannot deprecate from status ${current}`, { requestId }), { requestId });
    }
    const { data, error } = await supabase.from('skill_versions').update({ status: 'deprecated' }).eq('id', row.id as string).select('*').single();
    if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Deprecate failed', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serializeSkillVersion(data as Record<string, unknown>, false)), { requestId });
}
