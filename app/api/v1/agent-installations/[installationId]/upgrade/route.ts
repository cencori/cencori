import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function pushHistory(metadata: Record<string, unknown>, versionId: string): Record<string, unknown> {
    const history = Array.isArray((metadata as { history?: unknown }).history) ? [...((metadata as { history?: string[] }).history ?? [])] : [];
    history.push(versionId);
    return { ...metadata, history: history.slice(-10) };
}

// POST .../upgrade — repoint to explicit version or latest stable/published.
export async function POST(req: NextRequest, ctx: { params: Promise<{ installationId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { installationId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: row } = await supabase.from('agent_installations').select('*').eq('project_id', validation.context.projectId).eq('id', dePrefixId(installationId)).maybeSingle();
    if (!row) return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Installation not found', { requestId }), { requestId });
    const ins = row as { id: string; agent_id: string; agent_version_id: string | null; metadata: Record<string, unknown> };

    let body: { version?: string; agent_version_id?: string } = {};
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }
    let targetId: string | null = null;
    if (body.agent_version_id || body.version) {
        const key = (body.agent_version_id ?? body.version) as string;
        const { data: v } = await supabase.from('agent_versions').select('id, status').eq('agent_id', ins.agent_id).eq('version', key).maybeSingle();
        const vRow = v ?? (await supabase.from('agent_versions').select('id, status').eq('id', dePrefixId(key)).eq('agent_id', ins.agent_id).maybeSingle()).data;
        if (!vRow) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Target version not found', { requestId }), { requestId });
        if ((vRow.status as string) !== 'published') {
            return addGatewayHeaders(embeddedError(409, 'invalid_request_error', 'Only published versions are installable', { requestId }), { requestId });
        }
        targetId = (vRow.id as string);
    } else {
        const { data: agent } = await supabase.from('agents').select('stable_version_id').eq('id', ins.agent_id).maybeSingle();
        targetId = (agent?.stable_version_id as string | null) ?? null;
        if (!targetId) {
            const { data: latest } = await supabase.from('agent_versions').select('id').eq('agent_id', ins.agent_id).eq('status', 'published').order('created_at', { ascending: false }).limit(1).maybeSingle();
            targetId = (latest?.id as string) ?? null;
        }
    }
    if (!targetId) return addGatewayHeaders(embeddedError(409, 'invalid_request_error', 'No published version to upgrade to', { requestId }), { requestId });

    const { data: updated, error } = await supabase
        .from('agent_installations')
        .update({ agent_version_id: targetId, status: 'active', metadata: pushHistory((ins.metadata ?? {}) as Record<string, unknown>, (ins.agent_version_id as string) ?? 'none') })
        .eq('id', ins.id)
        .select('*')
        .single();
    if (error || !updated) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Upgrade failed', { requestId }), { requestId });
    const u = updated as Record<string, unknown>;
    return addGatewayHeaders(NextResponse.json({ id: withPrefix('ins', u.id as string), agent_version_id: u.agent_version_id, status: u.status }), { requestId });
}
