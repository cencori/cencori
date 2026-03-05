import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { detectProviderFromModel } from "@/lib/providers/config";
import { OPENAI_COMPATIBLE_ENDPOINTS, OpenAICompatibleProvider } from "@/lib/providers/openai-compatible";
import { AnthropicProvider } from "@/lib/providers/anthropic";
import { CohereProvider } from "@/lib/providers/cohere";
import { OpenAIProvider } from "@/lib/providers/openai";
import { GeminiProvider } from "@/lib/providers/gemini";
import { getGoogleApiKey } from "@/lib/providers/google-env";
import { resolveCustomProviderForProject } from "@/lib/providers/custom-provider-routing";
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
import type { AIProvider } from "@/lib/providers/base";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type ToolCallPayload = {
    tool_call_id: string;
    tool: string;
    arguments: string;
};
type ChatMessage = {
    role: "system" | "user" | "assistant" | "tool" | string;
    content: unknown;
};
type UnifiedMessage = {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    toolCallId?: string;
};
type ChatRequestBody = {
    model?: string;
    messages?: ChatMessage[];
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
    tool_choice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
    stream?: boolean;
};

type UsageAndCost = {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    providerCostUsd: number;
    cencoriChargeUsd: number;
    markupPercentage: number;
};

const estimateTokenCount = (text: string): number => {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
};

const stringifyMessageContent = (content: unknown): string => {
    if (typeof content === "string") return content;
    return JSON.stringify(content ?? "");
};

const calculateUsageAndCost = async (
    providerImpl: AIProvider,
    model: string,
    messages: ChatMessage[],
    completionText: string
): Promise<UsageAndCost> => {
    const promptText = messages.map((msg) => stringifyMessageContent(msg.content)).join("\n");

    let promptTokens = 0;
    let completionTokens = 0;
    try {
        promptTokens = await providerImpl.countTokens(promptText, model);
        completionTokens = await providerImpl.countTokens(completionText, model);
    } catch {
        promptTokens = estimateTokenCount(promptText);
        completionTokens = estimateTokenCount(completionText);
    }

    const totalTokens = promptTokens + completionTokens;

    let pricing = {
        inputPer1KTokens: 0,
        outputPer1KTokens: 0,
        cencoriMarkupPercentage: 0,
    };
    try {
        pricing = await providerImpl.getPricing(model);
    } catch {
        // Keep defaults; logging should never block the request.
    }

    const providerCostUsd =
        (promptTokens / 1000) * pricing.inputPer1KTokens
        + (completionTokens / 1000) * pricing.outputPer1KTokens;
    const cencoriChargeUsd = providerCostUsd * (1 + pricing.cencoriMarkupPercentage / 100);

    return {
        promptTokens,
        completionTokens,
        totalTokens,
        providerCostUsd,
        cencoriChargeUsd,
        markupPercentage: pricing.cencoriMarkupPercentage,
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

const extractOpenAIMessageText = (content: unknown): string => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === "string") return part;
                if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
                    return (part as { text: string }).text;
                }
                return "";
            })
            .join("");
    }
    return "";
};

