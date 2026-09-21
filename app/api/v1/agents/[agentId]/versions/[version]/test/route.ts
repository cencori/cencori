import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
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

// POST .../test — sandboxed draft execution. No run row, no webhooks, no
// installation bindings, no credential use: model + instructions only, with a
// fixed token cap. Production state is never mutated.
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

    let body: { input?: string };
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }
    const input = (body.input ?? 'Reply with a one-sentence readiness self-check.').toString().slice(0, 2000);

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
        return addGatewayHeaders(
            NextResponse.json({
                valid: true,
                warnings: check.warnings,
                output: response.content,
                model: response.model,
                provider: response.provider,
                usage: response.usage,
                test: true,
            }),
            { requestId },
        );
    } catch (e) {
        return addGatewayHeaders(embeddedError(502, 'invalid_request_error', e instanceof Error ? e.message : 'Test execution failed', { requestId }), { requestId });
    }
}
