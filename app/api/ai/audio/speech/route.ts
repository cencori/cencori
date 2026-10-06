/**
 * Text-to-Speech API Route
 *
 * POST /api/ai/audio/speech
 *
 * Converts text to speech across multiple providers (OpenAI, Deepgram Aura,
 * Cartesia Sonic, Spitch, ElevenLabs). Returns audio as a binary stream.
 *
 * Provider is inferred from `model` (backward compatible: default is OpenAI
 * tts-1). Synthesis lives in `lib/audio/speech.ts`; this route owns the
 * gateway pipeline (input guard, pricing, logging, usage).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
} from '@/lib/gateway-middleware';
import { promptPayload } from '@/lib/gateway/log-payload';
import { runGatewayInputPipeline } from '@/lib/gateway/input-guard';
import type { SubscriptionTier } from '@/lib/entitlements';
import { getUsageUnitPricingFromDB } from '@/lib/providers/pricing';
import {
    generateSpeech,
    generateSpeechStream,
    listVoiceModels,
    resolveProviderModel,
    SpeechRequestError,
    type SpeechRequest,
} from '@/lib/audio/speech';

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

    // Model/provider are needed in the catch block for logging; defaults match the lib.
    let model = 'tts-1';
    let provider = 'openai';
    // The spoken text, kept for the failure paths' logs.
    let inputForLog = '';

    try {
        const body: SpeechRequest = await req.json();
        model = body.model ?? 'tts-1';
        if (body.provider) provider = body.provider;
        inputForLog = typeof body.input === 'string' ? body.input : '';

        if (typeof body.input !== 'string' || !body.input.trim()) {
            return addGatewayHeaders(
                NextResponse.json({ error: 'bad_request', message: 'Input text is required' }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        // ── Input guard (redaction / blocking) ──
        const inputPipeline = await runGatewayInputPipeline({
            supabase: ctx.supabase,
            projectId: ctx.projectId,
            apiKeyId: ctx.apiKeyId,
            environment: ctx.environment,
            tier: (ctx.tier || 'free') as SubscriptionTier,
            messages: [{ role: 'user', content: body.input }],
        });
        if (!inputPipeline.ok) {
            await logGatewayRequest(ctx, {
                endpoint: 'audio/speech',
                model,
                provider,
                status: 'blocked',
                errorMessage: inputPipeline.message,
                requestPayload: promptPayload(body.input, { model, voice: body.voice }),
            });
            return addGatewayHeaders(
                NextResponse.json(
                    { error: inputPipeline.code, message: inputPipeline.message, reasons: inputPipeline.reasons },
                    { status: inputPipeline.status }
                ),
                { requestId: ctx.requestId }
            );
        }
        const guardedInput = inputPipeline.messages[0]?.content ?? body.input;

        // BYOK-only auto-router (`auto` / `cencori-auto`): endpoint-implied
        // `speech` task across the project's active BYOK keys. Fails closed
        // with 402 `byok_required` when no priced BYOK voice model fits.
        // An incompatible voice/format for the resolved model falls back to
        // that model's defaults instead of 400ing the `auto` request.
        let autoRequestedModel: string | null = null;
        {
            const { isAutoRouterModel, resolveAutoModelForTask } = await import('@/lib/gateway/auto-router');
            const { VOICE_MODELS } = await import('@/lib/audio/speech');
            if (typeof body.model === 'string' && isAutoRouterModel(body.model)) {
                autoRequestedModel = body.model;
                const requestedFormat = body.response_format;
                try {
                    const resolved = await resolveAutoModelForTask({
                        supabase: ctx.supabase as never,
                        projectId: ctx.projectId,
                        task: 'speech',
                        verify: async (provider, candidate) => {
                            const info = VOICE_MODELS[candidate];
                            if (!info) throw new Error(`pricing_unavailable for ${candidate}`);
                            if (requestedFormat && !info.formats.includes(requestedFormat)) {
                                throw new Error(`${candidate} does not support format ${requestedFormat}`);
                            }
                            // BYOK-only: candidate must have an active project key.
                            const { data: keyRow } = await ctx.supabase
                                .from('provider_keys')
                                .select('encrypted_key, is_active')
                                .eq('project_id', ctx.projectId)
                                .eq('provider', provider)
                                .eq('is_active', true)
                                .maybeSingle();
                            if (!(keyRow as { encrypted_key?: string } | null)?.encrypted_key) {
                                throw new Error(`no BYOK key for ${provider}`);
                            }
                            await getUsageUnitPricingFromDB(provider, candidate, 'characters');
                        },
                    });
                    const info = VOICE_MODELS[resolved.model];
                    body.model = resolved.model;
                    model = resolved.model;
                    if (body.provider && body.provider !== resolved.provider) {
                        delete body.provider;
                    }
                    provider = resolved.provider;
                    if (body.voice && info.voices.length > 0 && !info.voices.includes(body.voice)) {
                        delete body.voice;
                    }
                    if (requestedFormat && !info.formats.includes(requestedFormat)) {
                        body.response_format = 'mp3';
                    }
                } catch (autoError) {
                    if (autoError instanceof Error && (autoError as { code?: unknown }).code === 'byok_required') {
                        return addGatewayHeaders(
                            NextResponse.json({ error: 'byok_required', message: autoError.message }, { status: 402 }),
                            { requestId: ctx.requestId }
                        );
                    }
                    throw autoError;
                }
            }
        }

        // Resolve provider/model and confirm pricing exists BEFORE the billable
        // provider call, so a missing pricing row fails closed instead of charging for dropped audio.
        const resolved = resolveProviderModel(body);
        model = resolved.model;
        provider = resolved.provider;
        const pricing = await getUsageUnitPricingFromDB(resolved.provider, resolved.model, 'characters');

        // ── Synthesize (validates voice/format, resolves BYOK key, dispatches) ──
        const streaming = body.stream === true;
        const result = streaming
            ? await generateSpeechStream(ctx, { ...body, input: guardedInput })
            : await generateSpeech(ctx, { ...body, input: guardedInput });

        // ── Cost tracking (per 1,000 characters) ──
        const providerCost = (result.charCount / 1000) * pricing.unitPriceUsd;
        const cencoriCharge = result.usesByok ? 0 : providerCost;

        await logGatewayRequest(ctx, {
            endpoint: 'audio/speech',
            model: result.model,
            provider: result.provider,
            status: 'success',
            promptTokens: Math.ceil(result.charCount / 4),
            totalTokens: Math.ceil(result.charCount / 4),
            costUsd: cencoriCharge,
            providerCostUsd: providerCost,
            cencoriChargeUsd: cencoriCharge,
            markupPercentage: 0,
            metadata: {
                streaming,
                ...(autoRequestedModel ? { auto_routed: true, auto_requested_model: autoRequestedModel } : {}),
            },
            requestPayload: promptPayload(guardedInput, {
                model: resolved.model,
                voice: body.voice,
                response_format: body.response_format,
                speed: body.speed,
                stream: streaming,
            }),
            // Audio bytes are not logged — the console describes them instead.
            responsePayload: {
                content: `[audio: ${body.response_format ?? 'mp3'}, ${result.charCount} characters synthesized]`,
                format: body.response_format ?? 'mp3',
                characters: result.charCount,
            },
        });
        await incrementUsage(ctx, cencoriCharge);

        const baseHeaders: Record<string, string> = {
            'Content-Type': result.contentType,
            'X-Request-Id': ctx.requestId,
            'X-Provider': result.provider,
        };

        // Buffered path: known byte count, so advertise Content-Length.
        if ('audio' in result) {
            return new Response(result.audio, {
                headers: { ...baseHeaders, 'Content-Length': result.audio.byteLength.toString() },
            });
        }

        // Streaming path: chunked audio, no Content-Length.
        return new Response(result.stream, {
            headers: { ...baseHeaders, 'X-Stream': 'true' },
        });
    } catch (error) {
        if (error instanceof SpeechRequestError) {
            if (error.status >= 500) {
                await logGatewayRequest(ctx, {
                    endpoint: 'audio/speech',
                    model,
                    provider,
                    status: 'error',
                    errorMessage: error.message,
                    requestPayload: promptPayload(inputForLog, { model }),
                });
            }
            return addGatewayHeaders(
                NextResponse.json({ error: error.code, message: error.message }, { status: error.status }),
                { requestId: ctx.requestId }
            );
        }

        console.error('Speech API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await logGatewayRequest(ctx, {
            endpoint: 'audio/speech',
            model,
            provider,
            status: 'error',
            errorMessage,
            requestPayload: promptPayload(inputForLog, { model }),
        });

        return addGatewayHeaders(
            NextResponse.json({ error: 'internal_error', message: errorMessage }, { status: 500 }),
            { requestId: ctx.requestId }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        models: listVoiceModels(),
        formats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
        default_response_format: 'mp3',
        max_input_chars: 4096,
        supports_streaming: true,
    });
}
