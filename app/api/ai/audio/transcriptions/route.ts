/**
 * Speech-to-Text (Transcription) API Route
 * 
 * POST /api/ai/audio/transcriptions
 * 
 * Transcribes audio to text using OpenAI Whisper.
 * Accepts multipart/form-data with audio file.
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

// Whisper pricing: per minute of audio
const WHISPER_PRICE_PER_MINUTE = 0.006; // $0.006/min

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
        // Parse form data
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const model = (formData.get('model') as string) || 'whisper-1';
        const language = formData.get('language') as string | null;
        const prompt = formData.get('prompt') as string | null;
        const responseFormat = (formData.get('response_format') as string) || 'json';
        const temperature = parseFloat(formData.get('temperature') as string) || 0;

        if (!file) {
            return addGatewayHeaders(
                NextResponse.json({ error: 'bad_request', message: 'Audio file is required' }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        // Validate file type
        const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/flac'];
        if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|webm|mp4|m4a|ogg|flac|mpeg)$/i)) {
            return addGatewayHeaders(
                NextResponse.json({ error: 'bad_request', message: 'Unsupported audio format. Supported: mp3, wav, webm, mp4, m4a, ogg, flac' }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        // Check file size (max 25MB for Whisper)
        if (file.size > 25 * 1024 * 1024) {
            return addGatewayHeaders(
                NextResponse.json({ error: 'bad_request', message: 'File size exceeds maximum of 25MB' }, { status: 400 }),
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

        const transcriptionParams: OpenAI.Audio.TranscriptionCreateParams = {
            file,
            model,
            response_format: responseFormat as 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt',
            temperature,
        };

        if (language) transcriptionParams.language = language;
        if (prompt) transcriptionParams.prompt = prompt;

        const response = await client.audio.transcriptions.create(transcriptionParams);

        // Estimate cost (approximate from file size — ~1 min per 1MB for mp3)
        const estimatedMinutes = Math.max(0.1, file.size / (1024 * 1024));
        const providerCost = estimatedMinutes * WHISPER_PRICE_PER_MINUTE;
        const cencoriCharge = providerCost * 1.2;

        await logGatewayRequest(ctx, {
            endpoint: 'audio/transcriptions',
            model,
            provider: 'openai',
            status: 'success',
            costUsd: cencoriCharge,
            providerCostUsd: providerCost,
            cencoriChargeUsd: cencoriCharge,
            markupPercentage: 20,
            metadata: {
                file_size: file.size,
                file_type: file.type,
                estimated_minutes: estimatedMinutes,
            },
        });
        await incrementUsage(ctx);

        // Return based on format
        if (responseFormat === 'text') {
            return new Response(response as unknown as string, {
                headers: { 'Content-Type': 'text/plain', 'X-Request-Id': ctx.requestId },
            });
        }

        return addGatewayHeaders(
            NextResponse.json(response),
            { requestId: ctx.requestId }
        );

    } catch (error) {
        console.error('Transcription API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await logGatewayRequest(ctx, {
            endpoint: 'audio/transcriptions',
            model: 'whisper-1',
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
        models: ['whisper-1'],
        supported_formats: ['mp3', 'mp4', 'm4a', 'mpeg', 'mpga', 'wav', 'webm', 'ogg', 'flac'],
        response_formats: ['json', 'text', 'srt', 'verbose_json', 'vtt'],
        max_file_size: '25MB',
    });
}
