import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { checksumConfig, promoteStableInstallations, validateVersionConfig, type AgentVersionConfig } from '@/lib/embedded/agents';
import { buildUnifiedModelRegistry } from '@/lib/embedded/model-registry';
import { normalizeManifest, validateManifest } from '@/lib/embedded/manifest';
import { checkInstallationCap, checkTenantCap } from '@/lib/embedded/limits';
import type { SubscriptionTier } from '@/lib/entitlements';
import { invalidateAgentConfig } from '@/lib/config-cache';
import { buildWebhookTools, publicWebhookTools, readWebhookTools, WEBHOOK_TOOL_MAX_ITERATIONS } from '@/lib/embedded/webhook-tools';
import { agentClock, agentToolset, buildSystemTools, readSystemTools } from '@/lib/embedded/agent-tools';
import { AGENT_MCP_SERVERS_MAX, buildAgentMcpServers, connectAgentMcpServer, normalizeMcpServerUrl, publicAgentMcpServers, readAgentIntegrations, readAgentMcpServers, type AgentMcpServer } from '@/lib/embedded/agent-mcp';
import { createConnectLink, deleteConnection, discoverIntegrationTools, listNangoIntegrations, listProjectConnections, nangoConfigured, NangoError } from '@/lib/integrations/nango';
import { iconFrom } from '@/lib/embedded/mcp-icon';
import { discoverMcpAuth, mcpAuthorizeUrl, mcpRedirectFor, pkcePair, registerMcpClient, revokeMcpConnections, sealMcpOAuthState } from '@/lib/embedded/mcp-oauth';
import type { UnifiedMessage } from '@/lib/providers/base';

/** Room for a full answer in Preview; 500 cut lists of results off mid-sentence. */
const TEST_MAX_TOKENS = 2_048;

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

/** The stored webhook tools re-sent as-is (every header kept), when only system tools change. */
function publicWebhookToolsAsInput(config: Record<string, unknown>) {
    return readWebhookTools(config).map((tool) => ({ ...tool, headers: tool.headers.map((h) => ({ name: h.name, keep: true })) }));
}

