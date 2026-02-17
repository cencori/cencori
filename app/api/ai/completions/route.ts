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
    UnifiedChatResponse,
    StreamChunk,
} from '@/lib/providers';
import { decryptApiKey } from '@/lib/encryption';
import { checkInputSecurity, checkOutputSecurity } from '@/lib/safety/multi-layer-check';
import { getProjectSecurityConfig } from '@/lib/safety/utils';
import { isCircuitOpen, recordSuccess, recordFailure } from '@/lib/providers/circuit-breaker';
import { getFallbackChain, getFallbackModel, isRetryableError, isNonRetryableError } from '@/lib/providers/failover';
import { triggerFallbackWebhook, triggerSecurityWebhook } from '@/lib/webhooks';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getCache, saveCache, computeCacheKey } from '@/lib/cache';

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
    // ... maps for other OpenAI compatible providers if needed
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
            if (targetProvider === 'google') { router.registerProvider(targetProvider, new GeminiProvider(apiKey)); return true; }
            if (targetProvider === 'openai') { router.registerProvider(targetProvider, new OpenAIProvider(apiKey)); return true; }
            if (targetProvider === 'anthropic') { router.registerProvider(targetProvider, new AnthropicProvider(apiKey)); return true; }
            if (isOpenAICompatible(targetProvider)) { router.registerProvider(targetProvider, new OpenAICompatibleProvider(targetProvider, apiKey)); return true; }
            if (targetProvider === 'cohere') { router.registerProvider(targetProvider, new CohereProvider(apiKey)); return true; }
        }
        return router.hasProvider(targetProvider);
    } catch (e) {
        console.warn(`BYOK init failed for ${targetProvider}`, e);
        return router.hasProvider(targetProvider);
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
            stop,
            suffix,
            echo,
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
            // Log security incident (omitted for brevity, assume similar to chat/route logic or use shared helper if planned)
            return addGatewayHeaders(
                NextResponse.json({ error: 'content_filtered', message: 'Input blocked by security policy', reasons: inputSecurity.reasons }, { status: 403 }),
                { requestId: ctx.requestId }
            );
        }

        // ── Caching Check ──
        const cacheKey = computeCacheKey({
            projectId: ctx.projectId,
            model: normalizedModel,
            prompt,
            temperature,
            maxTokens: max_tokens,
        });

        // Only cache if not streaming (streaming cache is harder)
        if (!stream) {
            const cachedResponse = await getCache(cacheKey);
            if (cachedResponse) {
                // Return cached response
                const res = NextResponse.json({
                    ...cachedResponse,
                    id: `cached-${cachedResponse.id}`, // mark as cached ID
                    created: Math.floor(Date.now() / 1000), // update timestamp
                });
                res.headers.set('X-Cencori-Cache', 'HIT');
                return addGatewayHeaders(res, { requestId: ctx.requestId });
            }
        }

        // ── Provider Init ──
        const providerName = router.detectProvider(requestedModel);

        // Initialize Default & BYOK
        initializeDefaultProviders();
        await initializeBYOKProviders(ctx, providerName);

        if (!router.hasProvider(providerName)) {
            return addGatewayHeaders(
                NextResponse.json({ error: `Provider ${providerName} not configured` }, { status: 400 }),
                { requestId: ctx.requestId }
            );
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
                saveCache(cacheKey, jsonResponse).catch(e => console.error('Cache save error', e));
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
