import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { checksumSkillFiles, hasBlockers, normalizeSkillFiles, scanSkillFiles } from '@/lib/embedded/skill-scan';
import { loadSkill, serializeSkillVersion as serializeVersion } from '@/lib/embedded/skills';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/skills/:skillId/versions — draft content with scan findings attached.
export async function POST(req: NextRequest, ctx: { params: Promise<{ skillId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { skillId } = await ctx.params;
    const supabase = createAdminClient();
    const skill = await loadSkill(supabase as never, validation.context.projectId, skillId);
    if (!skill) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Skill not found', { requestId }), { requestId });

    let body: { version?: string; content?: string; files?: Array<{ path?: string; content?: unknown }> };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.version?.trim()) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'version is required', { requestId }), { requestId });
    const raw = body.files ?? (body.content !== undefined ? [{ path: 'SKILL.md', content: body.content }] : []);
    if (raw.length === 0) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'content or files are required', { requestId }), { requestId });

    const { files, findings: normalizeFindings } = normalizeSkillFiles(raw);
    const findings = [...normalizeFindings, ...scanSkillFiles(files)];
    if (files.length === 0) {
        return addGatewayHeaders(embeddedError(422, 'invalid_request_error', 'No importable content after normalization', { requestId }), { requestId });
    }
    const combined = files.map((f) => `# ${f.path}\n\n${f.content}`).join('\n\n');

    const { data, error } = await supabase
        .from('skill_versions')
        .insert({
            skill_id: skill.id,
            project_id: validation.context.projectId,
            version: body.version.trim(),
            status: 'draft',
            content: combined,
            source_type: 'authored',
            checksum: checksumSkillFiles(files),
            scan_findings: findings,
        })
        .select('*')
        .single();
    if (error || !data) {
        const conflict = error?.code === '23505';
        return addGatewayHeaders(embeddedError(conflict ? 409 : 500, 'invalid_request_error', error?.message ?? 'Failed to create version', { requestId }), { requestId });
    }
    const row = data as Record<string, unknown>;
    return addGatewayHeaders(NextResponse.json({ ...serializeVersion(row, false), blocked: hasBlockers(findings) }, { status: 201 }), { requestId });
}

// GET /v1/skills/:skillId/versions — version list (content excluded; fetch one to read).
export async function GET(req: NextRequest, ctx: { params: Promise<{ skillId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { skillId } = await ctx.params;
    const supabase = createAdminClient();
    const skill = await loadSkill(supabase as never, validation.context.projectId, skillId);
    if (!skill) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Skill not found', { requestId }), { requestId });
    const { data, error } = await supabase.from('skill_versions').select('*').eq('skill_id', skill.id).order('created_at', { ascending: false }).limit(100);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: ((data ?? []) as Record<string, unknown>[]).map((r) => serializeVersion(r, false)), next_cursor: null }), { requestId });
}
