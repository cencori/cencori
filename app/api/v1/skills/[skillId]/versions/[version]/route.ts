import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

const deSkill = (id: string) => id.replace(/^(skl_)/, '');

function serializeVersion(row: Record<string, unknown>, includeContent: boolean) {
    return {
        id: row.id,
        skill_id: row.skill_id,
        version: row.version,
        status: row.status,
        source_type: row.source_type,
        checksum: row.checksum ?? null,
        scan_findings: row.scan_findings ?? [],
        reviewed_by: row.reviewed_by ?? null,
        published_at: row.published_at ?? null,
        created_at: row.created_at,
        ...(includeContent ? { content: row.content } : {}),
    };
}

export async function loadSkillVersion(supabase: ReturnType<typeof createAdminClient>, projectId: string, skillId: string, version: string) {
    const { data: skill } = await supabase.from('skills').select('id').eq('project_id', projectId).eq('id', deSkill(dePrefixId(skillId))).maybeSingle();
    const skillRow = skill ?? (await supabase.from('skills').select('id').eq('project_id', projectId).eq('slug', skillId).maybeSingle()).data;
    if (!skillRow) return null;
    const { data } = await supabase.from('skill_versions').select('*').eq('skill_id', (skillRow as { id: string }).id).eq('version', version).maybeSingle();
    const row = data ?? (await supabase.from('skill_versions').select('*').eq('id', version).eq('skill_id', (skillRow as { id: string }).id).maybeSingle()).data;
    return (row ?? null) as Record<string, unknown> | null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ skillId: string; version: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { skillId, version } = await ctx.params;
    const row = await loadSkillVersion(createAdminClient(), validation.context.projectId, skillId, version);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Skill version not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serializeVersion(row, true)), { requestId });
}
