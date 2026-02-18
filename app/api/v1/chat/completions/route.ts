import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { detectProviderFromModel } from "@/lib/providers/config";
import { OPENAI_COMPATIBLE_ENDPOINTS } from "@/lib/providers/openai-compatible";
import { AnthropicProvider } from "@/lib/providers/anthropic";
import { CohereProvider } from "@/lib/providers/cohere";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
    type GatewayContext,
} from "@/lib/gateway-middleware";

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
    try {
        const authHeader = req.headers.get("Authorization");

        // Determine auth mode: API key (production agents) vs user token (dashboard testing)
        const isApiKeyAuth = !!(
            req.headers.get('CENCORI_API_KEY')
            || authHeader?.startsWith('Bearer cake_')
            || authHeader?.startsWith('Bearer cencori_')
            || authHeader?.startsWith('Bearer cen_')
        );

        let gatewayCtx: GatewayContext | null = null;
        let authenticatedProjectId: string | null = null;

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
            if (authError || !user) return new NextResponse("Unauthorized", { status: 401 });
        } else {
            return new NextResponse("Missing Authorization", { status: 401 });
        }

        // ── Agent ID (from header, or derived from API key) ──
        const adminClient = createAdminClient();
        let agentId = req.headers.get("X-Agent-ID");

        if (!agentId && gatewayCtx) {
            // Derive agent ID from the API key's name (format: "Agent {uuid} Key")
            const { data: keyRecord } = await adminClient
                .from("api_keys")
                .select("name")
                .eq("id", gatewayCtx.apiKeyId)
                .single();
            const match = keyRecord?.name?.match(/^Agent\s+(\S+)\s+Key/);
            if (match) agentId = match[1];
        }

        if (!agentId) return new NextResponse("Missing X-Agent-ID header or unable to derive agent from API key", { status: 400 });

        // ── Get Agent Config (join with agents table for project scoping) ──
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
            return gatewayCtx ? addGatewayHeaders(errResponse, { requestId: gatewayCtx.requestId }) : errResponse;
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
            return gatewayCtx ? addGatewayHeaders(errResponse, { requestId: gatewayCtx.requestId }) : errResponse;
        }

        // ── Check if agent is active ──
        if (!agentRecord.is_active) {
            const errResponse = NextResponse.json(
                { error: "Agent is not active. Enable it from the dashboard." },
                { status: 403 }
            );
            return gatewayCtx ? addGatewayHeaders(errResponse, { requestId: gatewayCtx.requestId }) : errResponse;
        }

        const shadowMode = agentRecord.shadow_mode;

        // ── Parse Request Body ──
        const body = await req.json() as ChatRequestBody;
        let messages = body.messages ?? [];
        const { tools, tool_choice } = body;
        if (messages.length === 0) {
            return new NextResponse("Missing messages", { status: 400 });
        }

        // Apply config model — dashboard config overrides client request
        const model = config.model || body.model;
        if (!model) {
            return new NextResponse("No model configured. Set a model in the agent dashboard.", { status: 400 });
        }

        // Inject system prompt from config
        if (config.system_prompt) {
            messages = messages.filter((m) => m.role !== "system");
            messages = [
                { role: "system", content: config.system_prompt },
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
        const provider = detectProviderFromModel(model) || 'openai';

        if (provider === 'google') {
            // ── Gemini Adapter ──
            const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
            const genAI = new GoogleGenerativeAI(geminiKey);
            const geminiModel = genAI.getGenerativeModel({ model });

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

            const result = await chat.sendMessageStream(lastMessage);

            const streamResponse = new ReadableStream({
                async start(controller) {
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
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
                        logGatewayRequest(gatewayCtx, { endpoint: '/v1/chat/completions', model, provider: 'google', status: 'success' }).catch(console.error);
                        incrementUsage(gatewayCtx).catch(console.error);
                    }
                }
            });

            const response = new NextResponse(streamResponse, {
                headers: { "Content-Type": "text/event-stream" }
            });
            return gatewayCtx ? addGatewayHeaders(response, { requestId: gatewayCtx.requestId }) : response;

        } else if (provider === "anthropic" || provider === "cohere") {
            // ── Non-OpenAI Native Adapters (Anthropic/Cohere) ──
            const providerImpl = provider === "anthropic"
                ? new AnthropicProvider(process.env.ANTHROPIC_API_KEY)
                : new CohereProvider(process.env.COHERE_API_KEY || "");

            const streamResponse = new ReadableStream({
                async start(controller) {
                    try {
                        const unifiedMessages = toUnifiedMessages(messages);
                        const stream = providerImpl.stream({
                            model,
                            messages: unifiedMessages,
                        });

                        for await (const chunk of stream) {
                            if (chunk.delta) {
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
                            logGatewayRequest(gatewayCtx, { endpoint: '/v1/chat/completions', model, provider, status: 'success' }).catch(console.error);
                            incrementUsage(gatewayCtx).catch(console.error);
                        }
                    } catch (error: unknown) {
                        console.error(`[Gateway] ${provider} streaming error:`, error);
                        controller.error(error);
                    }
                }
            });

            const response = new NextResponse(streamResponse, {
                headers: { "Content-Type": "text/event-stream" }
            });
            return gatewayCtx ? addGatewayHeaders(response, { requestId: gatewayCtx.requestId }) : response;
        } else {
            // ── OpenAI-compatible Path (OpenAI, Groq, Mistral, etc.) ──
            const providerKeyEnv = OPENAI_COMPATIBLE_ENV_KEYS[provider];
            const providerApiKey = providerKeyEnv ? process.env[providerKeyEnv] : undefined;
            if (!providerApiKey) {
                return NextResponse.json(
                    { error: `Provider API key missing for '${provider}'. Set ${providerKeyEnv || "provider key env"} on the server.` },
                    { status: 500 }
                );
            }

            const providerEndpoint = provider === "openai" ? null : OPENAI_COMPATIBLE_ENDPOINTS[provider];
            const openai = new OpenAI({
                apiKey: providerApiKey,
                ...(providerEndpoint ? { baseURL: providerEndpoint.baseURL } : {}),
            });

            const openAiMessages = messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
            const response = await openai.chat.completions.create({
                model,
                messages: openAiMessages,
                stream: true,
                tools,
                tool_choice
            });

            // Shadow Mode: collect tool calls during streaming to intercept
            const collectedToolCalls: Record<number, { id: string; type: string; function: { name: string; arguments: string } }> = {};

            const streamResponse = new ReadableStream({
                async start(controller) {
                    for await (const chunk of response) {
                        const delta = chunk.choices[0]?.delta;

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

                    if (shadowMode && toolCallValues.length > 0) {
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
                    } else if (!shadowMode && toolCallValues.length > 0) {
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
                        logGatewayRequest(gatewayCtx, { endpoint: '/v1/chat/completions', model, provider, status: 'success' }).catch(console.error);
                        incrementUsage(gatewayCtx).catch(console.error);
                    }
                }
            });

            const nextResponse = new NextResponse(streamResponse, {
                headers: { "Content-Type": "text/event-stream" }
            });
            return gatewayCtx ? addGatewayHeaders(nextResponse, { requestId: gatewayCtx.requestId }) : nextResponse;
        }

    } catch (error: unknown) {
        console.error("Gateway Error:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
