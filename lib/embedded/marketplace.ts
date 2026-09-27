/**
 * Public marketplace fork-to-install, shared by the secret-key API and the
 * dashboard session route.
 *
 * Fork, not link: the public version is copied into the caller's project as
 * a private published version pinned to a new installation. Later publisher
 * edits never move the fork, and all spend bills to the caller's project.
 * Grants are validated exactly like first-party installs, then swapped
 * atomically. Any failure removes the forked agent (versions, installations,
 * and grants cascade) so partial installs never linger.
 */

import { checksumConfig } from './agents';
import { validateInstallationGrants } from './installation-grants';
import { dePrefixId } from './http';
import type { SubscriptionTier } from '@/lib/entitlements';

type Admin = {
    from: (table: string) => any;
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export interface MarketplaceInstallInput {
    projectId: string;
    tier: SubscriptionTier;
    versionId: string;
    tenantRef: string;
    knowledgeBaseIds?: string[];
    connectionIds?: string[];
    overlayConfig?: Record<string, unknown>;
    approvalPolicy?: Record<string, unknown>;
    budget?: Record<string, unknown>;
}

export type MarketplaceInstallResult =
    | { ok: true; status: 201; installation: Record<string, unknown>; sourceVersionId: string }
    | { ok: false; status: number; code: string; message: string };

const fail = (status: number, code: string, message: string): MarketplaceInstallResult => ({ ok: false, status, code, message });

export async function installMarketplaceVersion(supabase: Admin, input: MarketplaceInstallInput): Promise<MarketplaceInstallResult> {
    const kbIds = input.knowledgeBaseIds ?? [];
    const connIds = input.connectionIds ?? [];
    if (!Array.isArray(kbIds) || kbIds.some((k) => typeof k !== 'string')) {
        return fail(400, 'invalid_request_error', 'knowledge_base_ids must be an array of strings');
    }
    if (!Array.isArray(connIds) || connIds.some((c) => typeof c !== 'string')) {
        return fail(400, 'invalid_request_error', 'connection_ids must be an array of strings');
    }

    const { data: source } = await supabase
        .from('agent_versions')
        .select('id, agent_id, version, status, visibility, config_json, requirements_json, agents!inner(id, name, description)')
        .eq('id', dePrefixId(input.versionId.trim()))
        .eq('status', 'published')
        .eq('visibility', 'public')
        .maybeSingle();
    if (!source) return fail(404, 'invalid_request_error', 'Public agent version not found');
    const src = source as Record<string, unknown> & {
        agent_id: string; version: string; config_json: Record<string, unknown>; requirements_json: Record<string, unknown>;
        agents: { name: string; description: string | null };
    };

    const trimmedTenant = input.tenantRef.trim();
    const { data: tenantById } = await supabase.from('platform_tenants').select('id, status').eq('project_id', input.projectId).eq('id', dePrefixId(trimmedTenant)).maybeSingle();
    const { data: tenantByExt } = tenantById
        ? { data: tenantById }
        : await supabase.from('platform_tenants').select('id, status').eq('project_id', input.projectId).eq('external_id', trimmedTenant).maybeSingle();
    const tenant = (tenantByExt ?? null) as { id: string; status: string } | null;
    if (!tenant) return fail(404, 'tenant_not_found', 'Tenant not found');
    if (tenant.status !== 'active') return fail(403, 'tenant_suspended', 'Tenant is not active');

    // Fork: new local agent + published private copy of the public version.
    const { data: agent, error: agentError } = await supabase
        .from('agents')
        .insert({
            project_id: input.projectId,
            name: (src.agents?.name as string) ?? 'Marketplace agent',
            description: (src.agents?.description as string | null) ?? null,
            blueprint: 'custom',
            is_active: true,
            shadow_mode: true,
        })
        .select('id')
        .single();
    if (agentError || !agent) return fail(500, 'invalid_request_error', agentError?.message ?? 'Failed to fork agent');
    const agentId = (agent as { id: string }).id;
    const removeFork = () => supabase.from('agents').delete().eq('id', agentId);

    const { data: version, error: versionError } = await supabase
        .from('agent_versions')
        .insert({
            agent_id: agentId,
            project_id: input.projectId,
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
        await removeFork();
        return fail(500, 'invalid_request_error', versionError?.message ?? 'Failed to fork version');
    }
    const versionId = (version as { id: string }).id;

    // Same per-tenant installation caps as first-party installs.
    {
        const { data: existingIns } = await supabase.from('agent_installations').select('id').eq('tenant_id', tenant.id).eq('agent_id', agentId).maybeSingle();
        if (!existingIns) {
            const { checkInstallationCap } = await import('@/lib/embedded/limits');
            const cap = await checkInstallationCap(supabase as never, tenant.id, input.tier);
            if (!cap.ok) {
                await removeFork();
                return fail(402, cap.code, cap.message);
            }
        }
    }

    let grants: { knowledgeBaseIds: string[]; connectionIds: string[] } | null = null;
    if (kbIds.length > 0 || connIds.length > 0) {
        const checked = await validateInstallationGrants(
            supabase as never,
            { projectId: input.projectId, tenantId: tenant.id },
            { knowledgeBaseIds: kbIds, connectionIds: connIds },
        );
        if (!checked.ok) {
            await removeFork();
            return fail(checked.error.status, checked.error.code, checked.error.message);
        }
        grants = checked.grants;
    }

    const { data: createdIns, error: insError } = await supabase.from('agent_installations').insert({
        project_id: input.projectId,
        tenant_id: tenant.id,
        agent_id: agentId,
        agent_version_id: versionId,
        status: 'active',
        update_channel: 'pinned',
        overlay_config: input.overlayConfig ?? {},
        approval_policy: input.approvalPolicy ?? {},
        budget: input.budget ?? {},
    }).select('*').single();
    if (insError || !createdIns) {
        await removeFork();
        return fail(500, 'invalid_request_error', insError?.message ?? 'Failed to create installation');
    }
    const installationId = (createdIns as { id: string }).id;

    if (grants && (grants.knowledgeBaseIds.length > 0 || grants.connectionIds.length > 0)) {
        const { error: swapError } = await supabase.rpc('replace_installation_grants', {
            p_installation_id: installationId,
            p_kb_ids: grants.knowledgeBaseIds,
            p_connection_ids: grants.connectionIds,
        });
        if (swapError) {
            await removeFork();
            return fail(500, 'invalid_request_error', swapError.message);
        }
    }

    const { data: created, error: readError } = await supabase.from('agent_installations').select('*').eq('id', installationId).maybeSingle();
    if (readError || !created) {
        await removeFork();
        return fail(500, 'invalid_request_error', readError?.message ?? 'Failed to read installation');
    }

    return {
        ok: true,
        status: 201,
        installation: created as Record<string, unknown>,
        sourceVersionId: src.id as string,
    };
}
