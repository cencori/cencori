/**
 * Speech-to-Text (Transcription) API Route
 * 
 * POST /api/ai/audio/transcriptions
 * 
 * Transcribes audio to text using OpenAI Whisper.
 * Accepts multipart/form-data with audio file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import OpenAI from 'openai';
import { decryptApiKey } from '@/lib/encryption';

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

        // Parse form data
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const model = (formData.get('model') as string) || 'whisper-1';
        const language = formData.get('language') as string | null;
        const prompt = formData.get('prompt') as string | null;
        const responseFormat = (formData.get('response_format') as string) || 'json';
        const temperature = parseFloat(formData.get('temperature') as string) || 0;

        if (!file) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Audio file is required' },
                { status: 400 }
            );
        }

        // Validate file type
        const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/flac'];
        if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|webm|mp4|m4a|ogg|flac|mpeg)$/i)) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Unsupported audio format. Supported: mp3, wav, webm, mp4, m4a, ogg, flac' },
                { status: 400 }
            );
        }

        // Check file size (max 25MB for Whisper)
        if (file.size > 25 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'bad_request', message: 'File size exceeds maximum of 25MB' },
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

        // Transcribe audio
        const transcriptionParams: OpenAI.Audio.TranscriptionCreateParams = {
            file,
            model,
            response_format: responseFormat as 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt',
            temperature,
        };

        if (language) transcriptionParams.language = language;
        if (prompt) transcriptionParams.prompt = prompt;

        const response = await client.audio.transcriptions.create(transcriptionParams);

        const latencyMs = Date.now() - startTime;

        // Log the request
        await supabase.from('ai_requests').insert({
            id: requestId,
            project_id: projectId,
            organization_id: projectData.organization_id,
            endpoint: 'audio/transcriptions',
            model,
            provider: 'openai',
            input_tokens: 0, // Audio doesn't use token counting
            output_tokens: 0,
            total_tokens: 0,
            latency_ms: latencyMs,
            status: 'success',
            metadata: {
                file_size: file.size,
                file_type: file.type,
                duration_seconds: null, // Would need audio parsing to get this
            },
            created_at: new Date().toISOString(),
        });

        // Return based on format
        if (responseFormat === 'text') {
            return new Response(response as unknown as string, {
                headers: { 'Content-Type': 'text/plain' },
            });
        }

        return NextResponse.json(response);

    } catch (error) {
        console.error('Transcription API error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
            { error: 'internal_error', message: errorMessage },
            { status: 500 }
        );
    }
}

// GET endpoint to list supported formats
export async function GET() {
    return NextResponse.json({
        models: ['whisper-1'],
        supported_formats: ['mp3', 'mp4', 'm4a', 'mpeg', 'mpga', 'wav', 'webm', 'ogg', 'flac'],
        response_formats: ['json', 'text', 'srt', 'verbose_json', 'vtt'],
        max_file_size: '25MB',
    });
}
