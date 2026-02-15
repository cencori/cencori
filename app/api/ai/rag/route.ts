import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
    GeminiProvider,
    OpenAIProvider,
    AnthropicProvider,
    OpenAICompatibleProvider,
    CohereProvider,
    isOpenAICompatible,
} from '@/lib/providers';
import { ProviderRouter } from '@/lib/providers/router';
import { UnifiedMessage } from '@/lib/providers/base';
import { decryptApiKey } from '@/lib/encryption';
import { checkInputSecurity, checkOutputSecurity } from '@/lib/safety/multi-layer-check';
import { getProjectSecurityConfig } from '@/lib/safety/utils';
import { getPricingFromDB } from '@/lib/providers/pricing';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
    GatewayContext,
} from '@/lib/gateway-middleware';

const providerRouter = new ProviderRouter();

interface Memory {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
}

// Initialize providers
function initializeDefaultProviders() {
    if (!providerRouter.hasProvider('google') && process.env.GEMINI_API_KEY) {
        try { providerRouter.registerProvider('google', new GeminiProvider()); } catch (e) { console.warn('[RAG] Gemini not available:', e); }
    }
    if (!providerRouter.hasProvider('openai') && process.env.OPENAI_API_KEY) {
        try { providerRouter.registerProvider('openai', new OpenAIProvider()); } catch (e) { console.warn('[RAG] OpenAI not available:', e); }
    }
    if (!providerRouter.hasProvider('anthropic') && process.env.ANTHROPIC_API_KEY) {
        try { providerRouter.registerProvider('anthropic', new AnthropicProvider()); } catch (e) { console.warn('[RAG] Anthropic not available:', e); }
    }
    if (!providerRouter.hasProvider('cohere') && process.env.COHERE_API_KEY) {
        try { providerRouter.registerProvider('cohere', new CohereProvider(process.env.COHERE_API_KEY)); } catch (e) { console.warn('[RAG] Cohere not available:', e); }
    }

    const openAICompatibleEnvVars: Record<string, string> = {
        xai: 'XAI_API_KEY', deepseek: 'DEEPSEEK_API_KEY', groq: 'GROQ_API_KEY',
        mistral: 'MISTRAL_API_KEY', together: 'TOGETHER_API_KEY',
        openrouter: 'OPENROUTER_API_KEY', perplexity: 'PERPLEXITY_API_KEY',
    };

    for (const [provider, envVar] of Object.entries(openAICompatibleEnvVars)) {
        const apiKey = process.env[envVar];
        if (!providerRouter.hasProvider(provider) && apiKey) {
            try { providerRouter.registerProvider(provider, new OpenAICompatibleProvider(provider, apiKey)); }
            catch (e) { console.warn(`[RAG] ${provider} not available:`, e); }
        }
    }
}

async function initializeBYOKProviders(
    ctx: GatewayContext,
    targetProvider: string
): Promise<boolean> {
    try {
        const { data: providerKey, error } = await ctx.supabase
            .from('provider_keys')
            .select('encrypted_key, is_active')
            .eq('project_id', ctx.projectId)
            .eq('provider', targetProvider)
            .single();

        if (!error && providerKey && providerKey.is_active) {
            const apiKey = decryptApiKey(providerKey.encrypted_key, ctx.organizationId);
            if (targetProvider === 'google') { providerRouter.registerProvider(targetProvider, new GeminiProvider(apiKey)); return true; }
            else if (targetProvider === 'openai') { providerRouter.registerProvider(targetProvider, new OpenAIProvider(apiKey)); return true; }
            else if (targetProvider === 'anthropic') { providerRouter.registerProvider(targetProvider, new AnthropicProvider(apiKey)); return true; }
            else if (isOpenAICompatible(targetProvider)) { providerRouter.registerProvider(targetProvider, new OpenAICompatibleProvider(targetProvider, apiKey)); return true; }
            else if (targetProvider === 'cohere') { providerRouter.registerProvider(targetProvider, new CohereProvider(apiKey)); return true; }
        }

        return providerRouter.hasProvider(targetProvider);
    } catch (error) {
        console.error(`[RAG] Failed to initialize BYOK provider ${targetProvider}:`, error);
        return providerRouter.hasProvider(targetProvider);
    }
}

