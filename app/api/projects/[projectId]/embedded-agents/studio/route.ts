import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { checksumConfig, validateVersionConfig, type AgentVersionConfig } from '@/lib/embedded/agents';
import { buildUnifiedModelRegistry } from '@/lib/embedded/model-registry';
import { normalizeManifest, validateManifest } from '@/lib/embedded/manifest';
import { checkInstallationCap, checkTenantCap } from '@/lib/embedded/limits';
import type { SubscriptionTier } from '@/lib/entitlements';

type Admin = ReturnType<typeof createAdminClient>;
type Context = { params: Promise<{ projectId: string }> };

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const cleanText = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const missingVersionTestFields = (error: { code?: string; message?: string } | null) => Boolean(error && (error.code === '42703' || /(?:last_tested_at|last_test_passed).*does not exist/i.test(error.message ?? '')));

async function projectRole(db: Admin, projectId: string, organizationId: string, userId: string) {
    const { data: organization, error: organizationError } = await db.from('organizations').select('owner_id,subscription_tier').eq('id', organizationId).maybeSingle();
    if (organizationError || !organization) throw new Error('Could not load project permissions');
    if (organization.owner_id === userId) return { canManage: true, tier: ((organization.subscription_tier as string) || 'free') as SubscriptionTier };
    const { data: membership, error: membershipError } = await db.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
    if (membershipError) throw new Error('Could not load project permissions');
    return { canManage: ['owner', 'admin'].includes((membership?.role as string) ?? ''), tier: ((organization.subscription_tier as string) || 'free') as SubscriptionTier };
}

async function scopedAgent(db: Admin, projectId: string, agentId: string) {
    const { data, error } = await db.from('agents').select('id,name,description,stable_version_id,is_active').eq('project_id', projectId).eq('id', agentId).maybeSingle();
    if (error) throw error;
    return data;
}

async function scopedVersion(db: Admin, projectId: string, agentId: string, versionId: string) {
    const { data, error } = await db.from('agent_versions').select('*').eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId).maybeSingle();
    if (error) throw error;
    return data;
}

function simpleManifest(config: AgentVersionConfig) {
    const manifest = normalizeManifest(config as Record<string, unknown>);
    if (manifest.skills.length || manifest.tools.length || manifest.connection_requirements.length || manifest.mcp_tools.length || manifest.subagents.length
        || (Array.isArray(config.knowledge_refs) && config.knowledge_refs.length > 0)
        || manifest.policy.browser.enabled || manifest.policy.network.mode !== 'none' || manifest.policy.require_approval.length > 0
        || manifest.input_schema || manifest.output_schema || manifest.fallback_policy) {
        return { ok: false as const, message: 'This version uses advanced capabilities. Test and publish it through the API until the visual editor supports those settings.' };
    }
    return { ok: true as const, manifest };
}

