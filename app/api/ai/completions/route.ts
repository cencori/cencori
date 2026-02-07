/**
 * Text Completions API Route
 * 
 * POST /api/ai/completions
 * 
 * Legacy text completions endpoint for backward compatibility.
 * Supports streaming and non-streaming responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import OpenAI from 'openai';
import { decryptApiKey } from '@/lib/encryption';

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

interface CompletionChoice {
    text: string;
    index: number;
    finish_reason: string | null;
}

interface CompletionResponse {
    id: string;
    object: 'text_completion';
    created: number;
    model: string;
    choices: CompletionChoice[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
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
            return NextResponse.json(
                { error: 'bad_request', message: 'Prompt is required' },
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

        // Non-streaming response
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

            const latencyMs = Date.now() - startTime;

            // Log the request
            await supabase.from('ai_requests').insert({
                id: requestId,
                project_id: projectId,
                organization_id: projectData.organization_id,
                endpoint: 'completions',
                model: response.model,
                provider: 'openai',
                input_tokens: response.usage?.prompt_tokens ?? 0,
                output_tokens: response.usage?.completion_tokens ?? 0,
                total_tokens: response.usage?.total_tokens ?? 0,
                latency_ms: latencyMs,
                status: 'success',
                created_at: new Date().toISOString(),
            });

            return NextResponse.json({
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
            });
        }

        // Streaming response
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
        let promptTokens = 0;

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

                    // Estimate tokens and log
                    const estimatedPromptTokens = Math.ceil((Array.isArray(prompt) ? prompt.join('') : prompt).length / 4);
                    const estimatedCompletionTokens = Math.ceil(completionText.length / 4);

                    await supabase.from('ai_requests').insert({
                        id: requestId,
                        project_id: projectId,
                        organization_id: projectData.organization_id,
                        endpoint: 'completions',
                        model,
                        provider: 'openai',
                        input_tokens: estimatedPromptTokens,
                        output_tokens: estimatedCompletionTokens,
                        total_tokens: estimatedPromptTokens + estimatedCompletionTokens,
                        latency_ms: Date.now() - startTime,
                        status: 'success',
                        created_at: new Date().toISOString(),
                    });

                } catch (error) {
                    console.error('Stream error:', error);
                    controller.error(error);
                }
            },
        });

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('Completions API error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
            { error: 'internal_error', message: errorMessage },
            { status: 500 }
        );
    }
}
