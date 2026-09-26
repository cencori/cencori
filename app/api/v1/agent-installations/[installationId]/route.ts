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
        id: withPrefix('ins', row.id as string),
        tenant_id: withPrefix('ten', row.tenant_id as string),
        agent_id: row.agent_id,
        agent_version_id: row.agent_version_id ?? null,
        status: row.status,
        update_channel: row.update_channel,
        overlay_config: row.overlay_config ?? {},
        approval_policy: row.approval_policy ?? {},
        budget: row.budget ?? {},
        metadata: row.metadata ?? {},
        knowledge_base_ids: (row as { knowledge_base_ids?: string[] }).knowledge_base_ids ?? [],
        connection_ids: (row as { connection_ids?: string[] }).connection_ids ?? [],
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function loadInstallation(supabase: ReturnType<typeof createAdminClient>, projectId: string, installationId: string) {
    const { data } = await supabase.from('agent_installations').select('*').eq('project_id', projectId).eq('id', dePrefixId(installationId)).maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
}

async function enrich(supabase: ReturnType<typeof createAdminClient>, row: Record<string, unknown>) {
    const { data: kbs } = await supabase.from('installation_knowledge_bases').select('knowledge_base_id').eq('installation_id', row.id as string);
    const { data: conns } = await supabase.from('installation_connections').select('connection_id').eq('installation_id', row.id as string);
    return {
        ...row,
        knowledge_base_ids: ((kbs ?? []) as Array<{ knowledge_base_id: string }>).map((k) => k.knowledge_base_id),
        connection_ids: ((conns ?? []) as Array<{ connection_id: string }>).map((c) => c.connection_id),
    };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ installationId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { installationId } = await ctx.params;
    const row = await loadInstallation(createAdminClient(), validation.context.projectId, installationId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Installation not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(row)), { requestId });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ installationId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { installationId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadInstallation(supabase, validation.context.projectId, installationId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Installation not found', { requestId }), { requestId });

    let body: Record<string, unknown> = {};
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const patch: Record<string, unknown> = {};
    if (body.overlay_config && typeof body.overlay_config === 'object') patch.overlay_config = body.overlay_config;
    if (body.approval_policy && typeof body.approval_policy === 'object') patch.approval_policy = body.approval_policy;
    if (body.budget && typeof body.budget === 'object') patch.budget = body.budget;
    if (body.status === 'active' || body.status === 'disabled') patch.status = body.status;
    if (body.update_channel === 'pinned' || body.update_channel === 'stable') patch.update_channel = body.update_channel;

    // Advertised version pin: resolve like POST (label or id, same agent,
    // published only). Use /upgrade for channel moves.
    if (body.version !== undefined) {
        if (typeof body.version !== 'string' || !body.version.trim()) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'version must be a non-empty string', { requestId }), { requestId });
        }
        const agentId = row.agent_id as string;
        const { data: v } = await supabase.from('agent_versions').select('id, status').eq('agent_id', agentId).eq('version', (body.version as string).trim()).maybeSingle();
        const vRow = v ?? (await supabase.from('agent_versions').select('id, status').eq('id', dePrefixId(body.version as string)).eq('agent_id', agentId).maybeSingle()).data;
        if (!vRow) return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Agent version not found', { requestId }), { requestId });
        if ((vRow.status as string) !== 'published') {
            return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Version is ${(vRow.status as string)}; only published versions are installable`, { requestId }), { requestId });
        }
        patch.agent_version_id = (vRow as { id: string }).id;
    }

    // Grant replacement (explicit arrays replace; absent leaves unchanged;
    // empty clears). POST only ever added joins, so revocation previously
    // had no enforceable path.
    let replaceKb: string[] | null = null;
    let replaceConns: string[] | null = null;
    if (body.knowledge_base_ids !== undefined) {
        if (!Array.isArray(body.knowledge_base_ids) || body.knowledge_base_ids.some((k) => typeof k !== 'string')) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'knowledge_base_ids must be an array of strings', { requestId }), { requestId });
        }
        replaceKb = (body.knowledge_base_ids as string[]).map((k) => dePrefixId(k));
    }
    if (body.connection_ids !== undefined) {
        if (!Array.isArray(body.connection_ids) || body.connection_ids.some((c) => typeof c !== 'string')) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'connection_ids must be an array of strings', { requestId }), { requestId });
        }
        replaceConns = body.connection_ids as string[];
    }

    if (Object.keys(patch).length === 0 && replaceKb === null && replaceConns === null) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No updatable fields', { requestId }), { requestId });
    }
    if (Object.keys(patch).length > 0) {
        const { data, error } = await supabase.from('agent_installations').update(patch).eq('id', row.id as string).select('*').single();
        if (error || !data) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Update failed', { requestId }), { requestId });
        Object.assign(row, data as Record<string, unknown>);
    }
    if (replaceKb !== null) {
        await supabase.from('installation_knowledge_bases').delete().eq('installation_id', row.id as string);
        for (const kbId of replaceKb) {
            await supabase.from('installation_knowledge_bases').upsert({ installation_id: row.id as string, knowledge_base_id: kbId }, { onConflict: 'installation_id,knowledge_base_id' });
        }
    }
    if (replaceConns !== null) {
        await supabase.from('installation_connections').delete().eq('installation_id', row.id as string);
        for (const connId of replaceConns) {
            await supabase.from('installation_connections').upsert({ installation_id: row.id as string, connection_id: connId }, { onConflict: 'installation_id,connection_id' });
        }
    }
    const full = await enrich(supabase, row);
    return addGatewayHeaders(NextResponse.json(serialize(full)), { requestId });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ installationId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { installationId } = await ctx.params;
    const supabase = createAdminClient();
    const row = await loadInstallation(supabase, validation.context.projectId, installationId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Installation not found', { requestId }), { requestId });
    const { error } = await supabase.from('agent_installations').update({ status: 'disabled' }).eq('id', row.id as string);
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ id: withPrefix('ins', row.id as string), status: 'disabled' }), { requestId });
}
