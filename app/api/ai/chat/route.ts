/**
 * AI Chat API Route - Multi-Provider Support
 * 
 * Handles AI chat requests with support for OpenAI, Anthropic, Google Gemini, and custom providers
 * Includes tier-based access control, credits management, and streaming support
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { GeminiProvider, OpenAIProvider, AnthropicProvider } from '@/lib/providers';
import { ProviderRouter } from '@/lib/providers/router';
import { UnifiedMessage } from '@/lib/providers/base';
import { deductCredits, hasInsufficientCredits } from '@/lib/credits';

// Initialize providers
const router = new ProviderRouter();

// Lazy initialization of providers
function initializeProviders() {
    if (!router.hasProvider('google')) {
        try {
            router.registerProvider('google', new GeminiProvider());
        } catch (error) {
            console.warn('[API] Gemini provider not available:', error);
        }
    }

    if (!router.hasProvider('openai') && process.env.OPENAI_API_KEY) {
        try {
            router.registerProvider('openai', new OpenAIProvider());
        } catch (error) {
            console.warn('[API] OpenAI provider not available:', error);
        }
    }

    if (!router.hasProvider('anthropic') && process.env.ANTHROPIC_API_KEY) {
        try {
            router.registerProvider('anthropic', new AnthropicProvider());
        } catch (error) {
            console.warn('[API] Anthropic provider not available:', error);
        }
    }
}

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    const supabase = createAdminClient();

    try {
        // 1. Validate API key
        const apiKey = req.headers.get('CENCORI_API_KEY') || req.headers.get('Authorization')?.replace('Bearer ', '');

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Missing CENCORI_API_KEY header' },
                { status: 401 }
            );
        }

        // 2. Look up API key and get project/organization info
        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select(`
        id,
        project_id,
        projects!inner(
          id,
          organization_id,
          organizations!inner(
            id,
            subscription_tier,
            credits_balance
          )
        )
      `)
            .eq('key', apiKey)
            .eq('is_active', true)
            .single();

        if (keyError || !keyData) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 }
            );
        }

        const project = keyData.projects as unknown as {
            id: string;
            organization_id: string;
            organizations: {
                id: string;
                subscription_tier: string;
                credits_balance: number;
            };
        };

        const organization = project.organizations;
        const organizationId = organization.id;
        const tier = organization.subscription_tier || 'free';

        // 3. Parse request body
        const body = await req.json();
        const { messages, model, temperature, maxTokens, max_tokens, stream, userId } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: 'Invalid request: messages array is required' },
                { status: 400 }
            );
        }

        // Normalize messages to unified format
        const unifiedMessages: UnifiedMessage[] = messages.map((msg: { role: string; content: string }) => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content,
        }));

        // 4. Determine model and provider
        const requestedModel = model || 'gemini-2.5-flash';
        initializeProviders();

        const providerName = router.detectProvider(requestedModel);
        const normalizedModel = router.normalizeModelName(requestedModel);

        // 5. Check tier-based access control
        const isPaidTier = tier !== 'free';
        const isMultiModelRequest = providerName !== 'google';

        if (isMultiModelRequest && !isPaidTier) {
            return NextResponse.json(
                {
                    error: 'Multi-model access requires a paid subscription',
                    message: 'OpenAI, Anthropic, and custom providers are only available on paid plans. Upgrade to access these models.',
                    upgradeUrl: '/billing'
                },
                { status: 403 }
            );
        }

        // 6. Check credits balance
        if (isMultiModelRequest && isPaidTier) {
            const estimatedCost = 0.01;
            const insufficient = await hasInsufficientCredits(organizationId, estimatedCost);

            if (insufficient) {
                return NextResponse.json(
                    {
                        error: 'Insufficient credits',
                        message: 'Your credits balance is too low. Please top up to continue.',
                        balance: organization.credits_balance,
                        topUpUrl: '/billing/credits'
                    },
                    { status: 402 }
                );
            }
        }

        // 7. Get provider
        const provider = router.getProviderForModel(requestedModel);

        const chatRequest = {
            messages: unifiedMessages,
            model: normalizedModel,
            temperature,
            maxTokens: maxTokens || max_tokens,
            userId,
        };

        // 8. Handle streaming
        if (stream === true) {
            const encoder = new TextEncoder();

            const customReadable = new ReadableStream({
                async start(controller) {
                    try {
                        const streamGen = provider.stream(chatRequest);
                        let fullContent = '';

                        for await (const chunk of streamGen) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk.delta, finish_reason: chunk.finishReason })}\n\n`));
                            fullContent += chunk.delta;

                            if (chunk.finishReason) {
                                const promptTokens = await provider.countTokens(unifiedMessages.map(m => m.content).join(' '), normalizedModel);
                                const completionTokens = await provider.countTokens(fullContent, normalizedModel);
                                const pricing = await provider.getPricing(normalizedModel);
                                const cost = (promptTokens / 1000) * pricing.inputPer1KTokens + (completionTokens / 1000) * pricing.outputPer1KTokens;
                                const charge = cost * (1 + pricing.cencoriMarkupPercentage / 100);

                                if (isMultiModelRequest && isPaidTier) {
                                    await deductCredits(organizationId, charge, `AI stream - ${providerName}/${normalizedModel}`, undefined);
                                }

                                await supabase.from('ai_requests').insert({
                                    project_id: project.id,
                                    api_key_id: keyData.id,
                                    provider: providerName,
                                    model: normalizedModel,
                                    prompt_tokens: promptTokens,
                                    completion_tokens: completionTokens,
                                    total_tokens: promptTokens + completionTokens,
                                    cost_usd: cost,
                                    provider_cost_usd: cost,
                                    cencori_charge_usd: charge,
                                    markup_percentage: pricing.cencoriMarkupPercentage,
                                    latency_ms: Date.now() - startTime,
                                    status: 'success',
                                    end_user_id: userId,
                                });

                                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                            }
                        }
                        controller.close();
                    } catch (error) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' })}\n\n`));
                        controller.close();
                    }
                },
            });

            return new Response(customReadable, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        // 9. Non-streaming
        const response = await provider.chat(chatRequest);

        // 10. Deduct credits
        if (isMultiModelRequest && isPaidTier) {
            await deductCredits(organizationId, response.cost.cencoriChargeUsd, `AI request - ${providerName}/${normalizedModel}`, undefined);
        }

        // 11. Log request
        await supabase.from('ai_requests').insert({
            project_id: project.id,
            api_key_id: keyData.id,
            provider: providerName,
            model: normalizedModel,
            prompt_tokens: response.usage.promptTokens,
            completion_tokens: response.usage.completionTokens,
            total_tokens: response.usage.totalTokens,
            cost_usd: response.cost.providerCostUsd,
            provider_cost_usd: response.cost.providerCostUsd,
            cencori_charge_usd: response.cost.cencoriChargeUsd,
            markup_percentage: response.cost.markupPercentage,
            latency_ms: response.latencyMs,
            status: 'success',
            end_user_id: userId,
        });

        // 12. Return
        return NextResponse.json({
            content: response.content,
            model: response.model,
            provider: response.provider,
            usage: {
                prompt_tokens: response.usage.promptTokens,
                completion_tokens: response.usage.completionTokens,
                total_tokens: response.usage.totalTokens,
            },
            cost_usd: response.cost.cencoriChargeUsd,
            finish_reason: response.finishReason,
        });

    } catch (error: unknown) {
        console.error('[API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
