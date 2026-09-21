import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { hasBlockers } from '@/lib/embedded/skill-scan';
import { loadSkillVersion, serializeSkillVersion } from '@/lib/embedded/skills';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST .../publish — published versions are immutable; blockers reject publication.
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
    if (!['draft', 'validating', 'ready_for_review'].includes(current)) {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Cannot publish from status ${current}`, { requestId }), { requestId });
    }
    const findings = ((row.scan_findings ?? []) as Array<{ severity?: string }>);
    if (hasBlockers(findings as never)) {
        return addGatewayHeaders(embeddedError(422, 'invalid_request_error', 'Version has blocking scan findings; resolve them and create a new version', { requestId }), { requestId });
    }
    let reviewedBy: string | null = null;
    try {
        reviewedBy = ((await req.json().catch(() => ({}))) as { reviewed_by?: string }).reviewed_by ?? null;
    } catch {
        reviewedBy = null;
    }
    const { data, error } = await supabase.from('skill_versions').update({ status: 'published', published_at: new Date().toISOString(), reviewed_by: reviewedBy }).eq('id', row.id as string).select('*').single();
    if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Publish failed', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serializeSkillVersion(data as Record<string, unknown>, false)), { requestId });
}
