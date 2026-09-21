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
        knowledge_base_ids: (row as { knowledge_base_ids?: string[] }).knowledge_base_ids ?? [],
        connection_ids: (row as { connection_ids?: string[] }).connection_ids ?? [],
        missing_requirements: (row as { missing_requirements?: unknown }).missing_requirements ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function resolveTenant(supabase: ReturnType<typeof createAdminClient>, projectId: string, tenantId: string) {
    const raw = dePrefixId(tenantId);
    const { data } = await supabase.from('platform_tenants').select('id, status').eq('project_id', projectId).eq('id', raw).maybeSingle();
    if (data) return data as { id: string; status: string };
    const { data: byExt } = await supabase.from('platform_tenants').select('id, status').eq('project_id', projectId).eq('external_id', tenantId).maybeSingle();
    return (byExt ?? null) as { id: string; status: string } | null;
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

export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();

    let body: {
        tenant_id?: string; agent_id?: string; version?: string; update_channel?: string;
        allowed_groups?: string[]; knowledge_base_ids?: string[]; connection_ids?: string[];
        approval_policy?: Record<string, unknown>; budget?: Record<string, unknown>; overlay_config?: Record<string, unknown>;
    };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.tenant_id || !body.agent_id) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'tenant_id and agent_id are required', { requestId }), { requestId });
    }
    const tenant = await resolveTenant(supabase, validation.context.projectId, body.tenant_id);
    if (!tenant) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
    if (tenant.status !== 'active') return addGatewayHeaders(embeddedError(403, 'tenant_suspended', 'Tenant is not active', { requestId }), { requestId });

    // M4: per-tenant installation caps (upsert is idempotent — skip when row exists).
    {
        const { data: existingIns } = await supabase.from('agent_installations').select('id').eq('tenant_id', tenant.id).eq('agent_id', body.agent_id).maybeSingle();
        if (!existingIns) {
            const { checkInstallationCap } = await import('@/lib/embedded/limits');
            const cap = await checkInstallationCap(supabase as never, tenant.id, (validation.context.tier as import('@/lib/entitlements').SubscriptionTier) ?? 'free');
            if (!cap.ok) {
                return addGatewayHeaders(embeddedError(402, cap.code, cap.message, { requestId }), { requestId });
            }
        }
    }

    const { data: agent } = await supabase.from('agents').select('id, project_id, stable_version_id').eq('id', body.agent_id).maybeSingle();
    if (!agent || (agent.project_id as string) !== validation.context.projectId) {
        return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Agent not found', { requestId }), { requestId });
    }

    // Resolve version: explicit string/id → row; else stable → latest published.
    let versionId: string | null = null;
    if (body.version) {
        const { data: v } = await supabase.from('agent_versions').select('id, status').eq('agent_id', body.agent_id).eq('version', body.version).maybeSingle();
        const vRow = v ?? (await supabase.from('agent_versions').select('id, status').eq('id', body.version).eq('agent_id', body.agent_id).maybeSingle()).data;
        if (!vRow) return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Agent version not found', { requestId }), { requestId });
        if ((vRow.status as string) !== 'published') {
            return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Version is ${(vRow.status as string)}; only published versions are installable`, { requestId }), { requestId });
        }
        versionId = (vRow.id as string);
    } else if ((agent.stable_version_id as string | null)) {
        versionId = agent.stable_version_id as string;
    } else {
        const { data: latest } = await supabase.from('agent_versions').select('id').eq('agent_id', body.agent_id).eq('status', 'published').order('created_at', { ascending: false }).limit(1).maybeSingle();
        versionId = (latest?.id as string) ?? null;
    }

    const channel = body.update_channel === 'stable' ? 'stable' : 'pinned';
    const { data: installation, error } = await supabase
        .from('agent_installations')
        .upsert(
            {
                project_id: validation.context.projectId,
                tenant_id: tenant.id,
                agent_id: body.agent_id,
                agent_version_id: versionId,
                status: 'active',
                update_channel: channel,
                overlay_config: { ...(body.overlay_config ?? {}), ...(body.allowed_groups ? { allowed_groups: body.allowed_groups } : {}) },
                approval_policy: body.approval_policy ?? {},
                budget: body.budget ?? {},
            },
            { onConflict: 'tenant_id,agent_id' },
        )
        .select('*')
        .single();
    if (error || !installation) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to create installation', { requestId }), { requestId });
    }
    const ins = installation as Record<string, unknown>;

    for (const kbId of body.knowledge_base_ids ?? []) {
        await supabase.from('installation_knowledge_bases').upsert({ installation_id: ins.id as string, knowledge_base_id: dePrefixId(kbId) }, { onConflict: 'installation_id,knowledge_base_id' });
    }
    for (const connId of body.connection_ids ?? []) {
        await supabase.from('installation_connections').upsert({ installation_id: ins.id as string, connection_id: connId }, { onConflict: 'installation_id,connection_id' });
    }

    // Missing-requirements check from version requirements_json.
    let missing: Record<string, unknown> | null = null;
    if (versionId) {
        const { data: vrow } = await supabase.from('agent_versions').select('requirements_json').eq('id', versionId).maybeSingle();
        const req = ((vrow?.requirements_json ?? {}) as { connections?: string[]; knowledge?: string[] });
        const needConns = (req.connections ?? []).filter((c) => !(body.connection_ids ?? []).includes(c));
        const needKb = (req.knowledge ?? []).filter((k) => !(body.knowledge_base_ids ?? []).includes(k));
        if (needConns.length > 0 || needKb.length > 0) missing = { connections: needConns, knowledge_bases: needKb };
    }

    const full = await enrich(supabase, { ...ins, missing_requirements: missing });
    return addGatewayHeaders(NextResponse.json(serialize(full), { status: 201 }), { requestId });
}

export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const url = new URL(req.url);
    const tenantFilter = url.searchParams.get('tenant_id');
    let query = supabase.from('agent_installations').select('*').eq('project_id', validation.context.projectId).order('created_at', { ascending: false }).limit(100);
    if (tenantFilter) {
        const tenant = await resolveTenant(supabase, validation.context.projectId, tenantFilter);
        if (!tenant) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
        query = query.eq('tenant_id', tenant.id);
    }
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    const enriched = await Promise.all(((data ?? []) as Record<string, unknown>[]).map((r) => enrich(supabase, r)));
    return addGatewayHeaders(NextResponse.json({ data: enriched.map(serialize), next_cursor: null }), { requestId });
}
