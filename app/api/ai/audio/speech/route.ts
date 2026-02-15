/**
 * Text-to-Speech API Route
 * 
 * POST /api/ai/audio/speech
 * 
 * Converts text to speech using AI models.
 * Returns audio as a binary stream.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { decryptApiKey } from '@/lib/encryption';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
} from '@/lib/gateway-middleware';

type Voice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
type ResponseFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

interface SpeechRequest {
    model?: 'tts-1' | 'tts-1-hd';
    input: string;
    voice?: Voice;
    response_format?: ResponseFormat;
    speed?: number;
}

// TTS pricing: per 1M characters
const TTS_PRICING: Record<string, number> = {
    'tts-1': 15.00,     // $15/1M chars
    'tts-1-hd': 30.00,  // $30/1M chars
};

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
        const body: SpeechRequest = await req.json();
        const {
            input,
            model = 'tts-1',
            voice = 'alloy',
            response_format = 'mp3',
            speed = 1.0,
        } = body;

        if (!input) {
            return addGatewayHeaders(
                NextResponse.json({ error: 'bad_request', message: 'Input text is required' }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        if (input.length > 4096) {
            return addGatewayHeaders(
                NextResponse.json({ error: 'bad_request', message: 'Input text exceeds maximum length of 4096 characters' }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        // Get OpenAI API key (BYOK or default)
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
                NextResponse.json({ error: 'provider_not_configured', message: 'No OpenAI API key configured' }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        const client = new OpenAI({ apiKey: openaiKey });

        const response = await client.audio.speech.create({
            model,
            input,
            voice,
            response_format,
            speed,
        });

        // Cost tracking (per-character pricing)
        const charCount = input.length;
        const pricePerMillion = TTS_PRICING[model] || 15.0;
        const providerCost = (charCount / 1_000_000) * pricePerMillion;
        const cencoriCharge = providerCost * 1.2;

        await logGatewayRequest(ctx, {
            endpoint: 'audio/speech',
            model,
            provider: 'openai',
            status: 'success',
            promptTokens: Math.ceil(charCount / 4),
            totalTokens: Math.ceil(charCount / 4),
            costUsd: cencoriCharge,
            providerCostUsd: providerCost,
            cencoriChargeUsd: cencoriCharge,
            markupPercentage: 20,
        });
        await incrementUsage(ctx);

        // Get the audio data
        const audioBuffer = await response.arrayBuffer();

        const contentTypes: Record<ResponseFormat, string> = {
            mp3: 'audio/mpeg',
            opus: 'audio/opus',
            aac: 'audio/aac',
            flac: 'audio/flac',
            wav: 'audio/wav',
            pcm: 'audio/pcm',
        };

        return new Response(audioBuffer, {
            headers: {
                'Content-Type': contentTypes[response_format],
                'Content-Length': audioBuffer.byteLength.toString(),
                'X-Request-Id': ctx.requestId,
            },
        });

    } catch (error) {
        console.error('Speech API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await logGatewayRequest(ctx, {
            endpoint: 'audio/speech',
            model: 'tts-1',
            provider: 'openai',
            status: 'error',
            errorMessage,
        });

        return addGatewayHeaders(
            NextResponse.json({ error: 'internal_error', message: errorMessage }, { status: 500 }),
            { requestId: ctx.requestId }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        models: ['tts-1', 'tts-1-hd'],
        voices: [
            { id: 'alloy', description: 'Neutral and balanced' },
            { id: 'echo', description: 'Warm and conversational' },
            { id: 'fable', description: 'British accent, expressive' },
            { id: 'onyx', description: 'Deep and authoritative' },
            { id: 'nova', description: 'Friendly and upbeat' },
            { id: 'shimmer', description: 'Clear and professional' },
        ],
        formats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
    });
}
