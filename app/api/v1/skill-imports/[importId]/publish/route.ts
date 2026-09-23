import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import { hasBlockers } from '@/lib/embedded/skill-scan';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function slugify(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || `skill-${Date.now().toString(36)}`;
}

// POST /v1/skill-imports/:importId/publish — review gate: creates or updates a
// skill definition and emits an immutable published version from the pinned,
// scanned content. Rejects staged imports with blocking findings.
export async function POST(req: NextRequest, ctx: { params: Promise<{ importId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { importId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: imp } = await supabase.from('skill_imports').select('*').eq('project_id', validation.context.projectId).eq('id', importId).maybeSingle();
    if (!imp) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Skill import not found', { requestId }), { requestId });
    const importRow = imp as {
        id: string; status: string; tenant_id: string | null; scan_findings: Array<{ severity?: string }>;
        normalized_manifest: { files?: Array<{ path: string; content?: string }> }; checksum: string | null;
    };
    if (importRow.status === 'published') {
        const { data: ver } = await supabase.from('skill_versions').select('id').eq('id', (imp as { published_skill_version_id?: string }).published_skill_version_id ?? '').maybeSingle();
        return addGatewayHeaders(NextResponse.json({ import_id: importRow.id, status: 'published', skill_version_id: (ver as { id?: string } | null)?.id ?? null, deduped: true }), { requestId });
    }
    if (importRow.status !== 'ready_for_review') {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Import is ${importRow.status}; only staged imports can publish`, { requestId }), { requestId });
    }
    if (hasBlockers(importRow.scan_findings as never)) {
        return addGatewayHeaders(embeddedError(422, 'invalid_request_error', 'Import has blocking scan findings; reject it or stage a clean source', { requestId }), { requestId });
    }
    const files = (importRow.normalized_manifest.files ?? []).filter((f) => typeof f.content === 'string' && f.content.length > 0);
    if (files.length === 0) {
        return addGatewayHeaders(embeddedError(422, 'invalid_request_error', 'Import has no publishable content', { requestId }), { requestId });
    }

    let body: { skill_id?: string; name?: string; slug?: string; description?: string; visibility?: string; version?: string; reviewed_by?: string };
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }

    // Resolve or create the skill identity.
    let skillId: string | null = null;
    if (body.skill_id) {
        const { data: skill } = await supabase.from('skills').select('id, tenant_id').eq('project_id', validation.context.projectId).eq('id', body.skill_id.replace(/^(skl_)/, '')).maybeSingle();
        if (!skill) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Skill not found', { requestId }), { requestId });
        // Imported content must not cross tenant scope: the staged import and
        // the target skill must agree on tenant ownership.
        const skillTenant = (skill as { tenant_id: string | null }).tenant_id ?? null;
        if (skillTenant !== importRow.tenant_id) {
            return addGatewayHeaders(embeddedError(403, 'tenant_scope_mismatch', 'Import scope does not match the target skill tenant scope', { requestId }), { requestId });
        }
        skillId = (skill as { id: string }).id;
    } else {
        if (!body.name?.trim()) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'name is required to create the skill', { requestId }), { requestId });
        const visibility = body.visibility ?? (importRow.tenant_id ? 'tenant' : 'private');
        if (!['private', 'tenant', 'public'].includes(visibility)) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid visibility', { requestId }), { requestId });
        }
        if ((visibility === 'tenant') !== Boolean(importRow.tenant_id)) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Tenant visibility and tenant ownership must agree', { requestId }), { requestId });
        }
        const { data: skill, error: skillError } = await supabase
            .from('skills')
            .insert({
                project_id: validation.context.projectId,
                tenant_id: importRow.tenant_id,
                name: body.name.trim(),
                slug: (body.slug?.trim() || slugify(body.name)).toLowerCase(),
                description: body.description ?? null,
                visibility,
            })
            .select('id')
            .single();
        if (skillError || !skill) {
            return addGatewayHeaders(embeddedError(500, 'invalid_request_error', skillError?.message ?? 'Failed to create skill', { requestId }), { requestId });
        }
        skillId = (skill as { id: string }).id;
    }

    const combined = files.map((f) => `# ${f.path}\n\n${f.content}`).join('\n\n');
    const { data: versionRow, error: versionError } = await supabase
        .from('skill_versions')
        .insert({
            skill_id: skillId,
            project_id: validation.context.projectId,
            version: body.version?.trim() || '1.0.0',
            status: 'published',
            content: combined,
            source_type: 'imported',
            source_uri: (imp as { source_ref?: string }).source_ref ?? null,
            source_revision: importRow.checksum,
            checksum: importRow.checksum,
            scan_findings: importRow.scan_findings,
            reviewed_by: body.reviewed_by ?? null,
            published_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    if (versionError || !versionRow) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', versionError?.message ?? 'Failed to publish version', { requestId }), { requestId });
    }
    await supabase.from('skill_imports').update({
        status: 'published',
        reviewed_by: body.reviewed_by ?? null,
        published_skill_version_id: (versionRow as { id: string }).id,
    }).eq('id', importRow.id);

    return addGatewayHeaders(
        NextResponse.json({ import_id: importRow.id, status: 'published', skill_id: skillId, skill_version_id: (versionRow as { id: string }).id }, { status: 201 }),
        { requestId },
    );
}
