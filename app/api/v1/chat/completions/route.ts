import { createClient } from "@supabase/supabase-js";
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
import { extractCencoriApiKeyFromHeaders } from "@/lib/api-keys";
import { checkEndUserQuota, recordEndUserUsage, type QuotaCheckResult } from "@/lib/end-user-billing";
import type { Tool, UnifiedChatRequest } from "@/lib/providers/base";
import {
    computeExactCacheKey,
    getProjectCacheConfig,
    lookupCache,
    storeInCache,
    recordCacheHit,
    logCacheEvent,
} from "@/lib/cache/prompt-cache";
import { getCachedCacheConfig, setCachedCacheConfig, getCachedAgentConfig, setCachedAgentConfig } from "@/lib/config-cache";
import type { CacheConfig, CacheLookupResult } from "@/lib/cache/types";
import { resolvePrompt, logPromptUsage } from "@/lib/prompts/registry";
import type { ResolvedPrompt } from "@/lib/prompts/types";
import { runGatewayInputPipeline } from "@/lib/gateway/input-guard";
import { toOpenAiErrorBody } from "@/lib/gateway/guard-types";
import { runV1ProviderExecution } from "@/lib/gateway/v1-execute";
import type { ToolCallPayload } from "@/lib/gateway/v1-types";
import type { SubscriptionTier } from "@/lib/entitlements";
import type { UnifiedMessage } from "@/lib/providers/base";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type ChatMessage = {
    role: "system" | "user" | "assistant" | "tool" | string;
    content: unknown;
};
type ChatRequestBody = {
    model?: string;
    messages?: ChatMessage[];
    tools?: Tool[];
    tool_choice?: UnifiedChatRequest["toolChoice"];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    user?: string;
    prompt?: {
        name: string;
        variables?: Record<string, string>;
    };
};

