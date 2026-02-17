/**
 * Text Completions API Route
 * 
 * POST /api/ai/completions
 * 
 * Legacy text completions endpoint for backward compatibility.
 * Adapts "prompt" requests to the modern "chat" infrastructure via ProviderRouter.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
    GatewayContext,
} from '@/lib/gateway-middleware';
import { ProviderRouter } from '@/lib/providers/router';
import {
    GeminiProvider,
    OpenAIProvider,
    AnthropicProvider,
    OpenAICompatibleProvider,
    CohereProvider,
    isOpenAICompatible,
} from '@/lib/providers';
import { decryptApiKey } from '@/lib/encryption';
import { checkInputSecurity, checkOutputSecurity } from '@/lib/safety/multi-layer-check';
import { getProjectSecurityConfig } from '@/lib/safety/utils';
import { getCache, saveCache, computeCacheKey, getSemanticCache, saveSemanticCache } from '@/lib/cache';

// Initialize Router
const router = new ProviderRouter();

export async function OPTIONS() {
    return handleCorsPreFlight();
}

/**
 * Initialize providers (Default + BYOK)
 * Copied from chat/route.ts to ensure consistent behavior
 */
function initializeDefaultProviders() {
    if (!router.hasProvider('google') && process.env.GEMINI_API_KEY) {
        try { router.registerProvider('google', new GeminiProvider()); } catch (e) { console.warn('Gemini init failed', e); }
    }
    if (!router.hasProvider('openai') && process.env.OPENAI_API_KEY) {
        try { router.registerProvider('openai', new OpenAIProvider()); } catch (e) { console.warn('OpenAI init failed', e); }
    }
    if (!router.hasProvider('anthropic') && process.env.ANTHROPIC_API_KEY) {
        try { router.registerProvider('anthropic', new AnthropicProvider()); } catch (e) { console.warn('Anthropic init failed', e); }
    }
    if (!router.hasProvider('cohere') && process.env.COHERE_API_KEY) {
        try { router.registerProvider('cohere', new CohereProvider(process.env.COHERE_API_KEY)); } catch (e) { console.warn('Cohere init failed', e); }
    }
}

