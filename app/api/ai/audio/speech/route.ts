/**
 * Text-to-Speech API Route
 * 
 * POST /api/ai/audio/speech
 * 
 * Converts text to speech using AI models.
 * Returns audio as a binary stream.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import OpenAI from 'openai';
import { decryptApiKey } from '@/lib/encryption';

type Voice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
type ResponseFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

interface SpeechRequest {
    model?: 'tts-1' | 'tts-1-hd';
    input: string;
    voice?: Voice;
    response_format?: ResponseFormat;
    speed?: number;
}

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
        // Get API key from header
        const apiKey = req.headers.get('CENCORI_API_KEY') || req.headers.get('Authorization')?.replace('Bearer ', '');

        if (!apiKey) {
            return NextResponse.json(
                { error: 'unauthorized', message: 'Missing API key' },
                { status: 401 }
            );
        }

        // Parse request body
        const body: SpeechRequest = await req.json();
        const {
            input,
            model = 'tts-1',
            voice = 'alloy',
            response_format = 'mp3',
            speed = 1.0,
        } = body;

        if (!input) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Input text is required' },
                { status: 400 }
            );
        }

        if (input.length > 4096) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Input text exceeds maximum length of 4096 characters' },
                { status: 400 }
            );
        }

        // Initialize Supabase client
        const supabase = createAdminClient();

        // Validate API key and get project
        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select('id, project_id, key_type, is_active, projects(id, organization_id, name)')
            .eq('key_hash', crypto.createHash('sha256').update(apiKey).digest('hex'))
            .single();

        if (keyError || !keyData || !keyData.is_active) {
            return NextResponse.json(
                { error: 'unauthorized', message: 'Invalid or inactive API key' },
                { status: 401 }
            );
        }

        const projectId = keyData.project_id;
        const projectData = keyData.projects as unknown as { id: string; organization_id: string; name: string };

        // Get OpenAI API key (BYOK or default)
        let openaiKey: string | null = null;

        const { data: providerKey } = await supabase
            .from('provider_keys')
            .select('encrypted_key, is_active')
            .eq('project_id', projectId)
            .eq('provider', 'openai')
            .eq('is_active', true)
            .single();

        if (providerKey?.encrypted_key) {
            openaiKey = decryptApiKey(providerKey.encrypted_key, projectData.organization_id);
        } else {
            openaiKey = process.env.OPENAI_API_KEY ?? null;
        }

        if (!openaiKey) {
            return NextResponse.json(
                { error: 'provider_not_configured', message: 'No OpenAI API key configured' },
                { status: 400 }
            );
        }

        const client = new OpenAI({ apiKey: openaiKey });

        // Generate speech
        const response = await client.audio.speech.create({
            model,
            input,
            voice,
            response_format,
            speed,
        });

        const latencyMs = Date.now() - startTime;

        // Log the request (estimate tokens from input length)
        const estimatedTokens = Math.ceil(input.length / 4);
        await supabase.from('ai_requests').insert({
            id: requestId,
            project_id: projectId,
            organization_id: projectData.organization_id,
            endpoint: 'audio/speech',
            model,
            provider: 'openai',
            input_tokens: estimatedTokens,
            output_tokens: 0,
            total_tokens: estimatedTokens,
            latency_ms: latencyMs,
            status: 'success',
            created_at: new Date().toISOString(),
        });

        // Get the audio data as buffer
        const audioBuffer = await response.arrayBuffer();

        // Determine content type based on format
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
            },
        });

    } catch (error) {
        console.error('Speech API error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
            { error: 'internal_error', message: errorMessage },
            { status: 500 }
        );
    }
}

// GET endpoint to list available voices
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
