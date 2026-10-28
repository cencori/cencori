import { NextRequest, NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { extractGatewayCallerIdentity, logApiGatewayRequest } from "@/lib/api-gateway-logs";
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
    type GatewayContext,
} from "@/lib/gateway-middleware";
import { extractBearerToken, extractCencoriApiKeyFromHeaders } from "@/lib/api-keys";
import { verifyClientToken } from "@/lib/embedded/client-tokens";
import { CLIENT_TOKEN_PREFIX } from "@/lib/embedded/types";
import { dePrefixId } from "@/lib/embedded/http";
import { denyOnScopeMismatch, hasClientPermission } from "@/lib/embedded/session-auth";
import { checkEndUserQuota, recordEndUserUsage, type QuotaCheckResult } from "@/lib/end-user-billing";
import type { UnifiedMessage } from "@/lib/providers/base";
import {
    translateResponsesInputItems,
    type TranslatableInputItem,
} from "@/lib/gateway/responses-translate";
import { runGatewayInputPipeline } from "@/lib/gateway/input-guard";
import { buildMaskedLogPayloads } from "@/lib/gateway/chat-post-success";
import { toOpenAiErrorBody } from "@/lib/gateway/guard-types";
import type { ResponsesRequest } from "@/lib/gateway/v1-responses-execute";
import type { SubscriptionTier } from "@/lib/entitlements";
import { resolveAgentContext } from "@/lib/gateway/agent-context";
import { executeSessionTurn, expireStaleSessions } from "@/lib/gateway/session-engine";
import type { TurnRequestBody } from "@/lib/gateway/session-types";
import { waitUntil } from "@vercel/functions";
import { promptPayload } from '@/lib/gateway/log-payload';
import { buildInputSafetyBlock, safetyHeaders } from '@/lib/gateway/safety-response';
import {
    buildMemoryBlock,
    getProjectMemorySettings,
    normalizeDirectiveScope,
    parseMemoryDirective,
    retrieveMemories,
    runChatMemoryWriteback,
    type MemoryDirective,
    type MemorySettings,
    type RetrievedMemory,
} from "@/lib/memory";
import { installedTurnTools } from '@/lib/embedded/turn-tools';
import { intersectBrowserEnabled, intersectNetworkPolicy, type NetworkPolicy } from '@/lib/embedded/net-policy';
import type { CapabilityManifest } from '@/lib/embedded/manifest';

const normalizeGatewayModelId = (modelId: string): string => {
    const strippedModel = modelId.startsWith("cencori/")
        ? modelId.slice("cencori/".length)
        : modelId;

    const aliases: Record<string, string> = {
        "gpt-5.4-thinking": "gpt-5.4",
        "gpt-5.3": "gpt-5.3-chat-latest",
        "gpt-5.3-instant": "gpt-5.3-chat-latest",
    };

    return aliases[strippedModel] || strippedModel;
};

export async function OPTIONS() {
    return handleCorsPreFlight();
}

/**
 * A published version's config, reused for a minute: published versions don't
 * change (a new release is a new version), so a conversation's every turn
 * needn't read it again. The status is kept with it, so a retired version
 * still stops turns within the minute.
 */
const PUBLISHED_VERSION_TTL_MS = 60_000;
const publishedVersions = new Map<string, { value: { config_json: Record<string, unknown> | null; status: string } | null; expiresAt: number }>();

