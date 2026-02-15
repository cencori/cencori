/**
 * Text Completions API Route
 * 
 * POST /api/ai/completions
 * 
 * Legacy text completions endpoint for backward compatibility.
 * Supports streaming and non-streaming responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { decryptApiKey } from '@/lib/encryption';
import { getPricingFromDB } from '@/lib/providers/pricing';
import { checkInputSecurity } from '@/lib/safety/multi-layer-check';
import { getProjectSecurityConfig } from '@/lib/safety/utils';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
    GatewayContext,
} from '@/lib/gateway-middleware';

interface CompletionRequest {
    model?: string;
    prompt: string | string[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    n?: number;
    stream?: boolean;
    stop?: string | string[];
    suffix?: string;
    echo?: boolean;
}

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function POST(req: NextRequest) {
    // ── Gateway validation (auth, rate limit, spend cap, domain) ──
    const validation = await validateGatewayRequest(req);
    if (!validation.success) {
        return validation.response;
    }
    const ctx = validation.context;

    try {
        // Parse request body
        const body: CompletionRequest = await req.json();
        const {
            prompt,
            model = 'gpt-3.5-turbo-instruct',
            max_tokens = 100,
            temperature = 1,
            top_p = 1,
            n = 1,
            stream = false,
            stop,
            suffix,
            echo = false,
        } = body;

        if (!prompt) {
            return addGatewayHeaders(
                NextResponse.json(
                    { error: 'bad_request', message: 'Prompt is required' },
                    { status: 400 }
                ),
                { requestId: ctx.requestId }
            );
        }

        // ── Input security scanning ──
        const promptText = Array.isArray(prompt) ? prompt.join('\n') : prompt;
        try {
            const securityConfig = await getProjectSecurityConfig(ctx.supabase, ctx.projectId);
            const inputSecurity = checkInputSecurity(promptText, [{ role: 'user', content: promptText }], securityConfig);

            if (!inputSecurity.safe) {
                await logGatewayRequest(ctx, {
                    endpoint: 'completions',
                    model,
                    provider: 'openai',
                    status: 'blocked',
                    errorMessage: `Input blocked: ${inputSecurity.reasons.join(', ')}`,
                });
                return addGatewayHeaders(
                    NextResponse.json(
                        {
                            error: 'content_filtered',
                            message: 'Input was blocked by security policy',
                            reasons: inputSecurity.reasons,
                        },
                        { status: 403 }
                    ),
                    { requestId: ctx.requestId }
                );
            }
        } catch (e) {
            console.warn('[Completions] Security check failed, continuing:', e);
        }

        // ── Get OpenAI API key (BYOK or default) ──
        let openaiKey: string | null = null;

        const { data: providerKey } = await ctx.supabase
            .from('provider_keys')
            .select('encrypted_key, is_active')
            .eq('project_id', ctx.projectId)
            .eq('provider', 'openai')
            .eq('is_active', true)
            .single();

        if (providerKey?.encrypted_key) {
            openaiKey = decryptApiKey(providerKey.encrypted_key, ctx.organizationId);
        } else {
            openaiKey = process.env.OPENAI_API_KEY ?? null;
        }

        if (!openaiKey) {
            return addGatewayHeaders(
                NextResponse.json(
                    { error: 'provider_not_configured', message: 'No OpenAI API key configured' },
                    { status: 400 }
                ),
                { requestId: ctx.requestId }
            );
        }

        const client = new OpenAI({ apiKey: openaiKey });

        // ── Non-streaming response ──
        if (!stream) {
            const response = await client.completions.create({
                model,
                prompt,
                max_tokens,
                temperature,
                top_p,
                n,
                stop,
                suffix,
                echo,
            });

            // Calculate cost
            const promptTokens = response.usage?.prompt_tokens ?? 0;
            const completionTokens = response.usage?.completion_tokens ?? 0;
            const totalTokens = response.usage?.total_tokens ?? 0;
            const pricing = await getPricingFromDB('openai', model);
            const providerCost = (promptTokens / 1000) * pricing.inputPer1KTokens + (completionTokens / 1000) * pricing.outputPer1KTokens;
            const cencoriCharge = providerCost * (1 + pricing.cencoriMarkupPercentage / 100);

            await logGatewayRequest(ctx, {
                endpoint: 'completions',
                model: response.model,
                provider: 'openai',
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

            return addGatewayHeaders(
                NextResponse.json({
                    id: response.id,
                    object: 'text_completion',
                    created: response.created,
                    model: response.model,
                    choices: response.choices.map((choice, idx) => ({
                        text: choice.text,
                        index: idx,
                        finish_reason: choice.finish_reason,
                    })),
                    usage: response.usage,
                }),
                { requestId: ctx.requestId }
            );
        }

        // ── Streaming response ──
        const streamResponse = await client.completions.create({
            model,
            prompt,
            max_tokens,
            temperature,
            top_p,
            n,
            stop,
            suffix,
            stream: true,
        });

        const encoder = new TextEncoder();
        let completionText = '';
        const streamCtx = ctx; // capture for closure

        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of streamResponse) {
                        const text = chunk.choices[0]?.text ?? '';
                        completionText += text;

                        const sseData = JSON.stringify({
                            id: chunk.id,
                            object: 'text_completion',
                            created: chunk.created,
                            model: chunk.model,
                            choices: [{
                                text,
                                index: 0,
                                finish_reason: chunk.choices[0]?.finish_reason ?? null,
                            }],
                        });

                        controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
                    }

                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();

                    // Estimate tokens and log with cost
                    const estimatedPromptTokens = Math.ceil(promptText.length / 4);
                    const estimatedCompletionTokens = Math.ceil(completionText.length / 4);
                    const pricing = await getPricingFromDB('openai', model);
                    const providerCost = (estimatedPromptTokens / 1000) * pricing.inputPer1KTokens + (estimatedCompletionTokens / 1000) * pricing.outputPer1KTokens;
                    const cencoriCharge = providerCost * (1 + pricing.cencoriMarkupPercentage / 100);

                    await logGatewayRequest(streamCtx, {
                        endpoint: 'completions',
                        model,
                        provider: 'openai',
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
                    console.error('Stream error:', error);
                    controller.error(error);
                }
            },
        });

        const response = new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Request-Id': ctx.requestId,
            },
        });

        return response;

    } catch (error) {
        console.error('Completions API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await logGatewayRequest(ctx, {
            endpoint: 'completions',
            model: 'unknown',
            provider: 'openai',
            status: 'error',
            errorMessage,
        });

        return addGatewayHeaders(
            NextResponse.json(
                { error: 'internal_error', message: errorMessage },
                { status: 500 }
            ),
            { requestId: ctx.requestId }
        );
    }
}