async function searchMemories(
    ctx: GatewayContext,
    namespace: string,
    query: string,
    limit: number = 5,
    threshold: number = 0.5
): Promise<Memory[]> {
    const { data: namespaceData } = await ctx.supabase
        .from('memory_namespaces')
        .select('id')
        .eq('project_id', ctx.projectId)
        .eq('name', namespace)
        .single();

    if (!namespaceData) {
        console.log(`[RAG] Namespace "${namespace}" not found for project ${ctx.projectId}`);
        return [];
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    const { data: memories, error } = await ctx.supabase.rpc('search_memories', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        p_namespace_id: namespaceData.id,
    });

    if (error) {
        console.error('[RAG] Memory search error:', error);
        return [];
    }

    return (memories || []).map((m: { id: string; content: string; metadata: Record<string, unknown>; similarity: number }) => ({
        id: m.id, content: m.content, metadata: m.metadata, similarity: m.similarity,
    }));
}

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function POST(req: NextRequest) {
    // ── Gateway validation ──
    const validation = await validateGatewayRequest(req);
    if (!validation.success) {
        return validation.response;
    }
    const ctx = validation.context;

    try {
        const body = await req.json();
        const {
            messages, model, namespace, temperature,
            maxTokens, max_tokens, stream = false,
            limit = 5, threshold = 0.5, include_sources = true,
        } = body;

        if (!messages || !Array.isArray(messages)) {
            return addGatewayHeaders(
                NextResponse.json({ error: 'messages array is required' }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        if (!namespace) {
            return addGatewayHeaders(
                NextResponse.json({ error: 'namespace is required' }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        const resolvedModel = model || ctx.defaultModel || 'gemini-2.0-flash';

        const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
        if (!lastUserMessage) {
            return addGatewayHeaders(
                NextResponse.json({ error: 'No user message found' }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        const inputText = lastUserMessage.content;

        // ── Input Security Scanning (critical for RAG — prevents data exfiltration) ──
        try {
            const securityConfig = await getProjectSecurityConfig(ctx.supabase, ctx.projectId);
            const inputSecurity = checkInputSecurity(inputText, messages.map((m: { role: string; content: string }) => ({
                role: m.role as 'system' | 'user' | 'assistant',
                content: m.content,
            })), securityConfig);

            if (!inputSecurity.safe) {
                // Log security incident
                await ctx.supabase.from('security_incidents').insert({
                    project_id: ctx.projectId,
                    api_key_id: ctx.apiKeyId,
                    incident_type: inputSecurity.layer,
                    severity: inputSecurity.riskScore > 0.8 ? 'critical' : 'high',
                    description: `RAG input blocked: ${inputSecurity.reasons.join(', ')}`,
                    input_text: inputText,
                    risk_score: Math.min(Math.max(inputSecurity.riskScore, 0), 1),
                    details: inputSecurity.details,
                    action_taken: 'blocked',
                    blocked_at: 'input',
                    detection_method: inputSecurity.layer,
                });

                await logGatewayRequest(ctx, {
                    endpoint: 'rag',
                    model: resolvedModel,
                    provider: 'unknown',
                    status: 'blocked',
                    errorMessage: `Input blocked: ${inputSecurity.reasons.join(', ')}`,
                });

                return addGatewayHeaders(
                    NextResponse.json({
                        error: 'content_filtered',
                        message: 'Your request was blocked by security policy.',
                        reasons: inputSecurity.reasons,
                    }, { status: 403 }),
                    { requestId: ctx.requestId }
                );
            }
        } catch (e) {
            console.warn('[RAG] Security check failed, continuing:', e);
        }

        // Search for relevant memories
        const memories = await searchMemories(ctx, namespace, inputText, limit, threshold);
        console.log(`[RAG] Found ${memories.length} relevant memories for query`);

        // Build context from memories
        let contextBlock = '';
        if (memories.length > 0) {
            contextBlock = `\n\n## Relevant Context\nThe following information was retrieved from memory and may be relevant:\n\n`;
            memories.forEach((mem, i) => {
                contextBlock += `[${i + 1}] ${mem.content}\n`;
            });
            contextBlock += '\nUse the above context to inform your response when relevant.\n';
        }

        // Build augmented messages
        const unifiedMessages: UnifiedMessage[] = messages.map((msg: { role: string; content: string }) => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content,
        }));

        const systemIndex = unifiedMessages.findIndex(m => m.role === 'system');
        if (systemIndex !== -1) {
            unifiedMessages[systemIndex].content += contextBlock;
        } else if (memories.length > 0) {
            unifiedMessages.unshift({ role: 'system', content: `You are a helpful assistant.${contextBlock}` });
        }

        // Initialize provider
        const providerName = providerRouter.detectProvider(resolvedModel);
        const normalizedModel = providerRouter.normalizeModelName(resolvedModel);

        const byokInitialized = await initializeBYOKProviders(ctx, providerName);
        if (!byokInitialized) {
            initializeDefaultProviders();
        }

        if (!providerRouter.hasProvider(providerName)) {
            return addGatewayHeaders(
                NextResponse.json({
                    error: `Provider '${providerName}' is not configured`,
                    message: `Please add your ${providerName} API key in project settings.`,
                }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        const provider = providerRouter.getProviderForModel(resolvedModel);
        const chatRequest = {
            messages: unifiedMessages,
            model: normalizedModel,
            temperature,
            maxTokens: maxTokens || max_tokens,
        };

        if (stream === true) {
            // ── Streaming response ──
            const encoder = new TextEncoder();
            const streamCtx = ctx;

            const readableStream = new ReadableStream({
                async start(controller) {
                    try {
                        let fullContent = '';
                        const streamGen = provider.stream(chatRequest);

                        if (include_sources && memories.length > 0) {
                            const sourcesChunk = {
                                type: 'sources',
                                sources: memories.map(m => ({
                                    content: m.content, metadata: m.metadata, similarity: m.similarity,
                                })),
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(sourcesChunk)}\n\n`));
                        }

                        for await (const chunk of streamGen) {
                            fullContent += chunk.delta;
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                type: 'content', delta: chunk.delta, finish_reason: chunk.finishReason,
                            })}\n\n`));
                        }

                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();

                        // Cost tracking
                        const estimatedPromptTokens = Math.ceil(inputText.length / 4);
                        const estimatedCompletionTokens = Math.ceil(fullContent.length / 4);
                        const pricing = await getPricingFromDB(providerName, normalizedModel);
                        const providerCost = (estimatedPromptTokens / 1000) * pricing.inputPer1KTokens + (estimatedCompletionTokens / 1000) * pricing.outputPer1KTokens;
                        const cencoriCharge = providerCost * (1 + pricing.cencoriMarkupPercentage / 100);

                        await logGatewayRequest(streamCtx, {
                            endpoint: 'rag',
                            model: normalizedModel,
                            provider: providerName,
                            status: 'success',
                            promptTokens: estimatedPromptTokens,
                            completionTokens: estimatedCompletionTokens,
                            totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
                            costUsd: cencoriCharge,
                            providerCostUsd: providerCost,
                            cencoriChargeUsd: cencoriCharge,
                            markupPercentage: pricing.cencoriMarkupPercentage,
                        });
                        await incrementUsage(streamCtx);
                    } catch (error) {
                        console.error('[RAG] Stream error:', error);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`));
                        controller.close();
                    }
                },
            });

            return new Response(readableStream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Request-Id': ctx.requestId,
                },
            });
        } else {
            // ── Non-streaming response ──
            const response = await provider.chat(chatRequest);

            // ── Output Security Scanning ──
            try {
                const securityConfig = await getProjectSecurityConfig(ctx.supabase, ctx.projectId);
                const outputSecurity = checkOutputSecurity(response.content, { inputText }, securityConfig);

                if (!outputSecurity.safe) {
                    await ctx.supabase.from('security_incidents').insert({
                        project_id: ctx.projectId,
                        api_key_id: ctx.apiKeyId,
                        incident_type: 'output_' + outputSecurity.layer,
                        severity: 'high',
                        description: `RAG output blocked: ${outputSecurity.reasons.join(', ')}`,
                        risk_score: outputSecurity.riskScore,
                        action_taken: 'blocked',
                        blocked_at: 'output',
                    });

                    await logGatewayRequest(ctx, {
                        endpoint: 'rag',
                        model: normalizedModel,
                        provider: providerName,
                        status: 'filtered',
                        errorMessage: `Output filtered: ${outputSecurity.reasons.join(', ')}`,
                    });

                    return addGatewayHeaders(
                        NextResponse.json({
                            error: 'content_filtered',
                            message: 'Response was filtered by security policy.',
                        }, { status: 403 }),
                        { requestId: ctx.requestId }
                    );
                }
            } catch (e) {
                console.warn('[RAG] Output security check failed, continuing:', e);
            }

            // Cost tracking
            const promptTokens = response.usage?.promptTokens || 0;
            const completionTokens = response.usage?.completionTokens || 0;
            const totalTokens = response.usage?.totalTokens || 0;
            const pricing = await getPricingFromDB(providerName, normalizedModel);
            const providerCost = (promptTokens / 1000) * pricing.inputPer1KTokens + (completionTokens / 1000) * pricing.outputPer1KTokens;
            const cencoriCharge = providerCost * (1 + pricing.cencoriMarkupPercentage / 100);

            await logGatewayRequest(ctx, {
                endpoint: 'rag',
                model: normalizedModel,
                provider: providerName,
                status: 'success',
                promptTokens,
                completionTokens,
                totalTokens,
                costUsd: cencoriCharge,
                providerCostUsd: providerCost,
                cencoriChargeUsd: cencoriCharge,
                markupPercentage: pricing.cencoriMarkupPercentage,
            });
            await incrementUsage(ctx);

            const result: Record<string, unknown> = {
                message: { role: 'assistant', content: response.content },
                model: normalizedModel,
                provider: providerName,
                usage: {
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    total_tokens: totalTokens,
                },
                latency_ms: Date.now() - ctx.startTime,
            };

            if (include_sources) {
                result.sources = memories.map(m => ({
                    content: m.content, metadata: m.metadata, similarity: m.similarity,
                }));
            }

            return addGatewayHeaders(NextResponse.json(result), { requestId: ctx.requestId });
        }
    } catch (error) {
        console.error('[RAG] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await logGatewayRequest(ctx, {
            endpoint: 'rag',
            model: 'unknown',
            provider: 'unknown',
            status: 'error',
            errorMessage,
        });

        return addGatewayHeaders(
            NextResponse.json({ error: 'Internal server error', message: errorMessage }, { status: 500 }),
            { requestId: ctx.requestId }
        );
    }
}
