import { NextRequest, NextResponse } from "next/server";
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
import type { ResponseInputItem } from "@/lib/gateway/v1-responses-execute";
import { normalizeResponsesContent, toolOutputTurns } from "@/lib/gateway/responses-content";
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
import {
    buildMemoryBlock,
    getProjectMemorySettings,
    parseMemoryDirective,
    retrieveMemories,
    runChatMemoryWriteback,
    type MemoryDirective,
    type MemorySettings,
    type RetrievedMemory,
} from "@/lib/memory";
import { isLocalMemoryBuild } from "@/lib/memory/availability";

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

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const endpoint = '/v1/sessions/:id/turns';
    const startedAt = Date.now();
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
                gatewayCtx = {
                    supabase: admin as never,
                    projectId: verified.claims.project_id,
                    organizationId: (project.organization_id as string) ?? '',
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
        } else if (agentResult.errorCode === 'agent_not_found') {
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

        // ── Parse Request Body ──
        const body = await req.json() as TurnRequestBody & { input: ResponsesRequest['input'] };

        // Installed versions override legacy agent_configs: the normalized
        // manifest (model, instructions, temperature) is the runtime source of
        // truth whenever the session carries an installation.
        let manifestPolicy: { browser?: { enabled?: boolean } } | null = null;
        {
            const installationId = (session as { installation_id?: string | null }).installation_id;
            if (installationId) {
                const { data: ins } = await adminClient
                    .from('agent_installations')
                    .select('agent_version_id, status')
                    .eq('project_id', (gatewayCtx as GatewayContext).projectId)
                    .eq('id', installationId)
                    .maybeSingle();
                const versionId = (ins as { agent_version_id?: string | null } | null)?.agent_version_id;
                if (versionId) {
                    const { data: version } = await adminClient.from('agent_versions').select('config_json').eq('id', versionId).maybeSingle();
                    const config = ((version as { config_json?: Record<string, unknown> } | null)?.config_json ?? {}) as Record<string, unknown>;
                    if (typeof config.model === 'string' && config.model.trim()) {
                        agentConfig = {
                            model: config.model,
                            system_prompt: ((config.instructions ?? config.system_prompt) as string | undefined) ?? agentConfig?.system_prompt ?? null,
                            tools: agentConfig?.tools ?? null,
                        };
                        agentId = agentId ?? session.agent_id;
                        if (typeof config.temperature === 'number') {
                            (body as { temperature?: number }).temperature ??= config.temperature;
                        }
                    }
                    manifestPolicy = (config.policy ?? null) as typeof manifestPolicy;
                }
            }
        }

        if (!body.model && !agentConfig?.model && !gatewayCtx?.defaultModel) {
            return respondError(400, "Missing model. Provide model in request body or set a default model in project settings.", 'missing_model');
        }
        const configuredModel = agentConfig?.model || body.model || gatewayCtx?.defaultModel || '';
        const model = normalizeGatewayModelId(configuredModel.trim());

        const input = body.input;
        const instructions = agentConfig?.system_prompt || body.instructions;

        if (!input || (Array.isArray(input) && input.length === 0)) {
            return respondError(400, "Missing input. Provide a string or array of input items.", 'missing_input');
        }

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

        // ── Convert input to unified messages for security pipeline ──
        const inputMessages: UnifiedMessage[] = typeof input === 'string'
            ? [{ role: 'user' as const, content: input }]
            : (input as ResponseInputItem[]).flatMap(item => {
                if (item.type === 'message') {
                    const { text, images } = normalizeResponsesContent(item.content);
                    return [{
                        role: item.role,
                        content: text,
                        ...(images.length ? { images } : {}),
                    }] as UnifiedMessage[];
                }
                if (item.type === 'function_call') {
                    return [{
                        role: 'assistant',
                        content: '',
                        tool_calls: [{
                            id: item.call_id || item.id,
                            type: 'function' as const,
                            function: { name: item.name, arguments: item.arguments },
                        }],
                    }] as unknown as UnifiedMessage[];
                }
                if (item.type === 'function_call_output') {
                    return toolOutputTurns(item.output, item.call_id) as UnifiedMessage[];
                }
                if (item.type === 'file') {
                    return [{
                        role: 'user',
                        content: `[Attached file: ${item.filename}]\n${item.content}`,
                    }] as UnifiedMessage[];
                }
                return [];
            });

        if (body.memory !== undefined && !isLocalMemoryBuild()) {
            return respondError(400, "The memory parameter is not available.", "unsupported_parameter");
        }

        // ── Memory directive (API opt-in: presence of `memory` enables it) ──
        // Mirrors the chat-completions door so a session turn can recall
        // user-scoped facts and persist new ones — the same memory that
        // powers /v1/chat/completions, now on the Sessions (and Arcie) path.
        let memoryDirective: MemoryDirective | null = null;
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
            memoryDirective = parsedDirective.directive;
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
        const guardedInput = inputPipeline.messages;
        const retrievedMemories = await memoryPromise;
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

        // Inject agent-configured built-in tools into the request
        const tools = [...(body.tools || [])];
        if (agentId && agentConfig?.tools && agentConfig.tools.length > 0) {
            const existingTypes = new Set<string>(tools.map(t => t.type));
            for (const toolType of agentConfig.tools) {
                if (!existingTypes.has(toolType)) {
                    tools.push({ type: toolType } as never);
                }
            }
        }

        // Browser default-deny: without an explicit browser grant in the
        // installed manifest, open-web tools are stripped before execution.
        const browserGranted = (manifestPolicy as { browser?: { enabled?: boolean } } | null)?.browser?.enabled === true;
        if (manifestPolicy && !browserGranted) {
            const before = tools.length;
            const kept = tools.filter((t) => (t as { type?: string }).type !== 'web_search_preview');
            if (kept.length !== before) {
                tools.length = 0;
                tools.push(...kept);
            }
        }

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
                    const { data: ins } = await adminClient.from('agent_installations').select('overlay_config').eq('id', installationId).maybeSingle();
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

        // ── Installation knowledge + skills: best-effort retrieval for citations ──
        let knowledgeContext: { block: string | null; citations: Array<{ chunk_id: string; source_id: string; ord?: number | null; score: number }> } | undefined;
        let skillsBlock: string | null = null;
        {
            const installationId = (session as { installation_id?: string | null }).installation_id;
            const tenantId = (session as { tenant_id?: string | null }).tenant_id ?? null;
            if (installationId) {
                try {
                    const { retrieveTurnKnowledge, retrieveTurnSkills } = await import('@/lib/embedded/turn-knowledge');
                    knowledgeContext = await retrieveTurnKnowledge(adminClient as never, {
                        projectId: (gatewayCtx as GatewayContext).projectId,
                        organizationId: (gatewayCtx as GatewayContext).organizationId,
                        installationId,
                        queryText: inputPipeline.inputText,
                    });
                    skillsBlock = (await retrieveTurnSkills(adminClient as never, { installationId, tenantId })).block;
                } catch {
                    knowledgeContext = undefined;
                    skillsBlock = null;
                }
            }
        }

        // ── Execute turn ──
        const execResult = await executeSessionTurn({
            supabase: adminClient,
            gatewayCtx: activeGatewayCtx,
            sessionId,
            turnNumber: newTurnNumber,
            model,
            instructions: instructions || undefined,
            tools: tools as ResponsesRequest['tools'],
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
                void incrementUsage(activeGatewayCtx, chargeUsd);
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

        if (memoryDirective) {
            execResult.response.headers.set(
                "X-Cencori-Memory-Retrieved",
                String(retrievedMemories.length),
            );
            execResult.response.headers.set(
                "X-Cencori-Memory-Write",
                memoryDirective.write ? "async" : "disabled",
            );
        }

        return respond(execResult.response);

    } catch (error: unknown) {
        console.error("Session Turn Error:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        return respondError(500, message, 'internal_error');
    }
}