async function initializeBYOKProviders(
    ctx: GatewayContext,
    targetProvider: string
): Promise<string | null> {
    try {
        const { data: providerKey, error } = await ctx.supabase
            .from('provider_keys')
            .select('encrypted_key, is_active')
            .eq('project_id', ctx.projectId)
            .eq('provider', targetProvider)
            .single();

        if (!error && providerKey && providerKey.is_active) {
            const apiKey = decryptApiKey(providerKey.encrypted_key, ctx.organizationId);
            if (targetProvider === 'google') { router.registerProvider(targetProvider, new GeminiProvider(apiKey)); return apiKey; }
            if (targetProvider === 'openai') { router.registerProvider(targetProvider, new OpenAIProvider(apiKey)); return apiKey; }
            if (targetProvider === 'anthropic') { router.registerProvider(targetProvider, new AnthropicProvider(apiKey)); return apiKey; }
            if (isOpenAICompatible(targetProvider)) { router.registerProvider(targetProvider, new OpenAICompatibleProvider(targetProvider, apiKey)); return apiKey; }
            if (targetProvider === 'cohere') { router.registerProvider(targetProvider, new CohereProvider(apiKey)); return apiKey; }
        }
        return null;
    } catch (e) {
        console.warn(`BYOK init failed for ${targetProvider}`, e);
        return null;
    }
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
            prompt,
            model,
            max_tokens,
            temperature = 0.7,
            top_p,
            n = 1,
            stream = false,
        } = body;

        // Default to a chat model if none provided
        const requestedModel = model || ctx.defaultModel || 'gpt-3.5-turbo';
        const normalizedModel = router.normalizeModelName(requestedModel);

        // Ensure prompt exists
        if (!prompt || typeof prompt !== 'string') {
            return addGatewayHeaders(
                NextResponse.json({ error: 'Prompt string is required' }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        // ── Input Security ──
        const securityConfig = await getProjectSecurityConfig(ctx.supabase, ctx.projectId);
        const unifiedMessages = [{ role: 'user' as const, content: prompt }];
        const inputSecurity = checkInputSecurity(prompt, unifiedMessages, securityConfig);

        if (!inputSecurity.safe) {
            await logGatewayRequest(ctx, {
                endpoint: 'completions',
                model: requestedModel,
                provider: 'unknown',
                status: 'blocked',
                errorMessage: `Input blocked: ${inputSecurity.reasons.join(', ')}`,
            });
            return addGatewayHeaders(
                NextResponse.json({ error: 'content_filtered', message: 'Input blocked by security policy', reasons: inputSecurity.reasons }, { status: 403 }),
                { requestId: ctx.requestId }
            );
        }

        // ── Caching Check (Exact Match) ──
        const cacheKey = computeCacheKey({
            projectId: ctx.projectId,
            model: normalizedModel,
            prompt,
            temperature,
            maxTokens: max_tokens,
        });

        // Only cache if not streaming (streaming cache is harder)
        if (!stream) {
            // 1. Exact Match (L1 - Fast)
            const cachedResponse = await getCache(cacheKey);
            if (cachedResponse) {
                const res = NextResponse.json({
                    ...cachedResponse,
                    id: `cached-${cachedResponse.id}`,
                    created: Math.floor(Date.now() / 1000),
                });
                res.headers.set('X-Cencori-Cache', 'HIT');
                return addGatewayHeaders(res, { requestId: ctx.requestId });
            }
        }

        // ── Provider Init ──
        const providerName = router.detectProvider(requestedModel);

        // Initialize Default & BYOK
        initializeDefaultProviders();
        const byokKey = await initializeBYOKProviders(ctx, providerName);

        const effectiveApiKey = byokKey || (providerName === 'google' ? process.env.GEMINI_API_KEY : undefined);

        if (!router.hasProvider(providerName)) {
            return addGatewayHeaders(
                NextResponse.json({ error: `Provider ${providerName} not configured` }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        // ── Caching Check (Semantic) ──
        let semanticEmbedding: number[] | null = null;

        if (!stream && providerName === 'google' && effectiveApiKey) {
            // 2. Semantic Match (L2 - Smart) - uses Vector DB
            // Only enabled for Google-backed requests for now as we use Gemini Embeddings
            const { response: cachedRes, embedding } = await getSemanticCache(prompt, effectiveApiKey);
            semanticEmbedding = embedding; // Store for later save if needed

            if (cachedRes) {
                const res = NextResponse.json({
                    ...cachedRes,
                    id: `semantic-${cachedRes.id}`,
                    created: Math.floor(Date.now() / 1000),
                });
                res.headers.set('X-Cencori-Cache', 'SEMANTIC-HIT');
                return addGatewayHeaders(res, { requestId: ctx.requestId });
            }
        }

        const provider = router.getProviderForModel(requestedModel);

        const chatRequest = {
            messages: unifiedMessages,
            model: normalizedModel,
            temperature,
            maxTokens: max_tokens,
            userId: ctx.projectId,
        };

        // ── Execution Logic ──

        if (stream) {
            const encoder = new TextEncoder();
            const streamCtx = ctx;

            const readableStream = new ReadableStream({
                async start(controller) {
                    try {
                        let fullContent = '';
                        const streamGen = provider.stream(chatRequest);

                        for await (const chunk of streamGen) {
                            const text = chunk.delta;
                            fullContent += text;

                            const sseData = JSON.stringify({
                                id: ctx.requestId,
                                object: 'text_completion',
                                created: Math.floor(Date.now() / 1000),
                                model: normalizedModel,
                                choices: [{
                                    text: text,
                                    index: 0,
                                    finish_reason: chunk.finishReason || null
                                }]
                            });
                            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
                        }

                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();

                        await logGatewayRequest(streamCtx, {
                            endpoint: 'completions',
                            model: normalizedModel,
                            provider: providerName,
                            status: 'success',
                            totalTokens: Math.ceil(fullContent.length / 4),
                        });
                        await incrementUsage(streamCtx);

                    } catch (error) {
                        console.error('Stream Error', error);
                        controller.error(error);
                    }
                }
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
            // Non-Streaming
            const response = await provider.chat(chatRequest);

            // Output Security
            const outputSecurity = checkOutputSecurity(response.content, { inputText: prompt }, securityConfig);
            if (!outputSecurity.safe) {
                return addGatewayHeaders(
                    NextResponse.json({ error: 'content_filtered', message: 'Output blocked' }, { status: 403 }),
                    { requestId: ctx.requestId }
                );
            }

            await logGatewayRequest(ctx, {
                endpoint: 'completions',
                model: normalizedModel,
                provider: providerName,
                status: 'success',
                promptTokens: response.usage.promptTokens,
                completionTokens: response.usage.completionTokens,
                totalTokens: response.usage.totalTokens,
                costUsd: response.cost.cencoriChargeUsd,
                providerCostUsd: response.cost.providerCostUsd,
                cencoriChargeUsd: response.cost.cencoriChargeUsd,
                markupPercentage: response.cost.markupPercentage,
            });
            await incrementUsage(ctx);

            // Map to Legacy JSON Format
            const jsonResponse = {
                id: ctx.requestId,
                object: 'text_completion',
                created: Math.floor(Date.now() / 1000),
                model: normalizedModel,
                choices: [{
                    text: response.content,
                    index: 0,
                    finish_reason: response.finishReason
                }],
                usage: {
                    prompt_tokens: response.usage.promptTokens,
                    completion_tokens: response.usage.completionTokens,
                    total_tokens: response.usage.totalTokens
                }
            };

            // Save to Cache (Async)
            if (!stream) {
                // Save Exact Match (L1)
                saveCache(cacheKey, jsonResponse).catch(e => console.error('Cache save error', e));

                // Save Semantic Match (L2) - Only if Google provider and key available
                if (providerName === 'google' && effectiveApiKey) {
                    // Pass the reusable embedding if available
                    // Convert null (from failed embedding gen) to undefined for the function call if needed, 
                    // though function signature handles optional.
                    const embedToSave = semanticEmbedding || undefined;
                    saveSemanticCache(prompt, jsonResponse, effectiveApiKey, embedToSave).catch(e => console.error('Semantic cache save error', e));
                }
            }

            const finalRes = NextResponse.json(jsonResponse);
            finalRes.headers.set('X-Cencori-Cache', 'MISS');
            return addGatewayHeaders(finalRes, { requestId: ctx.requestId });
        }


    } catch (error) {
        console.error('Completions Error:', error);
        return addGatewayHeaders(
            NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 }),
            { requestId: ctx.requestId }
        );
    }
}