async function publishedVersion(db: ReturnType<typeof createAdminClient>, projectId: string, versionId: string): Promise<{ config_json: Record<string, unknown> | null; status: string } | null> {
    const key = `${projectId}:${versionId}`;
    const cached = publishedVersions.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const { data } = await db.from('agent_versions').select('config_json, status').eq('project_id', projectId).eq('id', versionId).maybeSingle();
    const value = data as { config_json: Record<string, unknown> | null; status: string } | null;
    if (value?.status === 'published') {
        publishedVersions.set(key, { value, expiresAt: Date.now() + PUBLISHED_VERSION_TTL_MS });
        if (publishedVersions.size > 2_000) {
            const oldest = publishedVersions.keys().next().value;
            if (oldest !== undefined) publishedVersions.delete(oldest);
        }
    }
    return value;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const endpoint = '/v1/sessions/:id/turns';
    const startedAt = Date.now();
    // Per-step durations for this turn, sent as Server-Timing with the stream.
    const steps: [string, number][] = [];
    let stepAt = startedAt;
    const step = (name: string) => { const now = Date.now(); steps.push([name, now - stepAt]); stepAt = now; };
    const callerIdentity = extractGatewayCallerIdentity(req.headers);
    let gatewayCtx: GatewayContext | null = null;
    const { id: sessionId } = await params;

    const respond = (response: NextResponse, errorCode?: string, errorMessage?: string) => {
        if (!gatewayCtx) return response;
        void logApiGatewayRequest({
            projectId: gatewayCtx.projectId,
            apiKeyId: gatewayCtx.apiKeyId,
            requestId: gatewayCtx.requestId,
            endpoint,
            method: 'POST',
            statusCode: response.status,
            startedAt,
            environment: gatewayCtx.environment,
            ipAddress: gatewayCtx.clientIp,
            countryCode: gatewayCtx.countryCode,
            userAgent: req.headers.get('user-agent'),
            callerOrigin: callerIdentity.callerOrigin,
            clientApp: callerIdentity.clientApp,
            errorCode: errorCode || null,
            errorMessage: errorMessage || null,
        });
        return addGatewayHeaders(response, { requestId: gatewayCtx.requestId });
    };

    const respondError = (status: number, message: string, code = 'invalid_request_error') => {
        return respond(
            NextResponse.json({ error: { message, type: 'invalid_request_error', code }, status: 'failed' }, { status }),
            code,
            message,
        );
    };

    try {
        const providedApiKey = extractCencoriApiKeyFromHeaders(req.headers);
        let embeddedScope: { tenantId: string; externalUserId: string; installationIds?: string[]; permissions?: string[] } | null = null;
        if (!providedApiKey) {
            const bearer = extractBearerToken(req.headers.get('Authorization'));
            if (bearer?.startsWith(CLIENT_TOKEN_PREFIX)) {
                const verified = verifyClientToken(bearer);
                if (!verified.ok) return respondError(401, verified.message, verified.code);
                const admin = createAdminClient();
                const { data: project } = await admin.from('projects').select('id, organization_id').eq('id', verified.claims.project_id).maybeSingle();
                if (!project) return respondError(401, 'Invalid client token project', 'client_token_revoked');
                const { data: tenant } = await admin.from('platform_tenants').select('id, status').eq('id', dePrefixId(verified.claims.tenant_id)).eq('project_id', verified.claims.project_id).maybeSingle();
                if (!tenant || (tenant.status as string) !== 'active') return respondError(403, 'Tenant is not active', 'tenant_suspended');
                // Who pays for this reply: a business plan covers it; otherwise it needs credits,
                // like an API-key call (client tokens never pass through that preflight).
                const organizationId = (project.organization_id as string) ?? '';
                const { getOrganizationPlan } = await import('@/lib/business/plans');
                const plan = await getOrganizationPlan(admin as never, organizationId);
                if (plan.accountType === 'business' && !plan.active) {
                    return respondError(402, 'This business’s plan isn’t active', 'plan_inactive');
                }
                if (plan.accountType !== 'business') {
                    const { data: org } = await admin.from('organizations').select('subscription_tier, credits_balance').eq('id', organizationId).maybeSingle();
                    const { isCreditBalanceExhausted } = await import('@/lib/credits');
                    if (org && org.subscription_tier !== 'enterprise' && isCreditBalanceExhausted(Number(org.credits_balance ?? 0))) {
                        return respondError(402, 'Credit balance exhausted: add credits to keep this agent replying', 'insufficient_credits');
                    }
                }
                gatewayCtx = {
                    supabase: admin as never,
                    projectId: verified.claims.project_id,
                    organizationId,
                    apiKeyId: null,
                    allowedModels: null,
                    sponsoredModels: null,
                    fullySponsoredKey: false,
                    environment: verified.claims.env,
                    keyType: 'client_token',
                    tier: 'embedded',
                    requestId: (await import('crypto')).randomUUID(),
                    startTime: Date.now(),
                    clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
                    countryCode: null,
                    projectName: '',
                    defaultModel: null,
                    defaultProvider: null,
                    endUserBillingEnabled: false,
                    businessPlanCovered: plan.accountType === 'business',
                    businessModelLocked: plan.accountType === 'business' && !plan.plan?.allModels,
                } as unknown as GatewayContext;
                embeddedScope = { tenantId: tenant.id as string, externalUserId: verified.claims.external_user_id, installationIds: verified.claims.installation_ids?.map(dePrefixId), permissions: verified.claims.permissions };
                if (!hasClientPermission(embeddedScope, 'sessions:turn')) {
                    return respondError(403, 'Client token lacks sessions:turn permission', 'insufficient_scope');
                }
            } else {
                return respondError(401, "Missing CENCORI_API_KEY", "missing_api_key");
            }
        } else {
            const validation = await validateGatewayRequest(req);
            if (!validation.success) return validation.response;
            if (validation.context.keyType !== 'secret') {
                return respondError(403, "This operation requires a secret project key", "secret_key_required");
            }
            gatewayCtx = validation.context;
        }

        // ── Agent resolution ──
        const adminClient = createAdminClient();
        void expireStaleSessions(adminClient as never).catch((error) => {
            console.error('[Sessions] Opportunistic expiry failed:', error);
        });

        step('auth');
        // Fetch session first
        const { data: session, error: sessionError } = await adminClient
            .from('sessions')
            .select('id, project_id, organization_id, status, last_turn_number, agent_id, metadata, tenant_id, external_user_id, installation_id')
            .eq('id', sessionId)
            .single();

        if (sessionError || !session) {
            return respondError(404, "Session not found", "session_not_found");
        }

        if (denyOnScopeMismatch(session as { project_id: string; tenant_id?: string | null; external_user_id?: string | null; installation_id?: string | null }, (gatewayCtx as GatewayContext).projectId, embeddedScope)) {
            return respondError(404, "Session not found", "session_not_found");
        }

        if (session.status !== 'active') {
            return respondError(409, `Session is ${session.status}, not active`, "session_not_active");
        }

        // Website widget conversations come from anonymous visitors: cap their length and pace.
        // WhatsApp customers get the pace cap; their long conversations roll over to new sessions instead.
        const source = (session.metadata as { source?: string } | null)?.source;
        if (source === 'widget' || source === 'whatsapp') {
            const { checkWidgetTurn } = await import('@/lib/embedded/widget');
            const blocked = await checkWidgetTurn(sessionId, source === 'widget' ? (session.last_turn_number as number | null) ?? 0 : 0);
            if (blocked) return respondError(429, blocked.message, blocked.code);
        }

        step('session');
        const agentResult = await resolveAgentContext({
            supabase: adminClient,
            req,
            gatewayCtx,
            authenticatedProjectId: gatewayCtx.projectId,
            authenticatedUserId: null,
            startedAt,
            agentIdOverride: session.agent_id,
        });

        let agentId: string | null = session.agent_id || null;
        let agentConfig: { model?: string | null; system_prompt?: string | null; tools?: string[] | null } | null = null;

        if (agentResult.ok) {
            agentId = agentResult.agent.agentId;
            agentConfig = agentResult.agent.agentConfig;
            gatewayCtx = agentResult.agent.gatewayCtx;
        } else if (
            agentResult.errorCode === 'agent_not_found'
            // Console-built agents have versions but no legacy agent_configs
            // row; an installed session takes its config from the published
            // version below, which also checks the agent is active.
            || (agentResult.errorCode === 'agent_config_not_found' && (session as { installation_id?: string | null }).installation_id)
        ) {
            // No agent — allowed
        } else if (agentResult.response) {
            return respond(agentResult.response, agentResult.errorCode, agentResult.errorMessage);
        }

        // M3: attribute usage to tenant/agent/installation/session.
        {
            const s = session as { tenant_id?: string | null; installation_id?: string | null };
            (gatewayCtx as GatewayContext).embedded = {
                tenantId: s.tenant_id ?? embeddedScope?.tenantId ?? null,
                agentId: agentId,
                installationId: s.installation_id ?? embeddedScope?.installationIds?.[0] ?? null,
                sessionId: sessionId,
            };
        }

        step('agent');
        // ── Parse Request Body ──
        let body: TurnRequestBody & { input: ResponsesRequest['input'] };
        try {
            body = await req.json() as TurnRequestBody & { input: ResponsesRequest['input'] };
        } catch {
            return respondError(400, 'Request body is not valid JSON', 'invalid_json');
        }

        // Studio: the owner stepped into this website or link chat. The visitor's
        // message is kept for them and the assistant stays quiet; once it's handed
        // back, the assistant first hears what was said. (WhatsApp does the same in
        // its runner, before it ever calls this route.)
        if ((source === 'widget' || source === 'link') && typeof body.input === 'string' && body.input.trim()) {
            const takeover = await import('@/lib/studio/takeover');
            if (takeover.isOwnerActive(session.metadata as Record<string, unknown> | null)) {
                await takeover.addManualMessage(adminClient as never, sessionId, { from: 'customer', text: body.input.trim().slice(0, 4000) });
                return new Response('event: owner.handling\ndata: {}\n\n', {
                    status: 200,
                    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' },
                });
            }
            // Only when the conversation has something the assistant hasn't seen: no query otherwise.
            const missed = takeover.manualMessages(session.metadata as Record<string, unknown> | null).some((message) => !message.seen)
                ? await takeover.takeUnseenManualMessages(adminClient as never, sessionId).catch(() => null)
                : null;
            if (missed) body.input = `${missed}\n\n${body.input}`;
        }

        // Installed versions override legacy agent_configs: the normalized
        // manifest is the runtime source of truth whenever the session
        // carries an installation — model, instructions, temperature, the
        // tool allowlist, and the (default-deny) browser policy.
        let installedManifest: CapabilityManifest | null = null;
        // The published version's own tools (webhook and system), run by the engine on the server.
        let installedToolset: import('@/lib/embedded/agent-tools').AgentToolset | null = null;
        let effectiveNetworkPolicy: NetworkPolicy | undefined;
        let effectiveBrowserEnabled = false;
        {
            const installationId = (session as { installation_id?: string | null }).installation_id;
            if (installationId) {
                const { data: ins } = await adminClient
                    .from('agent_installations')
                    .select('agent_id, agent_version_id, status, overlay_config')
                    .eq('project_id', (gatewayCtx as GatewayContext).projectId)
                    .eq('id', installationId)
                    .maybeSingle();
                const versionId = (ins as { agent_version_id?: string | null } | null)?.agent_version_id;
                if (!ins || ins.status !== 'active' || !versionId) {
                    return respondError(403, 'Agent installation is not active', 'installation_inactive');
                }
                // Pause is an agent-level flag: a paused agent admits no turns
                // even through an otherwise active installation. The pause check, the
                // published version and the business's payment options are independent,
                // so they're read together rather than one after another.
                const insAgentId = (ins as { agent_id?: string | null } | null)?.agent_id ?? null;
                const [activity, version, takesTransfers] = await Promise.all([
                    insAgentId
                        ? import('@/lib/embedded/agents').then(({ checkAgentActivity }) => checkAgentActivity(adminClient as never, (gatewayCtx as GatewayContext).projectId, insAgentId))
                        : Promise.resolve(null),
                    publishedVersion(adminClient, (gatewayCtx as GatewayContext).projectId, versionId),
                    import('@/lib/embedded/transfers').then(({ takesTransfersCached }) => takesTransfersCached(adminClient as never, session.project_id as string)),
                ]);
                if (activity && 'unavailable' in activity) {
                    return respondError(503, 'Agent pause check unavailable; retry shortly', 'activity_check_unavailable');
                }
                if (activity && !activity.active) {
                    return respondError(403, 'Agent is disabled', 'agent_disabled');
                }
                if (versionId) {
                    if (!version || version.status !== 'published') return respondError(409, 'Installed agent version is unavailable', 'version_unavailable');
                    const config = ((version as { config_json?: Record<string, unknown> } | null)?.config_json ?? {}) as Record<string, unknown>;
                    const { normalizeManifest } = await import('@/lib/embedded/manifest');
                    const manifest = normalizeManifest(config);
                    if (manifest.model?.trim()) {
                        agentConfig = {
                            model: manifest.model,
                            system_prompt: manifest.instructions ?? agentConfig?.system_prompt ?? null,
                            tools: null,
                        };
                        agentId = agentId ?? session.agent_id;
                        const manifestTemp = (config.temperature as number | undefined) ?? undefined;
                        if (typeof manifestTemp === 'number') {
                            (body as { temperature?: number }).temperature = manifestTemp;
                        }
                    } else return respondError(409, 'Installed agent has no published model', 'version_unavailable');
                    installedManifest = manifest;
                    // A business that takes bank transfers (Studio → Money) gets the payment tools without republishing.
                    installedToolset = (await import('@/lib/embedded/agent-tools')).agentToolset(config, { takesTransfers });
                    installedToolset.warm(session.project_id as string);
                    effectiveNetworkPolicy = intersectNetworkPolicy(manifest.policy, (ins as { overlay_config?: unknown }).overlay_config);
                    effectiveBrowserEnabled = intersectBrowserEnabled(manifest.policy, (ins as { overlay_config?: unknown }).overlay_config);
                }
            }
        }

        // Installed manifests are the runtime tool and instruction authority:
        // turn-level tools/instructions would silently change installed behavior,
        // so reject them instead of dropping them. Legacy (non-installed)
        // sessions continue to honor both fields.
        if (installedManifest && ((typeof body.instructions === 'string' && body.instructions.trim().length > 0) || (Array.isArray(body.tools) && body.tools.length > 0))) {
            const fields = [Array.isArray(body.tools) && body.tools.length > 0 ? 'tools' : null, typeof body.instructions === 'string' && body.instructions.trim().length > 0 ? 'instructions' : null].filter(Boolean).join(' and ');
            return respondError(
                400,
                `Turn-level ${fields} are not supported for installed agents: the published agent manifest is the runtime authority for tools and instructions. Update the installed agent version, or remove ${fields} from the turn request.`,
                'unsupported_turn_fields',
            );
        }

        const { BUSINESS_DEFAULT_MODEL } = await import('@/lib/business/plans');
        // Below the Business plan, an agent always answers with the plan's model.
        const lockedModel = gatewayCtx?.businessModelLocked ? BUSINESS_DEFAULT_MODEL : null;
        if (!lockedModel && !body.model && !agentConfig?.model && !gatewayCtx?.defaultModel) {
            return respondError(400, "Missing model. Provide model in request body or set a default model in project settings.", 'missing_model');
        }
        const configuredModel = lockedModel || agentConfig?.model || body.model || gatewayCtx?.defaultModel || '';
        const model = normalizeGatewayModelId(configuredModel.trim());

        const input = body.input;
        // Installed agents get today's date: they look things up by date through their tools.
        const instructions = installedManifest
            ? [installedManifest.instructions ?? '', (await import('@/lib/embedded/agent-tools')).agentClock()].filter(Boolean).join('\n\n')
            : (agentConfig?.system_prompt || body.instructions);

        if (!input || (Array.isArray(input) && input.length === 0)) {
            return respondError(400, "Missing input. Provide a string or array of input items.", 'missing_input');
        }

        step('installation');
        // ── End-User Billing ──
        const endUserId = body.user?.trim() || null;
        let endUserQuota: QuotaCheckResult | null = null;

        if (gatewayCtx?.endUserBillingEnabled && endUserId) {
            endUserQuota = await checkEndUserQuota(
                gatewayCtx.projectId,
                endUserId,
                model,
                gatewayCtx.environment,
            );

            const modelNotAllowed =
                endUserQuota.reason?.startsWith('model_not_allowed:')
                || Boolean(
                    endUserQuota.allowedModels
                    && endUserQuota.allowedModels.length > 0
                    && !endUserQuota.allowedModels.includes(model)
                );

            if (modelNotAllowed) {
                return respondError(
                    403,
                    `Model "${model}" is not allowed for this end-user's rate plan`,
                    'end_user_model_not_allowed',
                );
            }

            if (!endUserQuota.allowed) {
                const retryAfter = endUserQuota.retryAfterSeconds;
                const headers: Record<string, string> = {};
                if (retryAfter != null) {
                    headers['Retry-After'] = String(retryAfter);
                }
                const body = {
                    error: {
                        message: `End-user quota exceeded: ${endUserQuota.reason || 'limit reached'}`,
                        type: 'invalid_request_error' as const,
                        code: 'end_user_quota_exceeded',
                    },
                    status: 'failed' as const,
                };
                return respond(NextResponse.json(body, { status: 429, headers }));
            }
        }

        const maybeRecordEndUserUsage = (usageAndCost: {
            promptTokens: number; completionTokens: number; totalTokens: number;
            providerCostUsd: number; cencoriChargeUsd: number; markupPercentage: number;
        }) => {
            if (gatewayCtx?.endUserBillingEnabled && endUserId && endUserQuota) {
                recordEndUserUsage({
                    projectId: gatewayCtx.projectId,
                    externalUserId: endUserId,
                    environment: gatewayCtx.environment,
                    tokens: { prompt: usageAndCost.promptTokens, completion: usageAndCost.completionTokens, total: usageAndCost.totalTokens },
                    cost: { providerUsd: usageAndCost.providerCostUsd, cencoriChargeUsd: usageAndCost.cencoriChargeUsd },
                    customerMarkupPercentage: endUserQuota.markupPercentage,
                    flatRatePerRequest: endUserQuota.flatRatePerRequest,
                    currency: endUserQuota.currency,
                    pricingModel: endUserQuota.pricingModel,
                    pricingTiers: endUserQuota.pricingTiers,
                    monthlyTokensUsed: endUserQuota.monthlyTokensUsed,
                    platformCommissionPercentage: endUserQuota.platformCommissionPercentage,
                });
            }
        };

        if (!gatewayCtx) return respondError(500, "Gateway context missing", "gateway_context_missing");

        const activeGatewayCtx = gatewayCtx;

        // Spend gate: turns are metered work like runs. On breach the scope
        // pauses (unless the budget asks for alert-only) and the turn is refused.
        {
            const scoped = session as { tenant_id?: string | null; installation_id?: string | null };
            const { enforceSpendGate } = await import('@/lib/embedded/budgets');
            const turnBudget = await enforceSpendGate(adminClient as never, {
                projectId: activeGatewayCtx.projectId,
                tenantId: scoped.tenant_id ?? null,
                installationId: scoped.installation_id ?? null,
                agentId,
            });
            if (!turnBudget.ok) {
                return respondError(turnBudget.status, turnBudget.message, turnBudget.code);
            }
        }

        // ── Convert input to unified messages for security pipeline ──
        // Shared translator: same shapes as /v1/responses (full tool_calls,
        // reasoning echo, contiguous tool blocks). Drops warn, never vanish.
        const translatedTurnInput = translateResponsesInputItems(
            (input ?? []) as TranslatableInputItem[] | string,
        );
        if (translatedTurnInput.dropped.length > 0) {
            console.warn('[Gateway/Sessions] Translator dropped input items before dispatch', {
                dropped: translatedTurnInput.dropped,
            });
        }
        const inputMessages: UnifiedMessage[] = translatedTurnInput.messages;

        // ── Memory directive (API opt-in: presence of `memory` enables it) ──
        // Mirrors the chat-completions door so a session turn can recall
        // user-scoped facts and persist new ones — the same memory that
        // powers /v1/chat/completions, now on the Sessions (and Arcie) path.
        let memoryDirective: MemoryDirective | null = null;
        step('quota_budget');
        let memorySettings: MemorySettings | null = null;

        if (body.memory !== undefined) {
            memorySettings = await getProjectMemorySettings(adminClient, activeGatewayCtx.projectId);
            if (!memorySettings.enabled) {
                return respondError(403, "Memory is disabled for this project.", "memory_disabled");
            }
            const parsedDirective = parseMemoryDirective(body.memory);
            if (!parsedDirective.ok) {
                return respondError(400, parsedDirective.error, "invalid_memory_directive");
            }
            memoryDirective = normalizeDirectiveScope(parsedDirective.directive, activeGatewayCtx.organizationId);
        }

        // Retrieval runs in parallel with the input pipeline; fail-open ([]).
        const lastUserMessageText =
            [...inputMessages].reverse().find((m) => m.role === "user")?.content ?? "";
        const memoryPromise: Promise<RetrievedMemory[]> =
            memoryDirective?.retrieve
                ? retrieveMemories({
                    supabase: adminClient,
                    organizationId: activeGatewayCtx.organizationId,
                    projectId: activeGatewayCtx.projectId,
                    directive: memoryDirective,
                    queryText: lastUserMessageText,
                    tier: (activeGatewayCtx.tier || "free") as SubscriptionTier,
                    settings: memorySettings ?? undefined,
                    onEmbeddingUsage: usage => {
                        waitUntil(Promise.all([
                            logGatewayRequest(activeGatewayCtx, {
                                endpoint: "memory/search",
                                model: usage.model,
                                provider: usage.provider,
                                status: "success",
                                promptTokens: usage.totalTokens,
                                completionTokens: 0,
                                totalTokens: usage.totalTokens,
                                costUsd: usage.cencoriChargeUsd,
                                providerCostUsd: usage.providerCostUsd,
                                cencoriChargeUsd: usage.cencoriChargeUsd,
                                markupPercentage: usage.markupPercentage,
                                metadata: { source: "session_memory_retrieval" },
                                requestPayload: promptPayload(lastUserMessageText, { model: usage.model }),
                            }),
                            incrementUsage(activeGatewayCtx, usage.cencoriChargeUsd),
                        ]).then(() => undefined));
                    },
                })
                : Promise.resolve([]);

        step('memory_setup');
        const inputPipeline = await runGatewayInputPipeline({
            supabase: adminClient,
            projectId: gatewayCtx.projectId,
            apiKeyId: gatewayCtx.apiKeyId,
            environment: gatewayCtx.environment,
            tier: (gatewayCtx.tier || "free") as SubscriptionTier,
            messages: inputMessages,
            endUserId,
        });

        if (!inputPipeline.ok) {
            const errorBody = inputPipeline.assistantMessage
                ? { ...toOpenAiErrorBody(inputPipeline), message: inputPipeline.assistantMessage, ...(inputPipeline.reasons ? { reasons: inputPipeline.reasons } : {}), ...(inputPipeline.matched_rules ? { matched_rules: inputPipeline.matched_rules } : {}) }
                : toOpenAiErrorBody(inputPipeline);
            return respond(NextResponse.json(errorBody, { status: inputPipeline.status }), inputPipeline.code, inputPipeline.message);
        }

        // ── Memory injection ──
        // Stored facts were redacted at write time; insert them as a system
        // block ahead of the current turn's input (after any leading system
        // messages) so the engine positions them right before the user turn.
        step('input_pipeline');
        const guardedInput = inputPipeline.messages;

        // Knowledge only needs the (masked) input, so its embedding and search
        // run while the remaining checks do. Fail-open: no knowledge, no block.
        const knowledgePromise = (session as { installation_id?: string | null }).installation_id || agentId
            ? import('@/lib/embedded/turn-knowledge').then(({ retrieveTurnKnowledge }) => retrieveTurnKnowledge(adminClient as never, {
                projectId: (gatewayCtx as GatewayContext).projectId,
                organizationId: (gatewayCtx as GatewayContext).organizationId,
                installationId: (session as { installation_id?: string | null }).installation_id ?? null,
                agentId,
                queryText: inputPipeline.inputText,
            })).catch(() => null)
            : Promise.resolve(null);
        const retrievedMemories = await memoryPromise;
        step('memory_wait');
        if (retrievedMemories.length > 0) {
            const memoryMessage: UnifiedMessage = {
                role: "system",
                content: buildMemoryBlock(retrievedMemories, memoryDirective?.mode ?? "inject"),
            };
            let insertAt = 0;
            while (insertAt < guardedInput.length && guardedInput[insertAt].role === "system") {
                insertAt++;
            }
            guardedInput.splice(insertAt, 0, memoryMessage);
        }

        // ── Memory writeback (async — runs after the turn completes) ──
        const scheduleMemoryWriteback = (assistantText: string) => {
            if (memoryDirective?.write && memorySettings && assistantText) {
                const directive = memoryDirective;
                const settings = memorySettings;
                waitUntil(
                    runChatMemoryWriteback({
                        supabase: adminClient,
                        gatewayCtx: activeGatewayCtx,
                        directive,
                        settings,
                        userText: inputPipeline.inputText,
                        assistantText,
                    })
                );
            }
        };

        // Tool authority: the installed manifest constructs the available
        // tools. Request-supplied and legacy definitions are ignored for an
        // installation, so a caller cannot introduce a new tool or schema.
        // Without an installation, legacy agent-config merging applies.
        // Manifest MCP grants resolve against stored discovery snapshots.
        let mcpSnapshots: Map<string, import('@/lib/embedded/mcp').DiscoveredTool[]> | null = null;
        if (installedManifest && installedManifest.mcp_tools.length > 0) {
            try {
                const { loadMcpSnapshots } = await import('@/lib/embedded/mcp');
                const loaded = await loadMcpSnapshots(
                    adminClient as never,
                    (gatewayCtx as GatewayContext).projectId,
                    installedManifest.mcp_tools.map((m) => m.server_id),
                );
                mcpSnapshots = new Map([...loaded].map(([id, snap]) => [id, snap.tools]));
            } catch {
                mcpSnapshots = null;
            }
        }
        // Connector snapshots: imported OpenAPI operations for manifest grants.
        let connectorSnapshots: Map<string, import('@/lib/embedded/connector-ops').ConnectorSnapshot> | null = null;
        if (installedManifest && installedManifest.connection_tools.length > 0) {
            try {
                const { loadConnectorSnapshots } = await import('@/lib/embedded/connector-ops');
                connectorSnapshots = await loadConnectorSnapshots(
                    adminClient as never,
                    (gatewayCtx as GatewayContext).projectId,
                    installedManifest.connection_tools.map((t) => t.connection_id),
                );
            } catch {
                connectorSnapshots = null;
            }
        }
        const tools: ResponsesRequest['tools'] = installedManifest
            ? installedTurnTools(installedManifest, effectiveNetworkPolicy ?? { mode: 'none', allowed_hosts: [] }, effectiveBrowserEnabled, mcpSnapshots, connectorSnapshots)
            : [...(body.tools || [])];
        if (!installedManifest && agentId && agentConfig?.tools && agentConfig.tools.length > 0) {
            const existingTypes = new Set<string>(tools.map(t => t.type));
            for (const toolType of agentConfig.tools) {
                if (!existingTypes.has(toolType)) {
                    tools.push({ type: toolType } as never);
                }
            }
        }

        if (installedManifest && installedToolset && installedToolset.definitions.length > 0) {
            const taken = new Set(tools.map((t) => (t as { function?: { name?: string } }).function?.name).filter(Boolean));
            for (const definition of installedToolset.definitions) {
                if (!taken.has(definition.function.name)) tools.push(definition as never);
            }
        }

        const forcedToolName = typeof body.tool_choice === 'object' && body.tool_choice?.type === 'function' ? body.tool_choice.name : null;
        // (Forced-tool membership is checked after allowlist filtering below,
        // so a declared-but-revoked tool still fails closed.)

        // Installation tool allowlists (discovered ∩ allowed). Default: an empty
        // allowlist allows all function tools. Installations that set
        // overlay_config.strict_tools=true deny every function tool unless an
        // allowlist entry permits it.
        {
            const installationId = (session as { installation_id?: string | null }).installation_id;
            if (installationId) {
                const { data: conns } = await adminClient.from('installation_connections').select('allowed_tools').eq('installation_id', installationId);
                const union = new Set<string>();
                let hasAllowlist = false;
                for (const c of (conns ?? []) as Array<{ allowed_tools?: string[] }>) {
                    const list = Array.isArray(c.allowed_tools) ? c.allowed_tools : [];
                    if (list.length > 0) {
                        hasAllowlist = true;
                        for (const t of list) union.add(t);
                    }
                }
                let strict = false;
                if (!hasAllowlist) {
                    const { data: ins } = await adminClient.from('agent_installations').select('overlay_config').eq('project_id', (gatewayCtx as GatewayContext).projectId).eq('id', installationId).maybeSingle();
                    strict = ((ins as { overlay_config?: { strict_tools?: boolean } } | null)?.overlay_config?.strict_tools) === true;
                }
                if (hasAllowlist || strict) {
                    const filtered = tools.filter((t) => {
                        const tool = t as { type?: string; function?: { name?: string } };
                        if (tool.type !== 'function') return true;
                        return union.has(tool.function?.name ?? '');
                    });
                    tools.length = 0;
                    tools.push(...filtered);
                }
            }
        }

        // Only the agent's tools that survived the installation's allowlist run.
        const offeredNames = new Set(tools.map((t) => (t as { function?: { name?: string } }).function?.name).filter(Boolean));
        const runnableToolset = installedToolset && agentId
            ? { ...installedToolset, has: (name: string) => offeredNames.has(name) && installedToolset!.has(name) }
            : null;

        if (installedManifest && forcedToolName && !tools.some((t) => t.type === 'function' && t.function.name === forcedToolName)) {
            return respondError(403, 'Requested tool is not available on this installation', 'tool_not_allowed');
        }

        step('tools');
        // A website or link conversation counts against the business's plan when its
        // first message goes through, not when the chat window opened it, so a visitor
        // who never says anything (or whose send failed) costs the business nothing.
        if ((source === 'widget' || source === 'link') && (session.last_turn_number ?? 0) === 0
            && !(session.metadata as { preview?: boolean } | null)?.preview && session.organization_id) {
            const { consumeConversation } = await import('@/lib/business/plans');
            const counted = await consumeConversation(adminClient as never, session.organization_id as string);
            if (!counted.ok) {
                return respondError(402, 'This chat isn’t taking new conversations right now. Please contact the business directly.', counted.reason === 'limit' ? 'plan_conversations_used' : 'plan_inactive');
            }
            if (counted.mark) {
                const organizationId = session.organization_id as string;
                const mark = counted.mark;
                after(async () => {
                    const [{ remindOwners }, { getOrganizationPlan }] = await Promise.all([import('@/lib/business/reminders'), import('@/lib/business/plans')]);
                    await remindOwners(adminClient as never, organizationId, await getOrganizationPlan(adminClient as never, organizationId), mark);
                });
            }
        }

        // Reserve a turn only after authentication, validation, quota, memory,
        // and security checks have succeeded. Invalid requests must not burn a
        // turn number or create gaps in replay history.
        const { data: locked, error: lockError } = await adminClient
            .from('sessions')
            .update({ last_turn_number: session.last_turn_number + 1 })
            .eq('id', sessionId)
            .eq('last_turn_number', session.last_turn_number)
            .select('id, last_turn_number')
            .single();

        if (lockError || !locked) {
            if (lockError?.code === 'PGRST116') {
                return respondError(409, 'Concurrent turn detected. Session was already updated by another request.', 'concurrent_turn');
            }
            return respondError(500, lockError?.message || 'Failed to reserve session turn', 'session_lock_failed');
        }

        const newTurnNumber = locked.last_turn_number;

        // ── Agent + installation knowledge, installation skills: best-effort retrieval for citations ──
        let knowledgeContext: { block: string | null; citations: Array<{ chunk_id: string; source_id: string; ord?: number | null; score: number }> } | undefined;
        let skillsBlock: string | null = null;
        {
            step('turn_lock');
            const installationId = (session as { installation_id?: string | null }).installation_id;
            const tenantId = (session as { tenant_id?: string | null }).tenant_id ?? null;
            // The agent's own knowledge applies with or without an installation.
            if (installationId || agentId) {
                try {
                    const { retrieveTurnSkills } = await import('@/lib/embedded/turn-knowledge');
                    const [knowledge, skills] = await Promise.all([
                        knowledgePromise,
                        installationId ? retrieveTurnSkills(adminClient as never, { installationId, tenantId }) : Promise.resolve(null),
                    ]);
                    knowledgeContext = knowledge ?? undefined;
                    skillsBlock = skills?.block ?? null;
                } catch {
                    knowledgeContext = undefined;
                    skillsBlock = null;
                }
            }
        }

        step('knowledge');
        // ── Execute turn ──
        const execResult = await executeSessionTurn({
            supabase: adminClient,
            gatewayCtx: activeGatewayCtx,
            sessionId,
            turnNumber: newTurnNumber,
            model,
            instructions: instructions || undefined,
            tools: tools as ResponsesRequest['tools'],
            agentTools: runnableToolset && agentId ? { toolset: runnableToolset, agentId } : undefined,
            networkPolicy: effectiveNetworkPolicy,
            tool_choice: body.tool_choice,
            temperature: body.temperature,
            max_output_tokens: body.max_output_tokens,
            response_format: body.response_format,
            inputMessages: guardedInput,
            inputText: inputPipeline.inputText,
            inputSecurity: inputPipeline.inputSecurity,
            tokenMap: inputPipeline.tokenMap,
            onCompletion: scheduleMemoryWriteback,
            pauseOnToolCalls: body.pause_on_tool_calls ?? false,
            knowledgeContext,
            skillsBlock: skillsBlock ?? undefined,
            pinnedConnectionId: installedManifest?.provider_connection_id ?? null,
            reasoningEffort: installedManifest && ['low', 'medium', 'high'].includes(installedManifest.reasoning_effort as string)
                ? (installedManifest.reasoning_effort as 'low' | 'medium' | 'high')
                // A customer is waiting: DeepSeek Flash answers without thinking first
                // unless the agent asks for it (thinking roughly doubled time to first word).
                : /^deepseek-v4(\.\d+)?-flash$/.test(model) ? 'none' : undefined,
            endUserId,
            tier: (gatewayCtx.tier || "free") as SubscriptionTier,
            logSuccess: (meta) => {
                // Turns are logged with their prompt and completion (masked by the
                // project's data rules) so the console row is inspectable.
                waitUntil(
                    (async () => {
                        const { loggedMessages, loggedResponse } = await buildMaskedLogPayloads({
                            messages: guardedInput.map((m) => ({
                                role: m.role,
                                content: m.content,
                            })),
                            responseText: meta.responseText ?? '',
                            customRules: inputPipeline.customRules,
                        });

                        await logGatewayRequest(activeGatewayCtx, {
                            endpoint: "/v1/sessions/:id/turns",
                            model: meta.model,
                            provider: meta.provider,
                            status: meta.status,
                            promptTokens: meta.promptTokens,
                            completionTokens: meta.completionTokens,
                            totalTokens: meta.totalTokens,
                            cacheReadTokens: meta.cacheReadTokens,
                            cacheWriteTokens: meta.cacheWriteTokens,
                            uncachedPromptTokens: meta.uncachedPromptTokens,
                            costUsd: meta.cencoriChargeUsd,
                            providerCostUsd: meta.providerCostUsd,
                            cencoriChargeUsd: meta.cencoriChargeUsd,
                            markupPercentage: meta.markupPercentage,
                            endUserId: endUserId || undefined,
                            errorMessage: meta.errorMessage,
                            requestPayload: {
                                messages: loggedMessages,
                                model,
                                stream: true,
                            },
                            responsePayload: meta.responseText !== undefined
                                ? { content: loggedResponse }
                                : undefined,
                        });
                    })().catch((err) =>
                        console.error('[Sessions] turn logging failed:', err)
                    )
                );
            },
            incrementUsage: (chargeUsd) => {
                // waitUntil, not bare void: the wallet debit must survive
                // serverless freeze after the turn stream ends.
                waitUntil(incrementUsage(activeGatewayCtx, chargeUsd));
            },
            recordEndUserUsage: maybeRecordEndUserUsage,
        });

        if (!execResult.ok) {
            return respond(
                NextResponse.json(execResult.body, { status: execResult.status }),
                "session_turn_failed",
                (execResult.body as { error?: { message?: string } }).error?.message || "Turn execution failed",
            );
        }

        step('model_start');
        execResult.response.headers.set('Server-Timing', [...steps.map(([name, ms]) => `${name};dur=${ms}`), `total;dur=${Date.now() - startedAt}`].join(', '));

        if (memoryDirective) {
            execResult.response.headers.set(
                "X-Cencori-Memory-Retrieved",
                String(retrievedMemories.length),
            );
            execResult.response.headers.set(
                "X-Cencori-Memory-Write",
                memoryDirective.write ? "async" : "disabled",
            );
            if (memoryDirective.write) {
                execResult.response.headers.set(
                    "X-Cencori-Memory-Write-Request",
                    activeGatewayCtx.requestId,
                );
            }
        }

        for (const [header, value] of Object.entries(safetyHeaders(buildInputSafetyBlock(inputPipeline)))) {
            execResult.response.headers.set(header, value);
        }

        return respond(execResult.response);

    } catch (error: unknown) {
        console.error("Session Turn Error:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        return respondError(500, message, 'internal_error');
    }
}