const OPENAI_COMPATIBLE_ENV_KEYS: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    groq: "GROQ_API_KEY",
    mistral: "MISTRAL_API_KEY",
    together: "TOGETHER_API_KEY",
    perplexity: "PERPLEXITY_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    xai: "XAI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    qwen: "QWEN_API_KEY",
    meta: "TOGETHER_API_KEY",
    huggingface: "HUGGINGFACE_API_KEY",
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

    const respondError = (status: number, message: string, code = 'invalid_request_error') => {
        return respond(
            NextResponse.json(
                {
                    error: {
                        message,
                        type: 'invalid_request_error',
                        code,
                    },
                },
                { status }
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
            const { data: config, error: configError } = await adminClient
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

            if (configError || !config) {
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

        const toUnifiedMessages = (items: ChatMessage[]): UnifiedMessage[] => {
            return items.map((m) => ({
                role: (m.role === "system" || m.role === "assistant" || m.role === "tool") ? m.role : "user",
                content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
            }));
        };

        // ── Provider Routing ──
        let customProvider: Awaited<ReturnType<typeof resolveCustomProviderForProject>> = null;
        if (gatewayCtx) {
            try {
                customProvider = await resolveCustomProviderForProject({
                    supabase: adminClient,
                    projectId: gatewayCtx.projectId,
                    organizationId: gatewayCtx.organizationId,
                    requestedModel: model,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to resolve custom provider';
                return respondError(500, message, 'custom_provider_resolution_failed');
            }
        }

        const routedModel = customProvider?.upstreamModel || model;
        const provider = customProvider
            ? (customProvider.apiFormat === "anthropic" ? "anthropic" : "openai")
            : (detectProviderFromModel(model) || 'openai');
        const providerLogName = customProvider?.providerTag || provider;

        if (provider === 'google') {
            // ── Gemini Adapter ──
            const geminiKey = getGoogleApiKey();
            if (!geminiKey) {
                return respondError(
                    500,
                    "Provider API key missing for 'google'. Set GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_AI_API_KEY, or GEMINI_API_KEY on the server.",
                    "provider_key_missing"
                );
            }
            const genAI = new GoogleGenerativeAI(geminiKey);
            const geminiModel = genAI.getGenerativeModel({ model: routedModel });

            const systemInstruction = messages.find((m) => m.role === "system")?.content;
            const nonSystemMessages = messages.filter((m) => m.role !== "system");

            const history = nonSystemMessages.slice(0, -1)
                .filter((m) => m.content != null)
                .map((m) => ({
                    role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
                }));

            const lastMsg = nonSystemMessages[nonSystemMessages.length - 1];
            const lastMessage =
                typeof lastMsg?.content === "string" ? lastMsg.content : JSON.stringify(lastMsg?.content ?? "");

            const geminiChatConfig: Parameters<typeof geminiModel.startChat>[0] = { history };
            if (typeof systemInstruction === "string") {
                geminiChatConfig.systemInstruction = systemInstruction;
            }

            const chat = geminiModel.startChat(geminiChatConfig);
            const providerForMetrics = new GeminiProvider(geminiKey);
            if (shouldStream) {
                const result = await chat.sendMessageStream(lastMessage);

                const streamResponse = new ReadableStream({
                    async start(controller) {
                        let fullResponseText = "";
                        try {
                            for await (const chunk of result.stream) {
                                const text = chunk.text();
                                fullResponseText += text;
                                const openaiChunk = {
                                    id: "chatcmpl-" + Math.random().toString(36).substr(2, 9),
                                    object: "chat.completion.chunk",
                                    created: Math.floor(Date.now() / 1000),
                                    model,
                                    choices: [{
                                        index: 0,
                                        delta: { content: text },
                                        finish_reason: null
                                    }]
                                };
                                const sse = `data: ${JSON.stringify(openaiChunk)}\n\n`;
                                controller.enqueue(new TextEncoder().encode(sse));
                            }
                            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                            controller.close();

                            if (gatewayCtx) {
                                const usageAndCost = await calculateUsageAndCost(providerForMetrics, model, messages, fullResponseText);
                                await logGatewayRequest(gatewayCtx, {
                                    endpoint: '/v1/chat/completions',
                                    model,
                                    provider: 'google',
                                    status: 'success',
                                    promptTokens: usageAndCost.promptTokens,
                                    completionTokens: usageAndCost.completionTokens,
                                    totalTokens: usageAndCost.totalTokens,
                                    costUsd: usageAndCost.cencoriChargeUsd,
                                    providerCostUsd: usageAndCost.providerCostUsd,
                                    cencoriChargeUsd: usageAndCost.cencoriChargeUsd,
                                    markupPercentage: usageAndCost.markupPercentage,
                                });
                                await incrementUsage(gatewayCtx);
                            }
                        } catch (error: unknown) {
                            const message = error instanceof Error ? error.message : "Google streaming failed";
                            if (gatewayCtx) {
                                void logGatewayRequest(gatewayCtx, {
                                    endpoint: '/v1/chat/completions',
                                    model,
                                    provider: 'google',
                                    status: 'error',
                                    errorMessage: message,
                                });
                            }
                            controller.error(error);
                        }
                    }
                });

                const response = new NextResponse(streamResponse, {
                    headers: { "Content-Type": "text/event-stream" }
                });
                return respond(response);
            }

            try {
                const result = await chat.sendMessage(lastMessage);
                const completionText = result.response.text();
                const usageAndCost = await calculateUsageAndCost(providerForMetrics, model, messages, completionText);

                if (gatewayCtx) {
                    await logGatewayRequest(gatewayCtx, {
                        endpoint: '/v1/chat/completions',
                        model,
                        provider: 'google',
                        status: 'success',
                        promptTokens: usageAndCost.promptTokens,
                        completionTokens: usageAndCost.completionTokens,
                        totalTokens: usageAndCost.totalTokens,
                        costUsd: usageAndCost.cencoriChargeUsd,
                        providerCostUsd: usageAndCost.providerCostUsd,
                        cencoriChargeUsd: usageAndCost.cencoriChargeUsd,
                        markupPercentage: usageAndCost.markupPercentage,
                    });
                    await incrementUsage(gatewayCtx);
                }

                return respond(NextResponse.json({
                    id: "chatcmpl-" + Math.random().toString(36).slice(2, 11),
                    object: "chat.completion",
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [
                        {
                            index: 0,
                            message: { role: "assistant", content: completionText },
                            finish_reason: "stop",
                        }
                    ],
                    usage: {
                        prompt_tokens: usageAndCost.promptTokens,
                        completion_tokens: usageAndCost.completionTokens,
                        total_tokens: usageAndCost.totalTokens,
                    },
                }));
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Google completion failed";
                if (gatewayCtx) {
                    void logGatewayRequest(gatewayCtx, {
                        endpoint: '/v1/chat/completions',
                        model,
                        provider: 'google',
                        status: 'error',
                        errorMessage: message,
                    });
                }
                return respondError(500, message, 'google_completion_failed');
            }

        } else if (provider === "anthropic" || provider === "cohere") {
            // ── Non-OpenAI Native Adapters (Anthropic/Cohere) ──
            const anthropicApiKey = customProvider?.apiFormat === "anthropic"
                ? (customProvider.apiKey || process.env.ANTHROPIC_API_KEY)
                : process.env.ANTHROPIC_API_KEY;
            if (provider === "anthropic" && !anthropicApiKey) {
                return respondError(
                    500,
                    customProvider?.apiFormat === "anthropic"
                        ? `Custom provider '${customProvider.name}' is missing an API key.`
                        : "Provider API key missing for 'anthropic'. Set ANTHROPIC_API_KEY on the server.",
                    "provider_key_missing"
                );
            }
            const providerImpl = provider === "anthropic"
                ? new AnthropicProvider(
                    anthropicApiKey,
                    customProvider?.apiFormat === "anthropic" ? { baseURL: customProvider.baseUrl } : undefined
                )
                : new CohereProvider(process.env.COHERE_API_KEY || "");
            const unifiedMessages = toUnifiedMessages(messages);

            if (shouldStream) {
                const streamResponse = new ReadableStream({
                    async start(controller) {
                        let fullResponseText = "";
                        try {
                            const stream = providerImpl.stream({
                                model: routedModel,
                                messages: unifiedMessages,
                            });

                            for await (const chunk of stream) {
                                if (chunk.delta) {
                                    fullResponseText += chunk.delta;
                                    const openaiChunk = {
                                        id: "chatcmpl-" + Math.random().toString(36).substr(2, 9),
                                        object: "chat.completion.chunk",
                                        created: Math.floor(Date.now() / 1000),
                                        model,
                                        choices: [{
                                            index: 0,
                                            delta: { content: chunk.delta },
                                            finish_reason: chunk.finishReason || null
                                        }]
                                    };
                                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                                }
                            }

                            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                            controller.close();

                            if (gatewayCtx) {
                                const usageAndCost = await calculateUsageAndCost(providerImpl, routedModel, messages, fullResponseText);
                                await logGatewayRequest(gatewayCtx, {
                                    endpoint: '/v1/chat/completions',
                                    model,
                                    provider: providerLogName,
                                    status: 'success',
                                    promptTokens: usageAndCost.promptTokens,
                                    completionTokens: usageAndCost.completionTokens,
                                    totalTokens: usageAndCost.totalTokens,
                                    costUsd: usageAndCost.cencoriChargeUsd,
                                    providerCostUsd: usageAndCost.providerCostUsd,
                                    cencoriChargeUsd: usageAndCost.cencoriChargeUsd,
                                    markupPercentage: usageAndCost.markupPercentage,
                                });
                                await incrementUsage(gatewayCtx);
                            }
                        } catch (error: unknown) {
                            console.error(`[Gateway] ${provider} streaming error:`, error);
                            if (gatewayCtx) {
                                void logGatewayRequest(gatewayCtx, {
                                    endpoint: '/v1/chat/completions',
                                    model,
                                    provider: providerLogName,
                                    status: 'error',
                                    errorMessage: error instanceof Error ? error.message : `${provider} streaming failed`,
                                });
                            }
                            controller.error(error);
                        }
                    }
                });

                const response = new NextResponse(streamResponse, {
                    headers: { "Content-Type": "text/event-stream" }
                });
                return respond(response);
            }

            try {
                const completion = await providerImpl.chat({
                    model: routedModel,
                    messages: unifiedMessages,
                });
                const openAiToolCalls = completion.toolCalls?.map((tc) => ({
                    id: tc.id,
                    type: tc.type,
                    function: tc.function,
                }));
                const finishReason = completion.finishReason || (openAiToolCalls && openAiToolCalls.length > 0 ? "tool_calls" : "stop");

                if (gatewayCtx) {
                    await logGatewayRequest(gatewayCtx, {
                        endpoint: '/v1/chat/completions',
                        model,
                        provider: providerLogName,
                        status: 'success',
                        promptTokens: completion.usage.promptTokens,
                        completionTokens: completion.usage.completionTokens,
                        totalTokens: completion.usage.totalTokens,
                        costUsd: completion.cost.cencoriChargeUsd,
                        providerCostUsd: completion.cost.providerCostUsd,
                        cencoriChargeUsd: completion.cost.cencoriChargeUsd,
                        markupPercentage: completion.cost.markupPercentage,
                    });
                    await incrementUsage(gatewayCtx);
                }

                return respond(NextResponse.json({
                    id: "chatcmpl-" + Math.random().toString(36).slice(2, 11),
                    object: "chat.completion",
                    created: Math.floor(Date.now() / 1000),
                    model: completion.model || model,
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: "assistant",
                                content: completion.content,
                                ...(openAiToolCalls && openAiToolCalls.length > 0 ? { tool_calls: openAiToolCalls } : {}),
                            },
                            finish_reason: finishReason,
                        }
                    ],
                    usage: {
                        prompt_tokens: completion.usage.promptTokens,
                        completion_tokens: completion.usage.completionTokens,
                        total_tokens: completion.usage.totalTokens,
                    },
                }));
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : `${provider} completion failed`;
                if (gatewayCtx) {
                    void logGatewayRequest(gatewayCtx, {
                        endpoint: '/v1/chat/completions',
                        model,
                        provider: providerLogName,
                        status: 'error',
                        errorMessage: message,
                    });
                }
                return respondError(500, message, `${provider}_completion_failed`);
            }
        } else {
            // ── OpenAI-compatible Path (OpenAI, Groq, Mistral, etc.) ──
            const providerKeyEnv = customProvider ? undefined : OPENAI_COMPATIBLE_ENV_KEYS[provider];
            const providerApiKey = customProvider?.apiKey
                || (providerKeyEnv ? process.env[providerKeyEnv] : undefined)
                || (customProvider ? "cencori-no-key" : undefined);
            if (!providerApiKey) {
                return respondError(
                    500,
                    `Provider API key missing for '${provider}'. Set ${providerKeyEnv || "provider key env"} on the server.`,
                    'provider_key_missing'
                );
            }

            const providerEndpoint = customProvider
                ? { baseURL: customProvider.baseUrl }
                : (provider === "openai" ? null : OPENAI_COMPATIBLE_ENDPOINTS[provider]);
            const openai = new OpenAI({
                apiKey: providerApiKey,
                ...(providerEndpoint ? { baseURL: providerEndpoint.baseURL } : {}),
            });
            const providerForMetrics: AIProvider = customProvider
                ? new OpenAICompatibleProvider(providerLogName, providerApiKey, customProvider.baseUrl)
                : (provider === "openai"
                    ? new OpenAIProvider(providerApiKey)
                    : new OpenAICompatibleProvider(provider, providerApiKey));
            const openAiMessages = messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

            if (shouldStream) {
                const stream = await openai.chat.completions.create({
                    model: routedModel,
                    messages: openAiMessages,
                    stream: true,
                    tools,
                    tool_choice
                });

                // Shadow Mode: collect tool calls during streaming to intercept
                const collectedToolCalls: Record<number, { id: string; type: string; function: { name: string; arguments: string } }> = {};

                const streamResponse = new ReadableStream({
                    async start(controller) {
                        let fullResponseText = "";
                        try {
                            for await (const chunk of stream) {
                                const delta = chunk.choices[0]?.delta;

                                if (delta?.content) {
                                    fullResponseText += delta.content;
                                }

                                // Collect tool calls from stream chunks
                                if (delta?.tool_calls) {
                                    for (const tc of delta.tool_calls) {
                                        if (!collectedToolCalls[tc.index]) {
                                            collectedToolCalls[tc.index] = {
                                                id: tc.id || "",
                                                type: tc.type || "function",
                                                function: { name: "", arguments: "" }
                                            };
                                        }
                                        const existing = collectedToolCalls[tc.index];
                                        if (tc.id) existing.id = tc.id;
                                        if (tc.function?.name) existing.function.name += tc.function.name;
                                        if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
                                    }
                                }

                                // Forward the chunk as-is (agent client sees the tool_calls)
                                const text = `data: ${JSON.stringify(chunk)}\n\n`;
                                controller.enqueue(new TextEncoder().encode(text));
                            }

                            // ── Shadow Mode Intercept ──
                            // After the stream ends, if shadow_mode is ON and there were tool calls,
                            // insert them as pending and send a custom event telling the agent to wait.
                            const toolCallValues = Object.values(collectedToolCalls);

                            if (shadowMode && agentId && toolCallValues.length > 0) {
                                const pendingActionIds: string[] = [];

                                for (const tc of toolCallValues) {
                                    const actionId = await createPendingAction(adminClient, agentId, {
                                        tool_call_id: tc.id,
                                        tool: tc.function.name,
                                        arguments: tc.function.arguments,
                                    });
                                    if (actionId) pendingActionIds.push(actionId);
                                }

                                // Custom SSE event: tells the agent client to HOLD execution
                                // and poll /api/v1/agent/actions/poll for approval
                                if (pendingActionIds.length > 0) {
                                    const shadowEvent = {
                                        type: "shadow_approval_required",
                                        agent_id: agentId,
                                        pending_action_ids: pendingActionIds,
                                        message: "Tool calls require approval. Poll /api/v1/agent/actions/poll to check status.",
                                        poll_url: `/api/v1/agent/actions/poll?ids=${pendingActionIds.join(",")}`,
                                    };
                                    const sse = `event: shadow_mode\ndata: ${JSON.stringify(shadowEvent)}\n\n`;
                                    controller.enqueue(new TextEncoder().encode(sse));
                                }
                            } else if (!shadowMode && agentId && toolCallValues.length > 0) {
                                // Shadow mode OFF: log as executed (fire-and-forget)
                                for (const tc of toolCallValues) {
                                    createExecutedAction(adminClient, agentId, {
                                        tool_call_id: tc.id,
                                        tool: tc.function.name,
                                        arguments: tc.function.arguments,
                                    }).catch(console.error);
                                }
                            }

                            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                            controller.close();

                            // Usage tracking
                            if (gatewayCtx) {
                                const usageAndCost = await calculateUsageAndCost(providerForMetrics, routedModel, messages, fullResponseText);
                                await logGatewayRequest(gatewayCtx, {
                                    endpoint: '/v1/chat/completions',
                                    model,
                                    provider: providerLogName,
                                    status: 'success',
                                    promptTokens: usageAndCost.promptTokens,
                                    completionTokens: usageAndCost.completionTokens,
                                    totalTokens: usageAndCost.totalTokens,
                                    costUsd: usageAndCost.cencoriChargeUsd,
                                    providerCostUsd: usageAndCost.providerCostUsd,
                                    cencoriChargeUsd: usageAndCost.cencoriChargeUsd,
                                    markupPercentage: usageAndCost.markupPercentage,
                                });
                                await incrementUsage(gatewayCtx);
                            }
                        } catch (error: unknown) {
                            if (gatewayCtx) {
                                void logGatewayRequest(gatewayCtx, {
                                    endpoint: '/v1/chat/completions',
                                    model,
                                    provider: providerLogName,
                                    status: 'error',
                                    errorMessage: error instanceof Error ? error.message : 'OpenAI-compatible streaming failed',
                                });
                            }
                            controller.error(error);
                        }
                    }
                });

                const nextResponse = new NextResponse(streamResponse, {
                    headers: { "Content-Type": "text/event-stream" }
                });
                return respond(nextResponse);
            }

            try {
                const completion = await openai.chat.completions.create({
                    model: routedModel,
                    messages: openAiMessages,
                    stream: false,
                    tools,
                    tool_choice
                });
                const messageToolCalls = completion.choices[0]?.message?.tool_calls || [];

                if (agentId && messageToolCalls.length > 0) {
                    const normalizedToolCalls = messageToolCalls.flatMap((tc, index) => {
                        if (tc.type !== "function") {
                            return [];
                        }
                        return [{
                            id: tc.id || `tool-call-${index}`,
                            function: {
                                name: tc.function.name || "unknown_tool",
                                arguments: tc.function.arguments || "{}",
                            },
                        }];
                    });

                    if (shadowMode) {
                        for (const tc of normalizedToolCalls) {
                            await createPendingAction(adminClient, agentId, {
                                tool_call_id: tc.id,
                                tool: tc.function.name,
                                arguments: tc.function.arguments,
                            });
                        }
                    } else {
                        for (const tc of normalizedToolCalls) {
                            createExecutedAction(adminClient, agentId, {
                                tool_call_id: tc.id,
                                tool: tc.function.name,
                                arguments: tc.function.arguments,
                            }).catch(console.error);
                        }
                    }
                }

                const completionText = extractOpenAIMessageText(completion.choices[0]?.message?.content ?? "");
                let usageAndCost: UsageAndCost;
                if (completion.usage) {
                    let pricing = {
                        inputPer1KTokens: 0,
                        outputPer1KTokens: 0,
                        cencoriMarkupPercentage: 0,
                    };
                    try {
                        pricing = await providerForMetrics.getPricing(routedModel);
                    } catch {
                        // Keep defaults; logging should never block request handling.
                    }

                    const promptTokens = completion.usage.prompt_tokens || 0;
                    const completionTokens = completion.usage.completion_tokens || 0;
                    const totalTokens = completion.usage.total_tokens || (promptTokens + completionTokens);
                    const providerCostUsd =
                        (promptTokens / 1000) * pricing.inputPer1KTokens
                        + (completionTokens / 1000) * pricing.outputPer1KTokens;
                    const cencoriChargeUsd = providerCostUsd * (1 + pricing.cencoriMarkupPercentage / 100);

                    usageAndCost = {
                        promptTokens,
                        completionTokens,
                        totalTokens,
                        providerCostUsd,
                        cencoriChargeUsd,
                        markupPercentage: pricing.cencoriMarkupPercentage,
                    };
                } else {
                    usageAndCost = await calculateUsageAndCost(providerForMetrics, routedModel, messages, completionText);
                }

                if (gatewayCtx) {
                    await logGatewayRequest(gatewayCtx, {
                        endpoint: '/v1/chat/completions',
                        model,
                        provider: providerLogName,
                        status: 'success',
                        promptTokens: usageAndCost.promptTokens,
                        completionTokens: usageAndCost.completionTokens,
                        totalTokens: usageAndCost.totalTokens,
                        costUsd: usageAndCost.cencoriChargeUsd,
                        providerCostUsd: usageAndCost.providerCostUsd,
                        cencoriChargeUsd: usageAndCost.cencoriChargeUsd,
                        markupPercentage: usageAndCost.markupPercentage,
                    });
                    await incrementUsage(gatewayCtx);
                }

                return respond(NextResponse.json(completion));
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'OpenAI-compatible completion failed';
                if (gatewayCtx) {
                    void logGatewayRequest(gatewayCtx, {
                        endpoint: '/v1/chat/completions',
                        model,
                        provider: providerLogName,
                        status: 'error',
                        errorMessage: message,
                    });
                }
                return respondError(500, message, 'openai_compatible_completion_failed');
            }
        }

    } catch (error: unknown) {
        console.error("Gateway Error:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        return respondError(500, message, 'internal_error');
    }
}
