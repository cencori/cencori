import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { checksumConfig } from '@/lib/embedded/agents';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/marketplace/installations — fork a public agent version into the
// caller's project and install it pinned for a tenant. Fork (not link):
// later publisher edits never move the installed copy, and all spend bills
// to the caller's project. Grants are validated like first-party installs.
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();

    let body: {
        version_id?: string; tenant_id?: string;
        knowledge_base_ids?: string[]; connection_ids?: string[];
        approval_policy?: Record<string, unknown>; budget?: Record<string, unknown>; overlay_config?: Record<string, unknown>;
    };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.version_id?.trim() || !body.tenant_id?.trim()) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'version_id and tenant_id are required', { requestId }), { requestId });
    }

    const { data: source } = await supabase
        .from('agent_versions')
        .select('id, agent_id, version, status, visibility, config_json, requirements_json, agents!inner(id, name, description)')
        .eq('id', dePrefixId(body.version_id.trim()))
        .eq('status', 'published')
        .eq('visibility', 'public')
        .maybeSingle();
    if (!source) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Public agent version not found', { requestId }), { requestId });
    const src = source as unknown as Record<string, unknown> & {
        agent_id: string; version: string; config_json: Record<string, unknown>; requirements_json: Record<string, unknown>;
        agents: { name: string; description: string | null };
    };

    const rawTenant = dePrefixId(body.tenant_id.trim());
    const { data: tenantById } = await supabase.from('platform_tenants').select('id, status').eq('project_id', validation.context.projectId).eq('id', rawTenant).maybeSingle();
    const { data: tenantByExt } = tenantById
        ? { data: tenantById }
        : await supabase.from('platform_tenants').select('id, status').eq('project_id', validation.context.projectId).eq('external_id', body.tenant_id as string).maybeSingle();
    const tenantRow = (tenantByExt ?? null) as { id: string; status: string } | null;
    if (!tenantRow) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
    if ((tenantRow.status as string) !== 'active') return addGatewayHeaders(embeddedError(403, 'tenant_suspended', 'Tenant is not active', { requestId }), { requestId });

    // Fork: new local agent + published private copy of the public version.
    const { data: agent, error: agentError } = await supabase
        .from('agents')
        .insert({
            project_id: validation.context.projectId,
            name: (src.agents?.name as string) ?? 'Marketplace agent',
            description: (src.agents?.description as string | null) ?? null,
            blueprint: 'custom',
            is_active: true,
            shadow_mode: true,
        })
        .select('id')
        .single();
    if (agentError || !agent) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', agentError?.message ?? 'Failed to fork agent', { requestId }), { requestId });
    const agentId = (agent as { id: string }).id;

    const { data: version, error: versionError } = await supabase
        .from('agent_versions')
        .insert({
            agent_id: agentId,
            project_id: validation.context.projectId,
            version: src.version as string,
            status: 'published',
            visibility: 'private',
            config_json: (src.config_json ?? {}) as Record<string, unknown>,
            requirements_json: (src.requirements_json ?? {}) as Record<string, unknown>,
            checksum: checksumConfig(((src.config_json ?? {}) as Record<string, unknown>) as never),
            published_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    if (versionError || !version) {
        await supabase.from('agents').delete().eq('id', agentId);
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', versionError?.message ?? 'Failed to fork version', { requestId }), { requestId });
    }
    const versionId = (version as { id: string }).id;

    // CapGate: same per-tenant installation caps as first-party installs.
    {
        const { data: existingIns } = await supabase.from('agent_installations').select('id').eq('tenant_id', tenantRow.id).eq('agent_id', agentId).maybeSingle();
        if (!existingIns) {
            const { checkInstallationCap } = await import('@/lib/embedded/limits');
            const cap = await checkInstallationCap(supabase as never, tenantRow.id, (validation.context.tier as import('@/lib/entitlements').SubscriptionTier) ?? 'free');
            if (!cap.ok) {
                await supabase.from('agents').delete().eq('id', agentId);
                return addGatewayHeaders(embeddedError(402, cap.code, cap.message, { requestId }), { requestId });
            }
        }
    }

    // Grants validated exactly like first-party installs, then swapped
    // atomically onto the fresh installation.
    const kbIds = body.knowledge_base_ids ?? [];
    const connIds = body.connection_ids ?? [];
    if (!Array.isArray(kbIds) || kbIds.some((k) => typeof k !== 'string')) {
        await supabase.from('agents').delete().eq('id', agentId);
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'knowledge_base_ids must be an array of strings', { requestId }), { requestId });
    }
    if (!Array.isArray(connIds) || connIds.some((c) => typeof c !== 'string')) {
        await supabase.from('agents').delete().eq('id', agentId);
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'connection_ids must be an array of strings', { requestId }), { requestId });
    }
    let checked: { ok: true; grants: { knowledgeBaseIds: string[]; connectionIds: string[] } } | null = null;
    if (kbIds.length > 0 || connIds.length > 0) {
        const { validateInstallationGrants } = await import('@/lib/embedded/installation-grants');
        const result = await validateInstallationGrants(
            supabase as never,
            { projectId: validation.context.projectId, tenantId: tenantRow.id },
            { knowledgeBaseIds: kbIds, connectionIds: connIds },
        );
        if (!result.ok) {
            await supabase.from('agents').delete().eq('id', agentId);
            return addGatewayHeaders(embeddedError(result.error.status, result.error.code, result.error.message, { requestId }), { requestId });
        }
        checked = result;
    }
    const { data: createdIns, error: insError } = await supabase.from('agent_installations').insert({
        project_id: validation.context.projectId,
        tenant_id: tenantRow.id,
        agent_id: agentId,
        agent_version_id: versionId,
        status: 'active',
        update_channel: 'pinned',
        overlay_config: body.overlay_config ?? {},
        approval_policy: body.approval_policy ?? {},
        budget: body.budget ?? {},
    }).select('id').single();
    if (insError || !createdIns) {
        await supabase.from('agents').delete().eq('id', agentId);
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', insError?.message ?? 'Failed to create installation', { requestId }), { requestId });
    }
    const installationId = (createdIns as { id: string }).id;
    if (checked && (checked.grants.knowledgeBaseIds.length > 0 || checked.grants.connectionIds.length > 0)) {
        const { error: swapError } = await supabase.rpc('replace_installation_grants', {
            p_installation_id: installationId,
            p_kb_ids: checked.grants.knowledgeBaseIds,
            p_connection_ids: checked.grants.connectionIds,
        });
        if (swapError) {
            await supabase.from('agents').delete().eq('id', agentId);
            return addGatewayHeaders(embeddedError(500, 'invalid_request_error', swapError.message, { requestId }), { requestId });
        }
    }

    const { data: created } = await supabase.from('agent_installations').select('*').eq('tenant_id', tenantRow.id).eq('agent_id', agentId).maybeSingle();
    const row = created as Record<string, unknown> | null;
    if (!row) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', 'Failed to create installation', { requestId }), { requestId });
    }
    return addGatewayHeaders(
        NextResponse.json({
            id: withPrefix('ins', row.id as string),
            tenant_id: withPrefix('ten', row.tenant_id as string),
            agent_id: row.agent_id,
            agent_version_id: row.agent_version_id ?? null,
            source_version_id: src.id as string,
            status: row.status,
            update_channel: row.update_channel,
            created_at: row.created_at,
        }, { status: 201 }),
        { requestId },
    );
}