export async function GET(_request: Request, ctx: Context) {
    const { projectId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    try {
        const [{ canManage }, agents, versions, tenants, installations, runs, schemaProbe, registry] = await Promise.all([
            projectRole(db, projectId, access.organizationId, access.userId),
            db.from('agents').select('id,name,description,is_active,stable_version_id,created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100),
            db.from('agent_versions').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(300),
            db.from('platform_tenants').select('id,name,external_id,status,created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100),
            db.from('agent_installations').select('id,agent_id,tenant_id,agent_version_id,status,created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(200),
            db.from('embedded_runs').select('id,agent_id,tenant_id,status,error,created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(30),
            db.from('agent_versions').select('last_tested_at,last_test_passed').eq('project_id', projectId).limit(1),
            buildUnifiedModelRegistry(db, { projectId, query: { available: true } }),
        ]);
        const queries = { agents, versions, tenants, installations, runs };
        const failed = Object.entries(queries).find(([, result]) => result.error);
        if (failed) {
            console.error('[Embedded Agents studio] Query failed:', failed[0], failed[1].error);
            return fail(process.env.NODE_ENV === 'development' ? `${failed[0]}: ${failed[1].error?.message}` : 'Could not load your agents. Try again.', 502);
        }
        if (schemaProbe.error && !missingVersionTestFields(schemaProbe.error)) {
            console.error('[Embedded Agents studio] Schema probe failed:', schemaProbe.error);
            return fail('Could not verify agent editing readiness. Try again.', 502);
        }
        return NextResponse.json({
            can_manage: canManage,
            studio_ready: !schemaProbe.error,
            agents: agents.data ?? [], versions: versions.data ?? [], tenants: tenants.data ?? [],
            installations: installations.data ?? [], runs: runs.data ?? [],
            models: registry.models.filter((model) => model.available && model.types.includes('chat')).slice(0, 100).map((model) => ({ id: model.id, name: model.name, provider: model.provider })),
        });
    } catch (error) {
        console.error('[Embedded Agents studio] GET failed:', error);
        return fail(process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : 'Could not load your agents. Try again.', 502);
    }
}

export async function POST(request: Request, ctx: Context) {
    const { projectId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    try {
        const { canManage, tier } = await projectRole(db, projectId, access.organizationId, access.userId);
        if (!canManage) return fail('Only project admins can manage agents and customer installations.', 403);
        const { error: schemaError } = await db.from('agent_versions').select('last_tested_at,last_test_passed').eq('project_id', projectId).limit(1);
        if (schemaError) {
            const missingFields = missingVersionTestFields(schemaError);
            return fail(missingFields ? 'Agent editing is unavailable because this database is missing the version test migration.' : 'Could not verify agent editing readiness. Try again.', missingFields ? 503 : 502);
        }
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body || typeof body.action !== 'string') return fail('Choose an action.');

        if (body.action === 'create_agent') {
            const name = cleanText(body.name, 120);
            const description = cleanText(body.description, 500);
            const model = cleanText(body.model, 200);
            const instructions = cleanText(body.instructions, 20_000);
            if (!name) return fail('Give your agent a name.');
            const config: AgentVersionConfig = { ...(model ? { model } : {}), instructions };
            const { data: agent, error: agentError } = await db.from('agents').insert({
                project_id: projectId, name, description: description || null,
                blueprint: 'custom', is_active: true, shadow_mode: true,
            }).select('id').single();
            if (agentError || !agent) return fail('Could not create the agent. Try again.', 502);
            const { data: version, error: versionError } = await db.from('agent_versions').insert({
                agent_id: agent.id, project_id: projectId, version: '1.0.0', status: 'draft',
                config_json: config, requirements_json: {}, visibility: 'private',
                checksum: checksumConfig(config), created_by: access.userId,
            }).select('id').single();
            if (versionError || !version) {
                await db.from('agents').delete().eq('project_id', projectId).eq('id', agent.id);
                return fail('Could not create the agent draft. Try again.', 502);
            }
            return NextResponse.json({ agent_id: agent.id, version_id: version.id }, { status: 201 });
        }

        if (body.action === 'create_tenant') {
            const name = cleanText(body.name, 120);
            const externalId = cleanText(body.external_id, 160);
            if (!name || !externalId) return fail('Customer name and the customer ID from your app are required.');
            const { data: existing, error: lookupError } = await db.from('platform_tenants').select('id').eq('project_id', projectId).eq('external_id', externalId).maybeSingle();
            if (lookupError) return fail('Could not check that customer ID.', 502);
            if (existing) return fail('A customer with this ID already exists.', 409);
            const cap = await checkTenantCap(db, projectId, tier);
            if (!cap.ok) return fail(cap.message, 402);
            const { data, error } = await db.from('platform_tenants').insert({ project_id: projectId, name, external_id: externalId, status: 'active' }).select('id').single();
            if (error || !data) return fail(error?.code === '23505' ? 'A customer with this ID already exists.' : 'Could not add this customer.', error?.code === '23505' ? 409 : 502);
            return NextResponse.json({ tenant_id: data.id }, { status: 201 });
        }

        const agentId = cleanText(body.agent_id, 100);
        const agent = agentId ? await scopedAgent(db, projectId, agentId) : null;
        if (!agent) return fail('Agent not found in this project.', 404);

        if (body.action === 'new_version') {
            const { data: existingDraft, error: draftError } = await db.from('agent_versions').select('id').eq('project_id', projectId).eq('agent_id', agentId).in('status', ['draft', 'validating', 'ready_for_review']).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (draftError) return fail('Could not check agent drafts.', 502);
            if (existingDraft) return NextResponse.json({ version_id: existingDraft.id });
            const { data: rows, error: rowsError } = await db.from('agent_versions').select('version,config_json,requirements_json').eq('project_id', projectId).eq('agent_id', agentId).order('created_at', { ascending: false }).limit(100);
            if (rowsError) return fail('Could not load agent versions.', 502);
            const taken = new Set((rows ?? []).map((row) => row.version as string));
            let highest = [1, 0, -1];
            for (const row of rows ?? []) {
                const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(row.version as string);
                if (match) {
                    const candidate = [Number(match[1]), Number(match[2]), Number(match[3])];
                    if (candidate[0] > highest[0] || (candidate[0] === highest[0] && candidate[1] > highest[1]) || (candidate[0] === highest[0] && candidate[1] === highest[1] && candidate[2] > highest[2])) highest = candidate;
                }
            }
            let number = highest[2] + 1;
            while (taken.has(`${highest[0]}.${highest[1]}.${number}`)) number++;
            const source = (rows ?? [])[0];
            const config = (source?.config_json ?? {}) as AgentVersionConfig;
            const { data, error } = await db.from('agent_versions').insert({
                agent_id: agentId, project_id: projectId, version: `${highest[0]}.${highest[1]}.${number}`, status: 'draft',
                config_json: config, requirements_json: source?.requirements_json ?? {},
                checksum: checksumConfig(config), visibility: 'private', created_by: access.userId,
            }).select('id').single();
            if (error || !data) return fail(error?.code === '23505' ? 'Another draft was just created. Refresh and try again.' : 'Could not create a new draft.', error?.code === '23505' ? 409 : 502);
            return NextResponse.json({ version_id: data.id }, { status: 201 });
        }

        const versionId = cleanText(body.version_id, 100);
        const version = versionId ? await scopedVersion(db, projectId, agentId, versionId) : null;
        if (['save_draft', 'test_version', 'publish_version'].includes(body.action) && !version) return fail('Version not found in this project.', 404);

        if (body.action === 'save_draft' && version) {
            if (['published', 'deprecated', 'retired'].includes(version.status as string)) return fail('Published versions cannot be edited. Create a new draft.', 409);
            const simple = simpleManifest((version.config_json ?? {}) as AgentVersionConfig);
            if (!simple.ok) return fail(simple.message, 422);
            const name = cleanText(body.name, 120);
            const description = cleanText(body.description, 500);
            const model = cleanText(body.model, 200);
            const instructions = cleanText(body.instructions, 20_000);
            if (!name) return fail('Give your agent a name.');
            const existing = (version.config_json ?? {}) as AgentVersionConfig;
            const config: AgentVersionConfig = { ...existing, instructions };
            if (model) config.model = model;
            else delete config.model;
            const checked = validateVersionConfig(config);
            if (!checked.ok) return fail(checked.message);
            const { data: saved, error: saveError } = await db.from('agent_versions').update({
                config_json: config, checksum: checksumConfig(config), status: 'draft',
                last_tested_at: null, last_test_passed: false,
            }).eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId)
                .in('status', ['draft', 'ready_for_review']).select('id').maybeSingle();
            if (saveError || !saved) return fail('Draft changed while you were editing. Refresh and try again.', 409);
            const { error: nameError } = await db.from('agents').update({ name, description: description || null }).eq('project_id', projectId).eq('id', agentId);
            if (nameError) return fail('Draft saved, but the agent name could not be updated. Refresh and try again.', 502);
            return NextResponse.json({ version_id: versionId });
        }

        if (body.action === 'test_version' && version) {
            if (['published', 'deprecated', 'retired'].includes(version.status as string)) return fail('Create a new draft to test changes.', 409);
            const input = cleanText(body.input, 2000) || 'Introduce yourself in one sentence.';
            const config = (version.config_json ?? {}) as AgentVersionConfig;
            const simple = simpleManifest(config);
            if (!simple.ok) return fail(simple.message, 422);
            const checked = validateVersionConfig(config);
            if (!checked.ok) return fail(checked.message, 422);
            const manifestCheck = await validateManifest(db, { projectId, agentId, manifest: simple.manifest });
            if (!manifestCheck.valid) return fail(manifestCheck.errors.join(' '), 422);
            const { data: validating, error: statusError } = await db.from('agent_versions').update({ status: 'validating', last_test_passed: false }).eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId).eq('checksum', version.checksum as string).in('status', ['draft', 'ready_for_review']).select('id').maybeSingle();
            if (statusError || !validating) return fail('Version changed while testing. Refresh and try again.', 409);
            try {
                const { executeGatewayChat } = await import('@/lib/gateway/chat-executor');
                // Pure UUID: credit_transactions.reference_id is UUID-typed,
                // so a prefixed id fails the debit and blocks the test.
                const testRequestId = crypto.randomUUID();
                const gatewayStartedAt = Date.now();
                const result = await executeGatewayChat({
                    supabase: db as never, projectId, organizationId: access.organizationId, tier,
                    request: {
                        messages: [
                            ...(simple.manifest.instructions ? [{ role: 'system' as const, content: `[SANDBOX TEST — no tools, knowledge, or connections]\n${simple.manifest.instructions}` }] : []),
                            { role: 'user' as const, content: input },
                        ],
                        model: simple.manifest.model!, maxTokens: 500,
                    },
                    requestId: testRequestId,
                });
                if (!result.content?.trim()) {
                    throw new Error('The model returned no response. Try again.');
                }
                // Meter the managed model call before treating the test as
                // successful: idempotent wallet debit + ai_requests usage row.
                // A failed charge/metre leaves last_test_passed=false so the
                // test cannot become a free pass.
                const { meterAgentTestUsage } = await import('@/lib/embedded/test-metering');
                const metered = await meterAgentTestUsage({
                    supabase: db as never,
                    projectId,
                    organizationId: access.organizationId,
                    tier,
                    endpoint: 'agents.studio_test',
                    requestId: testRequestId,
                    agentId,
                    model: (result as { actualModel?: string }).actualModel ?? result.model,
                    provider: (result as { actualProvider?: string }).actualProvider ?? result.provider,
                    usage: result.usage,
                    cost: result.cost,
                    latencyMs: Date.now() - gatewayStartedAt,
                });
                if (!metered.ok) {
                    await db.from('agent_versions').update({ status: 'draft', last_tested_at: new Date().toISOString(), last_test_passed: false }).eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId).eq('status', 'validating').eq('checksum', version.checksum as string);
                    return fail(metered.message, metered.code === 'insufficient_credits' ? 402 : 502);
                }
                const { data: evidence, error: evidenceError } = await db.from('agent_versions').update({ status: 'ready_for_review', last_tested_at: new Date().toISOString(), last_test_passed: true }).eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId).eq('status', 'validating').eq('checksum', version.checksum as string).select('id').maybeSingle();
                if (evidenceError || !evidence) {
                    await db.from('agent_versions').update({ status: 'draft', last_test_passed: false }).eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId).eq('status', 'validating').eq('checksum', version.checksum as string);
                    return fail('Test ran, but passing evidence could not be saved. Try again.', 502);
                }
                return NextResponse.json({ output: result.content, model: result.model, usage: result.usage });
            } catch (error) {
                await db.from('agent_versions').update({ status: 'draft', last_tested_at: new Date().toISOString(), last_test_passed: false }).eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId).eq('status', 'validating').eq('checksum', version.checksum as string);
                return fail(error instanceof Error ? error.message : 'Test failed. Try again.', 502);
            }
        }

        if (body.action === 'publish_version' && version) {
            if (!['validating', 'ready_for_review'].includes(version.status as string) || !version.last_test_passed) return fail('Save and successfully test this draft before publishing.', 409);
            const config = (version.config_json ?? {}) as AgentVersionConfig;
            const simple = simpleManifest(config);
            if (!simple.ok) return fail(simple.message, 422);
            const checked = await validateManifest(db, { projectId, agentId, manifest: simple.manifest });
            if (!checked.valid) return fail(checked.errors.join(' '), 422);
            const { data, error } = await db.rpc('publish_embedded_agent_version', {
                p_version_id: versionId, p_project_id: projectId, p_reviewed_by: access.userId,
                p_set_stable: true, p_skill_version_ids: [], p_subagents: [],
            });
            if (error) return fail(/untested_version|invalid_status/.test(error.message) ? 'This draft changed. Test it again before publishing.' : 'Could not publish this version.', /untested_version|invalid_status/.test(error.message) ? 409 : 502);
            return NextResponse.json({ published: data });
        }

        if (body.action === 'install_agent') {
            const tenantId = cleanText(body.tenant_id, 100);
            const { data: tenant, error: tenantError } = await db.from('platform_tenants').select('id,status').eq('project_id', projectId).eq('id', tenantId).maybeSingle();
            if (tenantError || !tenant) return fail('Customer not found in this project.', 404);
            if (tenant.status !== 'active') return fail('This customer is not active.', 409);
            if (!agent.stable_version_id) return fail('Publish an agent version first.', 409);
            const { data: published, error: publishedError } = await db.from('agent_versions').select('id,status,requirements_json').eq('project_id', projectId).eq('agent_id', agentId).eq('id', agent.stable_version_id).maybeSingle();
            if (publishedError || !published || published.status !== 'published') return fail('Published agent version not found.', 409);
            const requirements = (published.requirements_json ?? {}) as { connections?: unknown[]; knowledge?: unknown[] };
            if (requirements.connections?.length || requirements.knowledge?.length) return fail('This agent needs customer-specific knowledge or connections. Install it through the API until those settings are available here.', 422);
            const { data: configRow, error: configError } = await db.from('agent_versions').select('config_json').eq('id', published.id).eq('project_id', projectId).maybeSingle();
            if (configError || !configRow) return fail('Could not check the agent configuration.', 502);
            const manifest = normalizeManifest((configRow.config_json ?? {}) as Record<string, unknown>);
            if (manifest.connection_requirements.length || manifest.mcp_tools.length || (Array.isArray((configRow.config_json as Record<string, unknown> | null)?.knowledge_refs) && ((configRow.config_json as Record<string, unknown>).knowledge_refs as unknown[]).length)) {
                return fail('This agent needs customer-specific knowledge or connections. Install it through the API until those settings are available here.', 422);
            }
            const { data: existing, error: existingError } = await db.from('agent_installations').select('id').eq('project_id', projectId).eq('tenant_id', tenantId).eq('agent_id', agentId).maybeSingle();
            if (existingError) return fail('Could not check this installation.', 502);
            if (existing) return fail('This agent is already installed for this customer.', 409);
            const cap = await checkInstallationCap(db, tenantId, tier);
            if (!cap.ok) return fail(cap.message, 402);
            const { data, error } = await db.from('agent_installations').insert({
                project_id: projectId, tenant_id: tenantId, agent_id: agentId,
                agent_version_id: published.id, update_channel: 'stable', status: 'active',
            }).select('id').single();
            if (error || !data) return fail(error?.code === '23505' ? 'This agent is already installed for this customer.' : 'Could not install this agent.', error?.code === '23505' ? 409 : 502);
            return NextResponse.json({ installation_id: data.id }, { status: 201 });
        }

        return fail('Unknown action.');
    } catch (error) {
        console.error('[Embedded Agents studio] POST failed:', error);
        return fail('Something went wrong. Try again.', 502);
    }
}
