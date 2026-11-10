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
        if ((body.visibility === 'tenant') !== Boolean(row.tenant_id)) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Tenant visibility and tenant ownership must agree', { requestId }), { requestId });
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

// DELETE /v1/skills/:id — permanent. Removes the skill and every version of it.
// Refuses while a published agent version still pins one of its versions,
// unless `?force=true`, which unpins first: those agent versions keep running
// and simply stop loading the skill (the same effect as archiving it).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ skillId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { skillId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadSkill(supabase, validation.context.projectId, skillId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Skill not found', { requestId }), { requestId });
    const force = new URL(req.url).searchParams.get('force') === 'true';

    const { data: versions, error: versionsError } = await supabase.from('skill_versions').select('id').eq('skill_id', row.id as string);
    if (versionsError) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', versionsError.message, { requestId }), { requestId });
    const versionIds = ((versions ?? []) as Array<{ id: string }>).map((v) => v.id);

    let unpinned = 0;
    if (versionIds.length > 0) {
        const { data: pins, error: pinsError } = await supabase.from('agent_version_skills').select('agent_version_id').in('skill_version_id', versionIds);
        if (pinsError) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', pinsError.message, { requestId }), { requestId });
        const pinnedBy = [...new Set(((pins ?? []) as Array<{ agent_version_id: string }>).map((p) => p.agent_version_id))];
        if (pinnedBy.length > 0 && !force) {
            return addGatewayHeaders(embeddedError(
                409,
                'skill_in_use',
                `Skill is pinned by ${pinnedBy.length} agent version${pinnedBy.length === 1 ? '' : 's'}. Retry with ?force=true to unpin and delete it, or archive it instead.`,
                { requestId, details: { agent_version_ids: pinnedBy.slice(0, 50).map((id) => `agv_${id}`) } },
            ), { requestId });
        }
        if (pinnedBy.length > 0) {
            const { error: unpinError } = await supabase.from('agent_version_skills').delete().in('skill_version_id', versionIds);
            if (unpinError) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', unpinError.message, { requestId }), { requestId });
            unpinned = pinnedBy.length;
        }
    }

    // Versions cascade with the skill; staged imports keep their record with the link nulled.
    const { error } = await supabase.from('skills').delete().eq('id', row.id as string).eq('project_id', validation.context.projectId);
    if (error) {
        // A pin created between the check and the delete trips the FK: report it as in-use, not a server fault.
        const racedPin = (error as { code?: string }).code === '23503';
        return addGatewayHeaders(embeddedError(racedPin ? 409 : 500, racedPin ? 'skill_in_use' : 'invalid_request_error', racedPin ? 'Skill was pinned by an agent version while deleting; retry' : error.message, { requestId }), { requestId });
    }
    return addGatewayHeaders(NextResponse.json({ id: serialize(row).id, deleted: true, versions_deleted: versionIds.length, agent_versions_unpinned: unpinned }), { requestId });
}