/** Webhook and MCP header values stay server-side: the console sees header names only. */
function withoutToolSecrets<T extends { config_json?: unknown }>(version: T): T {
    const config = (version.config_json ?? null) as Record<string, unknown> | null;
    if (!config || (!Array.isArray(config.webhook_tools) && !Array.isArray(config.mcp_servers))) return version;
    return {
        ...version,
        config_json: {
            ...config,
            ...(Array.isArray(config.webhook_tools) ? { webhook_tools: publicWebhookTools(readWebhookTools(config)) } : {}),
            ...(Array.isArray(config.mcp_servers) ? { mcp_servers: publicAgentMcpServers(readAgentMcpServers(config)) } : {}),
        },
    };
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
            agents: agents.data ?? [], versions: (versions.data ?? []).map(withoutToolSecrets), tenants: tenants.data ?? [],
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

        // Connected apps (integrations) are project-level: what's on offer, and
        // what this project has connected.
        if (body.action === 'integrations_list') {
            if (!nangoConfigured()) return NextResponse.json({ configured: false, catalog: [], connections: [] });
            try {
                const [catalog, connections] = await Promise.all([listNangoIntegrations(), listProjectConnections(projectId)]);
                return NextResponse.json({ configured: true, catalog, connections });
            } catch (error) {
                return fail(error instanceof NangoError ? error.message : 'Could not load integrations.', 502);
            }
        }

        // A sign-in link for one app; the connection it makes belongs to this project.
        if (body.action === 'integration_connect') {
            const integration = cleanText(body.integration, 64);
            try {
                const catalog = await listNangoIntegrations();
                if (!catalog.some((item) => item.id === integration)) return fail('That app isn\'t available.', 404);
                const link = await createConnectLink(projectId, integration);
                return NextResponse.json({ url: link.url, expires_at: link.expiresAt });
            } catch (error) {
                return fail(error instanceof NangoError ? error.message : 'Could not start connecting that app.', 502);
            }
        }

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

        // Deleting cascades to versions, customer installs and runs; gateway
        // request logs keep their rows with the agent link cleared.
        if (body.action === 'delete_agent') {
            const agentId = cleanText(body.agent_id, 100);
            if (!agentId || !await scopedAgent(db, projectId, agentId)) return fail('Agent not found in this project.', 404);
            const { error } = await db.from('agents').delete().eq('project_id', projectId).eq('id', agentId);
            if (error) {
                return error.code === '23503'
                    ? fail('Another agent uses this one as a sub-agent. Remove it there first.', 409)
                    : fail('Could not delete the agent. Try again.', 502);
            }
            await invalidateAgentConfig(agentId).catch(() => undefined);
            return NextResponse.json({ deleted: agentId });
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
            const { data: rows, error: rowsError } = await db.from('agent_versions').select('version,config_json,requirements_json,visibility').eq('project_id', projectId).eq('agent_id', agentId).order('created_at', { ascending: false }).limit(100);
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
                checksum: checksumConfig(config), visibility: (source?.visibility as string | undefined) ?? 'private', created_by: access.userId,
            }).select('id').single();
            if (error || !data) return fail(error?.code === '23505' ? 'Another draft was just created. Refresh and try again.' : 'Could not create a new draft.', error?.code === '23505' ? 409 : 502);
            return NextResponse.json({ version_id: data.id }, { status: 201 });
        }

        const versionId = cleanText(body.version_id, 100);
        const version = versionId ? await scopedVersion(db, projectId, agentId, versionId) : null;
        if (['save_draft', 'save_tools', 'mcp_connect', 'mcp_oauth_start', 'integration_attach', 'test_version', 'publish_version', 'set_visibility'].includes(body.action) && !version) return fail('Version not found in this project.', 404);

        // Marketplace publishing: flip a version's visibility. Public
        // versions appear in anonymous discovery; anything else stays hidden.
        if (body.action === 'set_visibility' && version) {
            const visibility = typeof body.visibility === 'string' ? body.visibility : '';
            if (!['private', 'tenant', 'unlisted', 'public'].includes(visibility)) {
                return fail('Visibility must be private, tenant, unlisted, or public.', 400);
            }
            const { data, error } = await db.from('agent_versions')
                .update({ visibility })
                .eq('project_id', projectId)
                .eq('id', (version as { id: string }).id)
                .select('id, visibility')
                .single();
            if (error || !data) return fail('Could not update visibility.', 502);
            return NextResponse.json({ version_id: (data as { id: string }).id, visibility: (data as { visibility: string }).visibility });
        }

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

        // The agent's tools (webhook and system). Either list may be sent alone. Saved like any edit: the draft goes back
        // to untested, so publishing runs a fresh test.
        // Writes a draft's new config: saved like any edit, so the draft goes
        // back to untested and publishing runs a fresh test.
        const saveDraftConfig = async (config: AgentVersionConfig) => {
            const { data: saved, error: saveError } = await db.from('agent_versions').update({
                config_json: config, checksum: checksumConfig(config), status: 'draft',
                last_tested_at: null, last_test_passed: false,
            }).eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId)
                .in('status', ['draft', 'ready_for_review']).select('id').maybeSingle();
            return !saveError && !!saved;
        };
        const lockedVersion = version && ['published', 'deprecated', 'retired'].includes(version.status as string);

        /**
         * Begin signing in to an OAuth MCP server: find its sign-in, register
         * Cencori with it and seal what the callback needs into `state`.
         */
        const startMcpSignIn = async (rawUrl: unknown, serverId: string | null): Promise<{ ok: true; authorizeUrl: string; issuer: string } | { ok: false; message: string }> => {
            const normalized = await normalizeMcpServerUrl(rawUrl);
            if (!normalized.ok) return normalized;
            const discovery = await discoverMcpAuth(normalized.url.toString()).catch(() => null);
            if (!discovery) return { ok: false, message: 'This server doesn\'t offer sign-in. Paste a key instead.' };
            const forwardedHost = request.headers.get('x-forwarded-host');
            const consoleOrigin = forwardedHost ? `${request.headers.get('x-forwarded-proto') ?? 'https'}://${forwardedHost}` : new URL(request.url).origin;
            const { redirectUri, returnOrigin } = mcpRedirectFor(consoleOrigin);
            let client: { clientId: string; clientSecret: string | null };
            try {
                client = await registerMcpClient(discovery.server, redirectUri);
            } catch (error) {
                return { ok: false, message: error instanceof Error ? error.message : 'The server refused to register Cencori.' };
            }
            const pkce = pkcePair();
            const state = sealMcpOAuthState({
                projectId, organizationId: access.organizationId, userId: access.userId,
                agentId, versionId: versionId as string, serverId,
                url: normalized.url.toString(), resource: discovery.resource, issuer: discovery.server.issuer,
                tokenEndpoint: discovery.server.tokenEndpoint, clientId: client.clientId, clientSecret: client.clientSecret,
                verifier: pkce.verifier, redirectUri, returnOrigin,
            });
            return {
                ok: true,
                authorizeUrl: mcpAuthorizeUrl(discovery, { clientId: client.clientId, redirectUri, challenge: pkce.challenge, state }),
                issuer: new URL(discovery.server.issuer).host,
            };
        };

        // The agent's tools: webhook, system and MCP. Any list may be sent alone.
        if (body.action === 'save_tools' && version) {
            if (lockedVersion) return fail('Published versions cannot be edited. Create a new draft.', 409);
            const existing = (version.config_json ?? {}) as AgentVersionConfig;
            const built = buildWebhookTools(body.webhook_tools ?? publicWebhookToolsAsInput(existing), readWebhookTools(existing), access.organizationId);
            if (!built.ok) return fail(built.message);
            const system = body.system_tools === undefined ? { ok: true as const, tools: readSystemTools(existing) } : buildSystemTools(body.system_tools);
            if (!system.ok) return fail(system.message);
            const storedMcp = readAgentMcpServers(existing);
            const mcp = body.mcp_servers === undefined ? { ok: true as const, servers: storedMcp } : buildAgentMcpServers(body.mcp_servers, storedMcp, []);
            if (!mcp.ok) return fail(mcp.message);
            const storedApps = readAgentIntegrations(existing);
            const apps = body.integrations === undefined ? { ok: true as const, servers: storedApps } : buildAgentMcpServers(body.integrations, storedApps, []);
            if (!apps.ok) return fail(apps.message);
            const config: AgentVersionConfig = { ...existing, webhook_tools: built.tools, system_tools: system.tools, mcp_servers: mcp.servers, integrations: apps.servers };
            if (apps.servers.length === 0) delete config.integrations;
            if (built.tools.length === 0) delete config.webhook_tools;
            if (Object.keys(system.tools).length === 0) delete config.system_tools;
            if (mcp.servers.length === 0) delete config.mcp_servers;
            if (!(await saveDraftConfig(config))) return fail('Draft changed while you were editing. Refresh and try again.', 409);
            // Sign-ins for servers taken off this draft are wiped, unless another
            // version of the agent (the live one, say) still uses them.
            const dropped = storedMcp.filter((server) => server.oauth && !mcp.servers.some((kept) => kept.oauth?.connection_id === server.oauth!.connection_id)).map((server) => server.oauth!.connection_id);
            if (dropped.length > 0) {
                const { data: others } = await db.from('agent_versions').select('id, config_json').eq('project_id', projectId).eq('agent_id', agentId).neq('id', versionId);
                const stillUsed = new Set(((others ?? []) as Array<{ config_json: Record<string, unknown> | null }>).flatMap((other) => readAgentMcpServers(other.config_json).map((server) => server.oauth?.connection_id)).filter(Boolean));
                await revokeMcpConnections(db, projectId, dropped.filter((id) => !stillUsed.has(id))).catch(() => undefined);
            }
            return NextResponse.json({ version_id: versionId, webhook_tools: publicWebhookTools(built.tools), system_tools: system.tools, mcp_servers: publicAgentMcpServers(mcp.servers), integrations: publicAgentMcpServers(apps.servers) });
        }

        // Paste a server URL: connect, list its tools and add it to the draft in
        // one step. With server_id, refreshes that server's tools (or its key).
        // A server that wants a key answers needs_auth, and nothing is saved.
        if (body.action === 'mcp_connect' && version) {
            if (lockedVersion) return fail('Published versions cannot be edited. Create a new draft.', 409);
            const existing = (version.config_json ?? {}) as AgentVersionConfig;
            const stored = readAgentMcpServers(existing);
            const previous = typeof body.server_id === 'string' ? stored.find((server) => server.id === body.server_id) ?? null : null;
            if (body.server_id && !previous) return fail('That server is no longer on this draft. Refresh and try again.', 404);
            if (!previous && stored.length >= AGENT_MCP_SERVERS_MAX) return fail(`Add up to ${AGENT_MCP_SERVERS_MAX} MCP servers.`);
            const connected = await connectAgentMcpServer({ url: body.url ?? previous?.url, headers: body.headers, organizationId: access.organizationId, previous });
            if (!connected.ok) {
                // A server that wants auth may offer sign-in: the console then shows "Sign in" before "paste a key".
                // A server that wants auth may offer sign-in. The console already has
                // a window open for it, so the sign-in link comes back right here.
                const signIn = connected.needsAuth && body.headers === undefined
                    ? await startMcpSignIn(body.url ?? previous?.url, previous?.id ?? null)
                    : null;
                return NextResponse.json({
                    ok: false,
                    needs_auth: connected.needsAuth,
                    ...(signIn?.ok ? { sign_in: { issuer: signIn.issuer, authorize_url: signIn.authorizeUrl } } : {}),
                    error: signIn?.ok ? 'This server uses sign-in.' : signIn && /refused to register/.test(signIn.message) ? signIn.message : connected.message,
                }, { status: connected.needsAuth ? 401 : 422 });
            }
            if (!previous && stored.some((server) => server.url === connected.server.url)) return fail('That server is already connected to this agent.', 409);
            const servers = previous ? stored.map((server) => (server.id === previous.id ? connected.server : server)) : [...stored, connected.server];
            const mcp = buildAgentMcpServers(servers.map(({ id, name, enabled }) => ({ id, name, enabled })), stored, [connected.server]);
            if (!mcp.ok) return fail(mcp.message);
            if (!(await saveDraftConfig({ ...existing, mcp_servers: mcp.servers }))) return fail('Draft changed while you were editing. Refresh and try again.', 409);
            return NextResponse.json({ ok: true, server: publicAgentMcpServers([connected.server])[0] });
        }

        // Sign in to an OAuth MCP server: register Cencori with it and return
        // where to send the owner. The callback (/api/mcp/oauth/callback)
        // finishes the sign-in and adds the server to the draft.
        // Give the agent a connected app: find its tools and add it to the draft
        // (refreshing its tool list, and keeping the choices, if it's already there).
        if (body.action === 'integration_attach' && version) {
            if (lockedVersion) return fail('Published versions cannot be edited. Create a new draft.', 409);
            const integration = cleanText(body.integration, 64);
            const existing = (version.config_json ?? {}) as AgentVersionConfig;
            const stored = readAgentIntegrations(existing);
            try {
                const [catalog, connections] = await Promise.all([listNangoIntegrations(), listProjectConnections(projectId)]);
                const app = catalog.find((item) => item.id === integration);
                if (!app) return fail('That app isn\'t available.', 404);
                const mine = connections.filter((connection) => connection.integration === integration).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                if (mine.length === 0) return fail(`Connect ${app.name} first.`, 409);
                // One account per app per project: a reconnect replaces the earlier one.
                await Promise.all(mine.slice(1).map((old) => deleteConnection(integration, old.connectionId).catch(() => undefined)));
                const tools = await discoverIntegrationTools(projectId, integration);
                if (tools.length === 0) return fail(`${app.name} is connected, but it has no tools the agent can use yet.`, 422);
                const previous = stored.find((server) => server.nango?.integration === integration);
                const icon = previous?.icon ?? (app.logo ? await iconFrom(app.logo).catch(() => null) : null);
                const enabled = previous
                    ? tools.filter((tool) => previous.enabled.includes(tool.name) || (!previous.tools.some((t) => t.name === tool.name) && !tool.destructive)).map((tool) => tool.name)
                    // A first attach starts with the safe tools on, up to a manageable number.
                    : tools.filter((tool) => !tool.destructive).slice(0, 20).map((tool) => tool.name);
                const server: AgentMcpServer = {
                    id: previous?.id ?? `int_${integration}`,
                    name: app.name,
                    url: `nango:${integration}`,
                    headers: [],
                    tools: tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema, readOnly: tool.readOnly, destructive: tool.destructive })),
                    enabled,
                    discovered_at: new Date().toISOString(),
                    ...(icon ? { icon } : {}),
                    nango: { integration },
                };
                const next = previous ? stored.map((item) => (item.id === previous.id ? server : item)) : [...stored, server];
                const checked = buildAgentMcpServers(next.map(({ id, name, enabled: on }) => ({ id, name, enabled: on })), stored, [server]);
                if (!checked.ok) return fail(checked.message);
                if (!(await saveDraftConfig({ ...existing, integrations: checked.servers }))) return fail('Draft changed while you were editing. Refresh and try again.', 409);
                return NextResponse.json({ integration: publicAgentMcpServers([server])[0] });
            } catch (error) {
                return fail(error instanceof NangoError ? error.message : 'Could not add that app.', 502);
            }
        }

        if (body.action === 'mcp_oauth_start' && version) {
            if (lockedVersion) return fail('Published versions cannot be edited. Create a new draft.', 409);
            const stored = readAgentMcpServers((version.config_json ?? {}) as Record<string, unknown>);
            const previous = typeof body.server_id === 'string' ? stored.find((server) => server.id === body.server_id) ?? null : null;
            if (body.server_id && !previous) return fail('That server is no longer on this draft. Refresh and try again.', 404);
            if (!previous && stored.length >= AGENT_MCP_SERVERS_MAX) return fail(`Add up to ${AGENT_MCP_SERVERS_MAX} MCP servers.`);
            const started = await startMcpSignIn(body.url ?? previous?.url, previous?.id ?? null);
            if (!started.ok) return fail(started.message, 422);
            return NextResponse.json({ authorize_url: started.authorizeUrl });
        }

        if (body.action === 'test_version' && version) {
            // Published versions can be chatted with too; only drafts collect
            // the passing test that publishing requires.
            const locked = ['published', 'deprecated', 'retired'].includes(version.status as string);
            const input = cleanText(body.input, 2000) || 'Introduce yourself in one sentence.';
            const config = (version.config_json ?? {}) as AgentVersionConfig;
            const simple = simpleManifest(config);
            if (!simple.ok) return fail(simple.message, 422);
            const checked = validateVersionConfig(config);
            if (!checked.ok) return fail(checked.message, 422);
            const organizationId = access.organizationId;
            // The agent's own knowledge is live, so the test uses it too. It only
            // needs the input, so the lookup runs while the checks below do.
            const knowledgePromise = import('@/lib/embedded/turn-knowledge')
                .then(({ retrieveTurnKnowledge }) => retrieveTurnKnowledge(db as never, { projectId, organizationId, installationId: null, agentId, queryText: input }))
                .catch(() => ({ block: null, citations: [] as unknown[] }));
            const manifestCheck = await validateManifest(db, { projectId, agentId, manifest: simple.manifest });
            if (!manifestCheck.valid) return fail(manifestCheck.errors.join(' '), 422);
            if (!locked) {
                const { data: validating, error: statusError } = await db.from('agent_versions').update({ status: 'validating', last_test_passed: false }).eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId).eq('checksum', version.checksum as string).in('status', ['draft', 'ready_for_review']).select('id').maybeSingle();
                if (statusError || !validating) return fail('Version changed while testing. Refresh and try again.', 409);
            }
            const backToDraft = async () => {
                if (locked) return;
                await db.from('agent_versions').update({ status: 'draft', last_tested_at: new Date().toISOString(), last_test_passed: false }).eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId).eq('status', 'validating').eq('checksum', version.checksum as string);
            };

            const agentName = typeof (agent as { name?: unknown } | null)?.name === 'string'
                ? ((agent as { name: string }).name.trim().slice(0, 120))
                : '';
            const testInstructions = simple.manifest.instructions?.trim() ?? '';
            const testKnowledge = await knowledgePromise;
            const testSystemParts = [
                agentName ? `Your name is "${agentName}". Always introduce yourself as ${agentName} when asked who you are.` : null,
                testInstructions || null,
                testKnowledge.block,
                agentClock(),
            ].filter(Boolean) as string[];
            // The Preview chat sends its earlier turns so the test is a conversation.
            // A reply notes the tools it used, so the agent knows it really looked them up.
            const history = (Array.isArray(body.history) ? body.history : [])
                .filter((m: unknown): m is { role: 'user' | 'assistant'; content: string; tools?: unknown } => !!m && typeof m === 'object'
                    && ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'assistant')
                    && typeof (m as { content?: unknown }).content === 'string')
                .slice(-20)
                .map((m: { role: 'user' | 'assistant'; content: string; tools?: unknown }) => {
                    const used = m.role === 'assistant' && Array.isArray(m.tools) ? m.tools.filter((t): t is string => typeof t === 'string').slice(0, 10) : [];
                    return { role: m.role, content: `${used.length ? `[Called tools: ${used.join(', ')}]\n` : ''}${m.content.slice(0, 4000)}` };
                });
            const messages = [
                { role: 'system' as const, content: testSystemParts.join('\n\n') },
                ...history,
                { role: 'user' as const, content: input },
            ];
            // Pure UUID: credit_transactions.reference_id is UUID-typed,
            // so a prefixed id fails the debit and blocks the test.
            const testRequestId = crypto.randomUUID();
            const gatewayStartedAt = Date.now();

            // Meter the model call before treating the test as successful:
            // idempotent wallet debit + ai_requests usage row. A failed
            // charge/metre leaves last_test_passed=false so the test cannot
            // become a free pass.
            const settle = async (outcome: {
                content: string; model: string; provider: string;
                usage: { promptTokens: number; completionTokens: number; totalTokens: number };
                cost: { providerCostUsd: number; cencoriChargeUsd: number; markupPercentage: number };
            }): Promise<{ ok: true } | { ok: false; status: number; message: string }> => {
                if (!outcome.content.trim()) {
                    await backToDraft();
                    return { ok: false, status: 502, message: 'The model returned no response. Try again.' };
                }
                const { meterAgentTestUsage } = await import('@/lib/embedded/test-metering');
                const metered = await meterAgentTestUsage({
                    supabase: db as never, projectId, organizationId, tier,
                    endpoint: 'agents.studio_test', requestId: testRequestId, agentId,
                    model: outcome.model, provider: outcome.provider,
                    usage: outcome.usage, cost: outcome.cost,
                    latencyMs: Date.now() - gatewayStartedAt,
                });
                if (!metered.ok) {
                    await backToDraft();
                    return { ok: false, status: metered.code === 'insufficient_credits' ? 402 : 502, message: metered.message };
                }
                if (locked) return { ok: true };
                const { data: evidence, error: evidenceError } = await db.from('agent_versions').update({ status: 'ready_for_review', last_tested_at: new Date().toISOString(), last_test_passed: true }).eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId).eq('status', 'validating').eq('checksum', version.checksum as string).select('id').maybeSingle();
                if (evidenceError || !evidence) {
                    await db.from('agent_versions').update({ status: 'draft', last_test_passed: false }).eq('project_id', projectId).eq('agent_id', agentId).eq('id', versionId).eq('status', 'validating').eq('checksum', version.checksum as string);
                    return { ok: false, status: 502, message: 'Test ran, but passing evidence could not be saved. Try again.' };
                }
                return { ok: true };
            };

            // The Preview chat streams the reply as it's written; the result is
            // settled once it ends. Events: delta, then done or error.
            if (body.stream === true) {
                const encoder = new TextEncoder();
                const stream = new ReadableStream<Uint8Array>({
                    async start(controller) {
                        // The tab can close mid-reply; the result still settles, nothing is sent.
                        const send = (event: string, data: unknown) => {
                            try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ }
                        };
                        try {
                            const [{ resolveGatewayProvider }, { streamGatewayChat }, { settleStreamUsage }, { calculateGatewayCharge }] = await Promise.all([
                                import('@/lib/gateway/providers-setup'),
                                import('@/lib/gateway/chat-executor'),
                                import('@/lib/gateway/stream-usage'),
                                import('@/lib/gateway/model-access'),
                            ]);
                            const resolved = await resolveGatewayProvider({
                                supabase: db as never, projectId, organizationId,
                                requestedModel: simple.manifest.model!,
                                autoRouterInput: { text: input, tools: null, hasImage: false },
                            });
                            const pricing = await resolved.provider.getPricing(resolved.model);
                            // Tools run for real here: Cencori calls the endpoint (or the system
                            // action) and the agent answers from the result, a few rounds at most.
                            const toolset = agentToolset(config as Record<string, unknown>);
                            toolset.warm(projectId);
                            let conversationEnded = false;
                            let conversation: UnifiedMessage[] = messages;
                            let content = '';
                            let chunkModel = resolved.model;
                            let chunkProvider = resolved.providerName;
                            const totals = { promptTokens: 0, completionTokens: 0, providerCostUsd: 0, cencoriChargeUsd: 0, markupPercentage: 0 };
                            for (let round = 0; ; round++) {
                                let roundText = '';
                                let reported: import('@/lib/providers/base').TokenUsage | undefined;
                                const calls = new Map<string, { id: string; name: string; args: string }>();
                                // Text from an earlier round stays; the next starts on its own line.
                                let separated = content === '';
                                // Once the agent has ended the conversation it only says goodbye.
                                const offerTools = toolset.definitions.length > 0 && round < WEBHOOK_TOOL_MAX_ITERATIONS && !conversationEnded;
                                for await (const chunk of streamGatewayChat({
                                    supabase: db as never, projectId, organizationId, tier,
                                    request: { messages: conversation, model: resolved.model, maxTokens: TEST_MAX_TOKENS, stream: true, ...(offerTools ? { tools: toolset.definitions as never } : {}) },
                                    resolved: resolved as never,
                                    requestId: testRequestId,
                                })) {
                                    if (chunk.error) throw new Error(chunk.error);
                                    if (chunk.delta) {
                                        if (!separated) {
                                            separated = true;
                                            content += '\n\n';
                                            send('delta', { delta: '\n\n' });
                                        }
                                        roundText += chunk.delta;
                                        content += chunk.delta;
                                        send('delta', { delta: chunk.delta });
                                    }
                                    for (const call of chunk.toolCalls ?? []) {
                                        const key = call.id || `call_${calls.size}`;
                                        const entry = calls.get(key) ?? { id: key, name: '', args: '' };
                                        if (call.function?.name) entry.name += call.function.name;
                                        if (call.function?.arguments) entry.args += call.function.arguments;
                                        calls.set(key, entry);
                                    }
                                    if (chunk.usage) reported = chunk.usage;
                                    if (chunk.actualModel) chunkModel = chunk.actualModel;
                                    if (chunk.actualProvider) chunkProvider = chunk.actualProvider;
                                }
                                const settled = await settleStreamUsage({
                                    reported,
                                    pricing,
                                    estimate: async () => {
                                        const promptText = conversation.map((m) => m.content).join(' ');
                                        try {
                                            return {
                                                promptTokens: await resolved.provider.countTokens(promptText, chunkModel),
                                                completionTokens: await resolved.provider.countTokens(roundText, chunkModel),
                                            };
                                        } catch {
                                            return { promptTokens: Math.max(1, Math.ceil(promptText.length / 4)), completionTokens: Math.max(1, Math.ceil(roundText.length / 4)) };
                                        }
                                    },
                                });
                                const charge = calculateGatewayCharge(settled.providerCostUsd, pricing, resolved.billingMode);
                                totals.promptTokens += settled.promptTokens;
                                totals.completionTokens += settled.completionTokens;
                                totals.providerCostUsd += settled.providerCostUsd;
                                totals.cencoriChargeUsd += charge.cencoriChargeUsd;
                                totals.markupPercentage = charge.markupPercentage;

                                const toolCalls = [...calls.values()].filter((call) => call.name);
                                if (toolCalls.length === 0 || !offerTools) break;
                                conversation = [...conversation, {
                                    role: 'assistant',
                                    content: roundText,
                                    tool_calls: toolCalls.map((call) => ({ id: call.id, type: 'function' as const, function: { name: call.name, arguments: call.args } })),
                                }];
                                for (const call of toolCalls) {
                                    send('tool', { id: call.id, name: call.name, status: 'running' });
                                    const outcome = await toolset.run(call, {
                                        organizationId, projectId, agentId, agentName, surface: 'preview',
                                        transcript: conversation.map((m) => ({ role: m.role, content: m.content })),
                                    });
                                    if (outcome.endsConversation) conversationEnded = true;
                                    send('tool', { id: call.id, name: call.name, status: outcome.ok ? 'done' : 'failed' });
                                    conversation = [...conversation, { role: 'tool', content: outcome.output, toolCallId: call.id }];
                                }
                            }
                            const done = await settle({
                                content, model: chunkModel, provider: chunkProvider,
                                usage: { promptTokens: totals.promptTokens, completionTokens: totals.completionTokens, totalTokens: totals.promptTokens + totals.completionTokens },
                                cost: { providerCostUsd: totals.providerCostUsd, cencoriChargeUsd: totals.cencoriChargeUsd, markupPercentage: totals.markupPercentage },
                            });
                            if (done.ok) send('done', { model: chunkModel, knowledge_passages: testKnowledge.citations.length, conversation_ended: conversationEnded });
                            else send('error', { message: done.message });
                        } catch (error) {
                            await backToDraft().catch(() => {});
                            send('error', { message: error instanceof Error ? error.message : 'Test failed. Try again.' });
                        } finally {
                            try { controller.close(); } catch { /* closed */ }
                        }
                    },
                });
                return new Response(stream, {
                    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' },
                });
            }

            try {
                const { executeGatewayChat } = await import('@/lib/gateway/chat-executor');
                const result = await executeGatewayChat({
                    supabase: db as never, projectId, organizationId, tier,
                    request: { messages, model: simple.manifest.model!, maxTokens: TEST_MAX_TOKENS },
                    requestId: testRequestId,
                });
                const done = await settle({
                    content: result.content ?? '',
                    model: (result as { actualModel?: string }).actualModel ?? result.model,
                    provider: (result as { actualProvider?: string }).actualProvider ?? result.provider,
                    usage: result.usage,
                    cost: result.cost,
                });
                if (!done.ok) return fail(done.message, done.status);
                return NextResponse.json({ output: result.content, model: result.model, usage: result.usage, knowledge_passages: testKnowledge.citations.length });
            } catch (error) {
                await backToDraft();
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
            // Customers on the stable channel follow the release.
            await promoteStableInstallations(db as never, { projectId, agentId, versionId });
            // The note from Review changes. Best-effort: the version is already
            // published, and the column arrives by a hand-applied migration
            // (20261025_020000_agent_version_release_notes).
            const releaseNotes = cleanText(body.release_notes, 500);
            if (releaseNotes) {
                const { error: notesError } = await db.from('agent_versions')
                    .update({ release_notes: releaseNotes })
                    .eq('project_id', projectId)
                    .eq('id', versionId);
                if (notesError) console.warn('[Agent studio] Release notes not saved:', notesError.message);
            }
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
