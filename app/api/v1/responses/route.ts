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
import type { UnifiedMessage } from "@/lib/providers/base";
import { runGatewayInputPipeline } from "@/lib/gateway/input-guard";
import { toOpenAiErrorBody } from "@/lib/gateway/guard-types";
import { runV1ResponsesExecution } from "@/lib/gateway/v1-responses-execute";
import type { ResponsesRequest } from "@/lib/gateway/v1-responses-execute";
import type { SubscriptionTier } from "@/lib/entitlements";

import type { ToolCallPayload } from '@/lib/gateway/v1-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const createPendingAction = async (
    supabase: ReturnType<typeof createAdminClient>,
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

const createExecutedAction = async (
    supabase: ReturnType<typeof createAdminClient>,
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

export async function POST(req: NextRequest) {
    const endpoint = '/v1/responses';
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
                { error: { message, type: 'invalid_request_error', code }, status: 'failed' },
                { status, headers }
            ),
            code,
            message
        );
    };

    try {
        const authHeader = req.headers.get("Authorization");
        const providedApiKey = extractCencoriApiKeyFromHeaders(req.headers);
        const isApiKeyAuth = !!providedApiKey;

        let authenticatedProjectId: string | null = null;
        let authenticatedUserId: string | null = null;

        if (isApiKeyAuth) {
            const validation = await validateGatewayRequest(req);
            if (!validation.success) {
                return validation.response;
            }
            gatewayCtx = validation.context;
            authenticatedProjectId = gatewayCtx.projectId;
        } else if (authHeader) {
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

        // ── Agent resolution ──
        const adminClient = createAdminClient();
        let agentId = req.headers.get("X-Agent-ID");
        let shadowMode = false;
        let agentConfig: { model?: string | null; system_prompt?: string | null } | null = null;

        if (!agentId && gatewayCtx) {
            const { data: keyRecord } = await adminClient
                .from("api_keys")
                .select("name")
                .eq("id", gatewayCtx.apiKeyId)
                .single();
            const match = keyRecord?.name?.match(/^Agent\s+(\S+)\s+Key/);
            if (match) agentId = match[1];
        }

        if (agentId) {
            const { getCachedAgentConfig, setCachedAgentConfig } = await import('@/lib/config-cache');

            let config = null;
            const cachedAgent = await getCachedAgentConfig(agentId);
            if (cachedAgent) {
                config = cachedAgent.data;
            } else {
                const { data } = await adminClient
                    .from("agent_configs")
                    .select(`*, agents!inner(id, project_id, is_active, shadow_mode)`)
                    .eq("agent_id", agentId)
                    .single();
                config = data;
                if (config) {
                    await setCachedAgentConfig(agentId, config);
                }
            }

            if (!config) {
                return respond(
                    NextResponse.json({ error: "Agent configuration not found. Create the agent in Cencori first." }, { status: 404 }),
                    'agent_config_not_found'
                );
            }

            const agentRecord = config.agents as unknown as { id: string; project_id: string; is_active: boolean; shadow_mode: boolean };
            shadowMode = agentRecord.shadow_mode;

            if (authenticatedProjectId && agentRecord.project_id !== authenticatedProjectId) {
                return respond(NextResponse.json({ error: "API key does not have access to this agent" }, { status: 403 }), 'agent_project_scope_denied');
            }

            if (!authenticatedProjectId && authenticatedUserId) {
                const { data: agentProject, error: projectError } = await adminClient
                    .from("projects")
                    .select(`id, organization_id, organizations!inner(owner_id)`)
                    .eq("id", agentRecord.project_id)
                    .single();

                if (projectError || !agentProject) {
                    return respond(NextResponse.json({ error: "Agent project not found" }, { status: 404 }), 'agent_project_not_found');
                }

                const ownerId = (agentProject.organizations as { owner_id?: string } | null)?.owner_id || null;
                let hasOrgAccess = ownerId === authenticatedUserId;
                if (!hasOrgAccess) {
                    const { data: member } = await adminClient
                        .from('organization_members')
                        .select('id')
                        .eq('organization_id', agentProject.organization_id)
                        .eq('user_id', authenticatedUserId)
                        .single();
                    hasOrgAccess = !!member;
                }

                if (!hasOrgAccess) {
                    return respond(NextResponse.json({ error: "Unauthorized for this agent" }, { status: 403 }), 'agent_org_scope_denied');
                }

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

            if (!agentRecord.is_active) {
                return respond(NextResponse.json({ error: "Agent is not active. Enable it from the dashboard." }, { status: 403 }), 'agent_inactive');
            }

            agentConfig = {
                model: (config as { model?: string | null }).model ?? null,
                system_prompt: (config as { system_prompt?: string | null }).system_prompt ?? null,
            };
        } else if (!authenticatedProjectId) {
            return respondError(400, "Missing X-Agent-ID for dashboard token auth. Use an API key for generic OpenAI-compatible requests.", 'missing_agent_id_dashboard_auth');
        }

        // ── Parse Request Body ──
        const body = await req.json() as ResponsesRequest;

        if (!body.model && !agentConfig?.model && !gatewayCtx?.defaultModel) {
            return respondError(400, "Missing model. Provide model in request body or set a default model in project settings.", 'missing_model');
        }
        const configuredModel = agentConfig?.model || body.model || gatewayCtx?.defaultModel || '';
        const model = normalizeGatewayModelId(configuredModel.trim());

        const input = body.input;
        const instructions = agentConfig?.system_prompt || body.instructions;

        // If agent mode with no input, create a default
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

        if (!gatewayCtx) {
            return respondError(500, "Gateway context missing", "gateway_context_missing");
        }

        const activeGatewayCtx = gatewayCtx;

        // ── Convert input to unified messages for security pipeline ──
        const inputMessages: UnifiedMessage[] = typeof input === 'string'
            ? [{ role: 'user' as const, content: input }]
            : input
                .filter((item): item is { type: 'message'; role: 'user' | 'assistant' | 'system'; content: string } =>
                    item.type === 'message'
                )
                .map(item => ({ role: item.role, content: item.content }));

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

        const execResult = await runV1ResponsesExecution({
            supabase: adminClient,
            gatewayCtx: activeGatewayCtx,
            model,
            messages: inputPipeline.messages,
            body: {
                ...body,
                instructions: instructions || undefined,
            },
            inputText: inputPipeline.inputText,
            inputSecurity: inputPipeline.inputSecurity,
            tokenMap: inputPipeline.tokenMap,
            endUserId,
            endUserQuota,
            tier: (gatewayCtx.tier || "free") as SubscriptionTier,
            recordEndUserUsage: maybeRecordEndUserUsage,
            logSuccess: (meta) => {
                void logGatewayRequest(activeGatewayCtx, {
                    endpoint: "/v1/responses",
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

        return respond(execResult.response);

    } catch (error: unknown) {
        console.error("Responses API Error:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        return respondError(500, message, 'internal_error');
    }
}