const normalizeGatewayModelId = (modelId: string): string => {
    // OpenClaw custom provider aliases may send "cencori/<model>".
    // Normalize to the actual upstream model ID used in provider configs.
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

/**
 * Insert a tool call as a pending action for Shadow Mode approval.
 * Returns the action ID for polling.
 */
const createPendingAction = async (
    supabase: SupabaseAdminClient,
    agentId: string,
    toolCall: ToolCallPayload
): Promise<string | null> => {
    try {
        const { data, error } = await supabase.from("agent_actions").insert({
            agent_id: agentId,
            type: "tool_call",
            payload: toolCall,
            status: "pending",
        }).select('id').single();
        if (error) throw error;
        return data?.id || null;
    } catch (e) {
        console.error("Failed to create pending action", e);
        return null;
    }
};

/**
 * Insert a tool call as an already-executed action (shadow mode OFF).
 */
const createExecutedAction = async (
    supabase: SupabaseAdminClient,
    agentId: string,
    toolCall: ToolCallPayload
) => {
    try {
        await supabase.from("agent_actions").insert({
            agent_id: agentId,
            type: "tool_call",
            payload: toolCall,
            status: "executed",
        });
    } catch (e) {
        console.error("Failed to log action", e);
    }
};

// ── CORS Preflight ──
export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function POST(req: NextRequest) {
    const endpoint = '/v1/chat/completions';
    const startedAt = Date.now();
    const callerIdentity = extractGatewayCallerIdentity(req.headers);
    let gatewayCtx: GatewayContext | null = null;

    const respond = (response: NextResponse, errorCode?: string, errorMessage?: string) => {
        if (!gatewayCtx) {
            return response;
        }

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

    const respondError = (
        status: number,
        message: string,
        code = 'invalid_request_error',
        headers?: HeadersInit
    ) => {
        return respond(
            NextResponse.json(
                {
                    error: {
                        message,
                        type: 'invalid_request_error',
                        code,
                    },
                },
                { status, headers }
            ),
            code,
            message
        );
    };

    try {
        const authHeader = req.headers.get("Authorization");
        const providedApiKey = extractCencoriApiKeyFromHeaders(req.headers);

        // Determine auth mode: API key (production agents) vs user token (dashboard testing)
        const isApiKeyAuth = !!providedApiKey;

        let authenticatedProjectId: string | null = null;
        let authenticatedUserId: string | null = null;

        if (isApiKeyAuth) {
            // ── Production Path: Full gateway validation (rate limit, spend cap, auth) ──
            const validation = await validateGatewayRequest(req);
            if (!validation.success) {
                return validation.response;
            }
            gatewayCtx = validation.context;
            authenticatedProjectId = gatewayCtx.projectId;
        } else if (authHeader) {
            // ── Dashboard Path: User token auth (for testing from UI) ──
            const userClient = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { Authorization: authHeader } },
            });
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            if (authError || !user) {
                return respondError(401, "Unauthorized", "unauthorized");
            }
            authenticatedUserId = user.id;
        } else {
            return respondError(401, "Missing Authorization", "missing_authorization");
        }

        // ── Agent resolution (optional for API key requests) ──
        const adminClient = createAdminClient();
        let agentId = req.headers.get("X-Agent-ID");
        let shadowMode = false;
        let agentConfig: { model?: string | null; system_prompt?: string | null } | null = null;

        if (!agentId && gatewayCtx) {
            // Derive agent ID from API key name (format: "Agent {uuid} Key") when available.
            const { data: keyRecord } = await adminClient
                .from("api_keys")
                .select("name")
                .eq("id", gatewayCtx.apiKeyId)
                .single();
            const match = keyRecord?.name?.match(/^Agent\s+(\S+)\s+Key/);
            if (match) agentId = match[1];
        }

        if (agentId) {
            // ── Agent Path: config injection + shadow mode + agent scoping ──
            // Try cache first for performance
            let config = null;
            const cachedAgent = await getCachedAgentConfig(agentId);
            if (cachedAgent) {
                config = cachedAgent.data;
            } else {
                const { data, error } = await adminClient
                    .from("agent_configs")
                    .select(`
                        *,
                        agents!inner (
                            id,
                            project_id,
                            is_active,
                            shadow_mode
                        )
                    `)
                    .eq("agent_id", agentId)
                    .single();
                
                config = data;
                // Cache for next request
                if (config) {
                    await setCachedAgentConfig(agentId, config);
                }
            }

            if (!config) {
                const errResponse = NextResponse.json(
                    { error: "Agent configuration not found. Create the agent in Cencori first." },
                    { status: 404 }
                );
                return respond(errResponse, 'agent_config_not_found', 'Agent configuration not found');
            }

            const agentRecord = config.agents as unknown as {
                id: string;
                project_id: string;
                is_active: boolean;
                shadow_mode: boolean;
            };

            // ── Project Scoping ──
            if (authenticatedProjectId && agentRecord.project_id !== authenticatedProjectId) {
                const errResponse = NextResponse.json(
                    { error: "API key does not have access to this agent" },
                    { status: 403 }
                );
                return respond(errResponse, 'agent_project_scope_denied', 'API key does not have access to this agent');
            }

            // Dashboard JWT path must still be scoped to organizations the user can access.
            if (!authenticatedProjectId && authenticatedUserId) {
                const { data: agentProject, error: projectError } = await adminClient
                    .from("projects")
                    .select(`
                        id,
                        organization_id,
                        organizations!inner(owner_id)
                    `)
                    .eq("id", agentRecord.project_id)
                    .single();

                if (projectError || !agentProject) {
                    return respond(
                        NextResponse.json({ error: "Agent project not found" }, { status: 404 }),
                        'agent_project_not_found',
                        'Agent project not found'
                    );
                }

                const ownerId = (agentProject.organizations as { owner_id?: string } | null)?.owner_id || null;

                let hasOrgAccess = ownerId === authenticatedUserId;
                if (!hasOrgAccess) {
                    const { data: member, error: memberError } = await adminClient
                        .from('organization_members')
                        .select('id')
                        .eq('organization_id', agentProject.organization_id)
                        .eq('user_id', authenticatedUserId)
                        .single();
                    hasOrgAccess = !memberError && !!member;
                }

                if (!hasOrgAccess) {
                    return respond(
                        NextResponse.json({ error: "Unauthorized for this agent" }, { status: 403 }),
                        'agent_org_scope_denied',
                        'User is not authorized for this agent project'
                    );
                }

                // Synthesize gatewayCtx for dashboard requests so gateway logs are written.
                // Resolve the project's first active API key for attribution.
                const { data: dashboardKey } = await adminClient
                    .from('api_keys')
                    .select('id, environment')
                    .eq('project_id', agentRecord.project_id)
                    .is('revoked_at', null)
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .single();

                if (dashboardKey) {
                    gatewayCtx = {
                        supabase: adminClient,
                        projectId: agentRecord.project_id,
                        organizationId: agentProject.organization_id,
                        apiKeyId: dashboardKey.id,
                        environment: dashboardKey.environment || 'production',
                        keyType: 'dashboard',
                        tier: 'free',
                        requestId: crypto.randomUUID(),
                        startTime: startedAt,
                        clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '',
                        countryCode: req.headers.get('x-vercel-ip-country') || null,
                        projectName: '',
                        defaultModel: null,
                        defaultProvider: null,
                        endUserBillingEnabled: false,
                    };
                }
            }

            // ── Check if agent is active ──
            if (!agentRecord.is_active) {
                const errResponse = NextResponse.json(
                    { error: "Agent is not active. Enable it from the dashboard." },
                    { status: 403 }
                );
                return respond(errResponse, 'agent_inactive', 'Agent is not active');
            }

            shadowMode = agentRecord.shadow_mode;
            agentConfig = {
                model: (config as { model?: string | null }).model ?? null,
                system_prompt: (config as { system_prompt?: string | null }).system_prompt ?? null,
            };
        } else if (!authenticatedProjectId) {
            // Dashboard JWT auth is only supported for agent-scoped testing.
            return respondError(
                400,
                "Missing X-Agent-ID for dashboard token auth. Use an API key for generic OpenAI-compatible requests.",
                'missing_agent_id_dashboard_auth'
            );
        }

        // ── Parse Request Body ──
        const body = await req.json() as ChatRequestBody;
        let messages = body.messages ?? [];
        const { tools, tool_choice } = body;
        const shouldStream = typeof body.stream === "boolean" ? body.stream : Boolean(agentConfig);
        if (messages.length === 0) {
            return respondError(400, "Missing messages", "missing_messages");
        }

        // Resolve model: agent config overrides request model; non-agent mode uses request/default project model.
        const configuredModel = agentConfig?.model || body.model || gatewayCtx?.defaultModel;
        if (typeof configuredModel !== "string" || configuredModel.trim().length === 0) {
            const isAgentMode = !!agentConfig;
            return respondError(
                400,
                isAgentMode
                    ? "No model configured. Set a model in the agent dashboard."
                    : "Missing model. Provide model in request body or set a default model in project settings.",
                'missing_model_configuration'
            );
        }
        const model = normalizeGatewayModelId(configuredModel.trim());

        // Inject system prompt from agent config (agent mode only).
        if (agentConfig?.system_prompt) {
            messages = messages.filter((m) => m.role !== "system");
            messages = [
                { role: "system", content: agentConfig.system_prompt },
                ...messages
            ];
        }

        // ── Prompt Registry resolution (if no agent system_prompt) ──
        let resolvedPrompt: ResolvedPrompt | null = null;
        const promptRef = body.prompt?.name || req.headers.get("X-Cencori-Prompt");
        if (promptRef && gatewayCtx && !agentConfig?.system_prompt) {
            try {
                const varsHeader = req.headers.get("X-Cencori-Prompt-Vars");
                const variables = body.prompt?.variables
                    || (varsHeader ? JSON.parse(varsHeader) : undefined);

                resolvedPrompt = await resolvePrompt(gatewayCtx.projectId, promptRef, variables);
                if (!resolvedPrompt) {
                    return respondError(404, `Prompt "${promptRef}" not found or has no active version`, 'prompt_not_found');
                }

                // Inject as system message
                messages = messages.filter((m) => m.role !== "system");
                messages = [
                    { role: "system", content: resolvedPrompt.content },
                    ...messages,
                ];
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'Prompt resolution failed';
                return respondError(400, msg, 'prompt_resolution_failed');
            }
        }

        const toUnifiedMessages = (items: ChatMessage[]): UnifiedMessage[] => {
            return items.map((m) => ({
                role: (m.role === "system" || m.role === "assistant" || m.role === "tool") ? m.role : "user",
                content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
            }));
        };

        // ── End-User Billing: Quota Check ──
        const endUserId = body.user?.trim() || null;
        let endUserQuota: QuotaCheckResult | null = null;

        if (gatewayCtx?.endUserBillingEnabled && endUserId) {
            endUserQuota = await checkEndUserQuota(
                gatewayCtx.projectId,
                endUserId,
                model,
                gatewayCtx.environment
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
                    'end_user_model_not_allowed'
                );
            }

            if (!endUserQuota.allowed) {
                const retryHeaders = endUserQuota.retryAfterSeconds != null
                    ? { 'Retry-After': String(endUserQuota.retryAfterSeconds) }
                    : undefined;
                return respondError(
                    429,
                    `End-user quota exceeded: ${endUserQuota.reason || 'limit reached'}`,
                    'end_user_quota_exceeded',
                    retryHeaders
                );
            }
        }

        // Helper: record end-user usage after a successful request (fire-and-forget)
        const maybeRecordEndUserUsage = (usageAndCost: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
            providerCostUsd: number;
            cencoriChargeUsd: number;
            markupPercentage: number;
        }) => {
            if (gatewayCtx?.endUserBillingEnabled && endUserId && endUserQuota) {
                recordEndUserUsage({
                    projectId: gatewayCtx.projectId,
                    externalUserId: endUserId,
                    environment: gatewayCtx.environment,
                    tokens: {
                        prompt: usageAndCost.promptTokens,
                        completion: usageAndCost.completionTokens,
                        total: usageAndCost.totalTokens,
                    },
                    cost: {
                        providerUsd: usageAndCost.providerCostUsd,
                        cencoriChargeUsd: usageAndCost.cencoriChargeUsd,
                    },
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

        if (!gatewayCtx) {
            return respondError(500, "Gateway context missing", "gateway_context_missing");
        }

        const activeGatewayCtx = gatewayCtx;

        const pipelineMessages: UnifiedMessage[] = toUnifiedMessages(messages);
        const inputPipeline = await runGatewayInputPipeline({
            supabase: adminClient,
            projectId: gatewayCtx.projectId,
            apiKeyId: gatewayCtx.apiKeyId,
            environment: gatewayCtx.environment,
            tier: (gatewayCtx.tier || "free") as SubscriptionTier,
            messages: pipelineMessages,
            endUserId,
        });

        if (!inputPipeline.ok) {
            const errorBody = inputPipeline.assistantMessage
                ? {
                    ...toOpenAiErrorBody(inputPipeline),
                    message: inputPipeline.assistantMessage,
                    ...(inputPipeline.reasons ? { reasons: inputPipeline.reasons } : {}),
                    ...(inputPipeline.matched_rules ? { matched_rules: inputPipeline.matched_rules } : {}),
                }
                : toOpenAiErrorBody(inputPipeline);
            return respond(
                NextResponse.json(errorBody, { status: inputPipeline.status }),
                inputPipeline.code,
                inputPipeline.message
            );
        }

        const guardedMessages = inputPipeline.messages;
        messages = guardedMessages.map((m) => ({
            role: m.role,
            content: m.content,
        }));

        // ── Prompt Cache Intercept ──
        let cacheConfig: CacheConfig | null = null;
        let cacheResult: CacheLookupResult | null = null;
        let cacheKey: string | null = null;
        let promptTextForCache: string | null = null;

        // Check if user wants to skip cache for this request
        const skipCache = req.headers.get('x-skip-cache')?.toLowerCase() === 'true';

        if (gatewayCtx && !shouldStream && !tools && !skipCache) {
            try {
                // Try cache first - use cached config if available
                const cachedConfig = await getCachedCacheConfig(gatewayCtx.projectId);
                if (cachedConfig) {
                    cacheConfig = cachedConfig.data;
                } else {
                    cacheConfig = await getProjectCacheConfig(gatewayCtx.projectId);
                    // Cache the config for next time
                    await setCachedCacheConfig(gatewayCtx.projectId, cacheConfig);
                }

                if (cacheConfig && cacheConfig.cacheEnabled && !cacheConfig.excludedModels.includes(model)) {
                    const requestTemp = body.temperature ?? 0;

                    if (requestTemp <= cacheConfig.maxCacheableTemperature) {
                        const normalizedMsgs = messages.map(m => ({
                            role: String(m.role),
                            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
                        }));

                        cacheKey = computeExactCacheKey({
                            projectId: gatewayCtx.projectId,
                            environment: gatewayCtx.environment,
                            model,
                            temperature: requestTemp,
                            maxTokens: body.max_tokens,
                            messages: normalizedMsgs,
                        });

                        promptTextForCache = normalizedMsgs.map(m => `${m.role}: ${m.content}`).join('\n');

                        cacheResult = await lookupCache({
                            projectId: gatewayCtx.projectId,
                            environment: gatewayCtx.environment,
                            cacheKey,
                            promptText: promptTextForCache,
                            model,
                            maxTokens: body.max_tokens,
                            config: cacheConfig,
                        });

                        if (cacheResult.hit && cacheResult.response) {
                            // Track hit
                            const estimatedTokens = cacheResult.estimatedTokens || cacheResult.response?.usage?.total_tokens || 0;
                            const estimatedCost = cacheResult.estimatedCostUsd || Number(cacheResult.response?.cost_usd) || 0;
                            if (cacheResult.entryId) {
                                void recordCacheHit(cacheResult.entryId, estimatedTokens, estimatedCost);
                            }
                            void logCacheEvent({
                                projectId: gatewayCtx.projectId,
                                entryId: cacheResult.entryId,
                                eventType: cacheResult.hitType === 'exact' ? 'hit_exact' : 'hit_semantic',
                                model,
                                similarityScore: cacheResult.similarityScore ?? undefined,
                                latencySavedMs: Date.now() - startedAt,
                                tokensSaved: estimatedTokens,
                                costSavedUsd: estimatedCost,
                                requestId: gatewayCtx.requestId,
                                environment: gatewayCtx.environment,
                            });

                            // Log as cached request (zero cost)
                            void logGatewayRequest(activeGatewayCtx, {
                                endpoint: '/v1/chat/completions',
                                model,
                                provider: 'cache',
                                status: 'success',
                                promptTokens: 0,
                                completionTokens: 0,
                                totalTokens: 0,
                                costUsd: 0,
                                providerCostUsd: 0,
                                cencoriChargeUsd: 0,
                                markupPercentage: 0,
                                endUserId: endUserId || undefined,
                            });
                            void incrementUsage(gatewayCtx, 0);

                            const cachedResponse = NextResponse.json(cacheResult.response);
                            cachedResponse.headers.set('X-Cache', cacheResult.hitType === 'exact' ? 'HIT-EXACT' : 'HIT-SEMANTIC');
                            cachedResponse.headers.set('X-Cencori-Cache', cacheResult.hitType === 'exact' ? 'HIT' : 'SEMANTIC-HIT');
                            if (cacheResult.similarityScore) {
                                cachedResponse.headers.set('X-Cache-Similarity', String(cacheResult.similarityScore.toFixed(4)));
                            }
                            return respond(cachedResponse);
                        } else {
                            void logCacheEvent({
                                projectId: gatewayCtx.projectId,
                                entryId: null,
                                eventType: 'miss',
                                model,
                                requestId: gatewayCtx.requestId,
                                environment: gatewayCtx.environment,
                            });
                        }
                    }
                }
            } catch (error) {
                // Cache failures should never block requests
                console.error('[Cache] Intercept failed:', error);
            }
        }

        // Helper: store response in cache after successful non-streaming completion
        const maybeCacheResponse = (responseJson: unknown, tokens: number, costUsd: number) => {
            if (cacheConfig?.cacheEnabled && cacheKey && gatewayCtx && !shouldStream && promptTextForCache) {
                void storeInCache({
                    projectId: gatewayCtx.projectId,
                    cacheKey,
                    promptText: promptTextForCache,
                    model,
                    environment: gatewayCtx.environment,
                    temperature: body.temperature,
                    maxTokens: body.max_tokens,
                    response: responseJson,
                    embedding: cacheResult?.embedding ?? null,
                    ttlSeconds: cacheConfig.ttlSeconds,
                    estimatedTokens: tokens,
                    estimatedCostUsd: costUsd,
                }).then(() => {
                    void logCacheEvent({
                        projectId: gatewayCtx!.projectId,
                        entryId: null,
                        eventType: 'store',
                        model,
                        tokensSaved: tokens,
                        costSavedUsd: costUsd,
                        requestId: gatewayCtx!.requestId,
                        environment: gatewayCtx!.environment,
                    });
                });
            }
        };

        // Helper: log prompt usage after successful completion
        const maybeLogPromptUsage = () => {
            if (resolvedPrompt && gatewayCtx) {
                void logPromptUsage({
                    projectId: gatewayCtx.projectId,
                    promptId: resolvedPrompt.promptId,
                    versionId: resolvedPrompt.versionId,
                    model,
                    apiKeyId: gatewayCtx.apiKeyId ?? undefined,
                    requestId: gatewayCtx.requestId,
                    variablesUsed: body.prompt?.variables || null,
                    latencyMs: Date.now() - startedAt,
                });
            }
        };

        const execResult = await runV1ProviderExecution({
            supabase: adminClient,
            gatewayCtx: activeGatewayCtx,
            model,
            messages: guardedMessages,
            inputText: inputPipeline.inputText,
            inputSecurity: inputPipeline.inputSecurity,
            tokenMap: inputPipeline.tokenMap,
            temperature: body.temperature,
            maxTokens: body.max_tokens,
            stream: shouldStream,
            tools: tools as Tool[] | undefined,
            toolChoice: tool_choice,
            endUserId,
            endUserQuota,
            recordEndUserUsage: maybeRecordEndUserUsage,
            logSuccess: (meta) => {
                void logGatewayRequest(activeGatewayCtx, {
                    endpoint: "/v1/chat/completions",
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
                });
            },
            incrementUsage: (chargeUsd) => {
                void incrementUsage(activeGatewayCtx, chargeUsd);
            },
            agentId,
            shadowMode,
            createPendingAction: agentId
                ? (toolCall) => createPendingAction(adminClient, agentId, toolCall)
                : undefined,
            createExecutedAction: agentId
                ? (toolCall) => {
                    void createExecutedAction(adminClient, agentId, toolCall);
                }
                : undefined,
        });

        if (!execResult.ok) {
            return respond(
                NextResponse.json(execResult.body, { status: execResult.status }),
                "provider_execution_failed",
                (execResult.body as { error?: { message?: string } }).error?.message || "Provider execution failed"
            );
        }

        if (!shouldStream) {
            const responseJson = await execResult.response.json();
            maybeCacheResponse(
                responseJson,
                Number((responseJson as { usage?: { total_tokens?: number } }).usage?.total_tokens ?? 0),
                0
            );
            maybeLogPromptUsage();
            return respond(NextResponse.json(responseJson));
        }

        maybeLogPromptUsage();
        return respond(execResult.response);

    } catch (error: unknown) {
        console.error("Gateway Error:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        return respondError(500, message, 'internal_error');
    }
}
