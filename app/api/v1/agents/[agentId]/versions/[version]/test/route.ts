import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

async function loadTarget(supabase: ReturnType<typeof createAdminClient>, projectId: string, agentId: string, version: string) {
    const { data: agent } = await supabase.from('agents').select('id, project_id').eq('id', agentId).maybeSingle();
    if (!agent || (agent.project_id as string) !== projectId) return null;
    const { data } = await supabase.from('agent_versions').select('*').eq('agent_id', agentId).eq('version', version).maybeSingle();
    return (data ?? (await supabase.from('agent_versions').select('*').eq('id', version).eq('agent_id', agentId).maybeSingle()).data ?? null) as Record<string, unknown> | null;
}

const TEST_MAX_TOKENS = 500;

// POST .../test — model-only draft execution plus capability-readiness checks.
// No run row, webhooks, installation bindings, or credential use; only test
// evidence on the draft version is persisted.
export async function POST(req: NextRequest, ctx: { params: Promise<{ agentId: string; version: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { agentId, version } = await ctx.params;
    const supabase = createAdminClient();
    const target = await loadTarget(supabase, validation.context.projectId, agentId, version);
    if (!target) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent version not found', { requestId }), { requestId });
    const status = (target.status as string) ?? 'draft';
    if (['published', 'deprecated', 'retired'].includes(status)) {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', 'Published versions are immutable; test a draft instead', { requestId }), { requestId });
    }

    let body: { input?: string; test_connection_ids?: string[] };
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }
    const input = (body.input ?? 'Reply with a one-sentence readiness self-check.').toString().slice(0, 2000);
    if (body.test_connection_ids !== undefined && (!Array.isArray(body.test_connection_ids) || body.test_connection_ids.length > 20 || !body.test_connection_ids.every((id) => typeof id === 'string' && id.trim()))) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'test_connection_ids must contain at most 20 non-empty IDs', { requestId }), { requestId });
    }

    const { normalizeManifest, validateManifest } = await import('@/lib/embedded/manifest');
    const manifest = normalizeManifest((target.config_json ?? {}) as Record<string, unknown>);
    const check = await validateManifest(supabase as never, { projectId: validation.context.projectId, agentId, manifest });
    if (!check.valid) {
        return addGatewayHeaders(
            NextResponse.json({ valid: false, errors: check.errors, warnings: check.warnings }, { status: 422 }),
            { requestId },
        );
    }
    if (!manifest.model) {
        return addGatewayHeaders(embeddedError(422, 'invalid_request_error', 'Version has no model configured', { requestId }), { requestId });
    }

    // Resolve every declared dependency before recording a passing test.
    // Explicit test-only connections are required; production credentials are
    // never invoked by this model-readiness test.
    const capabilities: { skills: unknown[]; connections: unknown[]; mcp_tools: unknown[] } = { skills: [], connections: [], mcp_tools: [] };
    const capabilityErrors: string[] = [];
    const testConnectionIds = Array.isArray(body.test_connection_ids) ? body.test_connection_ids.map(dePrefixId) : [];
    const { data: testConnections, error: connectionError } = testConnectionIds.length > 0
        ? await supabase.from('tool_connections').select('id, connector_slug, scopes, metadata, status').eq('project_id', validation.context.projectId).in('id', testConnectionIds)
        : { data: [], error: null };
    if (connectionError) capabilityErrors.push('Unable to verify test connections');
    for (const s of manifest.skills) {
        const { data: sv } = await supabase.from('skill_versions').select('id, status').eq('project_id', validation.context.projectId).eq('id', s.skill_version_id.replace(/^(skv_)/, '')).maybeSingle();
        const skillStatus = (sv as { status?: string } | null)?.status ?? 'missing';
        capabilities.skills.push({ skill_version_id: s.skill_version_id, status: skillStatus });
        if (skillStatus !== 'published') capabilityErrors.push(`Skill ${s.skill_version_id} is not published`);
    }
    for (const req of manifest.connection_requirements) {
        const { data: connector } = await supabase.from('connectors').select('slug').eq('slug', req.connector.toLowerCase()).maybeSingle();
        const matching = ((testConnections ?? []) as Array<{ id: string; connector_slug: string; scopes: string[]; metadata: { test_only?: boolean } | null; status: string }>).find((c) =>
            c.connector_slug === req.connector.toLowerCase() && c.status === 'active' && c.metadata?.test_only === true && req.scopes.every((scope) => c.scopes.includes(scope)));
        capabilities.connections.push({ connector: req.connector, known: Boolean(connector), test_connection_id: matching?.id ?? null });
        if (!matching) capabilityErrors.push(`Required connector ${req.connector} needs an active test_only connection with the declared scopes`);
    }
    for (const ref of manifest.mcp_tools) {
        const { data: server } = await supabase.from('mcp_servers').select('id, status, tool_snapshot').eq('project_id', validation.context.projectId).eq('id', ref.server_id.replace(/^(mcp_)/, '')).maybeSingle();
        const snapshot = ((server as { tool_snapshot?: { tools?: Array<{ name: string }> } } | null)?.tool_snapshot?.tools ?? []);
        capabilities.mcp_tools.push({
            server_id: ref.server_id,
            tool: ref.tool,
            server_status: (server as { status?: string } | null)?.status ?? 'missing',
            in_snapshot: snapshot.some((t) => t.name === ref.tool),
        });
        if (server?.status !== 'active' || !snapshot.some((t) => t.name === ref.tool)) {
            capabilityErrors.push(`MCP tool ${ref.tool} is unavailable in the active server snapshot`);
        }
    }
    if (capabilityErrors.length > 0) {
        await supabase.from('agent_versions').update({ last_tested_at: new Date().toISOString(), last_test_passed: false }).eq('id', target.id as string);
        return addGatewayHeaders(NextResponse.json({ valid: false, errors: capabilityErrors, capabilities }, { status: 422 }), { requestId });
    }

    const { data: project } = await supabase.from('projects').select('organization_id, organizations!inner(subscription_tier)').eq('id', validation.context.projectId).maybeSingle();
    const organizationId = ((project as { organization_id?: string } | null)?.organization_id as string) ?? '';
    const tier = (((project as { organizations?: { subscription_tier?: string } } | null)?.organizations?.subscription_tier as string) ?? 'free') as import('@/lib/entitlements').SubscriptionTier;

    try {
        const { executeGatewayChat } = await import('@/lib/gateway/chat-executor');
        const response = await executeGatewayChat({
            supabase: supabase as never,
            projectId: validation.context.projectId,
            organizationId,
            tier,
            request: {
                messages: [
                    ...(manifest.instructions ? [{ role: 'system' as const, content: `[SANDBOX TEST — no tools, knowledge, or connections]\n${manifest.instructions}` }] : []),
                    { role: 'user' as const, content: input },
                ],
                model: manifest.model,
                maxTokens: TEST_MAX_TOKENS,
            },
            requestId: `test_${requestId.slice(0, 8)}`,
        });
        // Record test evidence: publication requires a passing test.
        const { error: evidenceError } = await supabase.from('agent_versions').update({ last_tested_at: new Date().toISOString(), last_test_passed: true }).eq('id', (target.id as string));
        if (evidenceError) throw new Error(`Unable to record passing test evidence: ${evidenceError.message}`);
        return addGatewayHeaders(
            NextResponse.json({
                valid: true,
                warnings: check.warnings,
                capabilities,
                output: response.content,
                model: response.model,
                provider: response.provider,
                usage: response.usage,
                test: true,
            }),
            { requestId },
        );
    } catch (e) {
        await supabase.from('agent_versions').update({ last_tested_at: new Date().toISOString(), last_test_passed: false }).eq('id', (target.id as string));
        return addGatewayHeaders(embeddedError(502, 'invalid_request_error', e instanceof Error ? e.message : 'Test execution failed', { requestId }), { requestId });
    }
}
