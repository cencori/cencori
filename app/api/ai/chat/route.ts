import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { sendChatRequest, ChatMessage } from '@/lib/gemini';
import { checkContent } from '@/lib/safety/content-filter';
import { checkRateLimit } from '@/lib/rate-limit';
import { hashApiKey } from '@/lib/api-keys';

// Request message format from client
interface RequestMessage {
    role: 'user' | 'assistant' | 'model';
    content?: string;
    text?: string;
}

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    const supabaseAdmin = createAdminClient();

    try {
        const apiKey = req.headers.get('CENCORI_API_KEY');
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Missing CENCORI_API_KEY header' },
                { status: 401 }
            );
        }

        // Hash the API key for lookup
        const keyHash = hashApiKey(apiKey);

        // Validate API key and get project info
        const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
            .from('api_keys')
            .select('id, project_id, environment, is_active')
            .eq('key_hash', keyHash)
            .single();

        if (apiKeyError || !apiKeyData) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 }
            );
        }

        if (!apiKeyData.is_active) {
            return NextResponse.json(
                { error: 'API key is inactive' },
                { status: 403 }
            );
        }

        // RATE LIMIT CHECK
        const rateLimit = await checkRateLimit(apiKeyData.project_id);
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': rateLimit.limit.toString(),
                        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                        'X-RateLimit-Reset': rateLimit.reset.toString(),
                    }
                }
            );
        }

        // Parse request body
        const body = await req.json();
        const { messages, model, temperature, maxOutputTokens } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: 'Invalid request: messages array is required' },
                { status: 400 }
            );
        }

        // Convert messages to Gemini format
        const geminiMessages: ChatMessage[] = messages.map((msg: RequestMessage) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content || msg.text || '' }],
        }));

        // SAFETY CHECK: Validate input content
        const combinedInputText = messages
            .map((m: RequestMessage) => m.content || m.text || '')
            .join('\n');

        const safetyResult = checkContent(combinedInputText);

        if (!safetyResult.safe) {
            // Log filtered request
            await supabaseAdmin.from('ai_requests').insert({
                project_id: apiKeyData.project_id,
                api_key_id: apiKeyData.id,
                model: model || 'gemini-2.5-flash',
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                cost_usd: 0,
                latency_ms: Date.now() - startTime,
                status: 'filtered',
                error_message: 'Content safety violation',
                filtered_reasons: safetyResult.reasons,
                safety_score: safetyResult.score,
                request_payload: {
                    messages: messages.map((m: RequestMessage) => ({
                        role: m.role,
                        content: m.content?.substring(0, 1000),
                    })),
                    model: model || 'gemini-2.5-flash',
                    temperature,
                },
                response_payload: null
            });

            return NextResponse.json(
                {
                    error: 'Content safety violation',
                    reasons: safetyResult.reasons
                },
                { status: 400 }
            );
        }

        // Call Gemini API
        const response = await sendChatRequest({
            messages: geminiMessages,
            model: model,
            temperature,
            maxOutputTokens,
        });

        // Log the request to database
        const logData = {
            project_id: apiKeyData.project_id,
            api_key_id: apiKeyData.id,
            model: model || 'gemini-2.5-flash',
            prompt_tokens: response.promptTokens,
            completion_tokens: response.completionTokens,
            total_tokens: response.totalTokens,
            cost_usd: response.costUsd,
            latency_ms: response.latencyMs,
            status: 'success',
            request_payload: {
                messages: messages.map((m: RequestMessage) => ({
                    role: m.role,
                    content: m.content?.substring(0, 1000), // Limit stored content
                })),
                model: model || 'gemini-2.5-flash',
                temperature,
            },
            response_payload: {
                text: response.text.substring(0, 1000), // Limit stored content
            },
        };

        const { error: logError } = await supabaseAdmin
            .from('ai_requests')
            .insert(logData);

        if (logError) {
            console.error('[AI Gateway] Failed to log request:', logError);
            // Don't fail the request if logging fails
        }

        // Return Gemini response
        return NextResponse.json({
            content: response.text,
            model: model || 'gemini-2.5-flash',
            usage: {
                prompt_tokens: response.promptTokens,
                completion_tokens: response.completionTokens,
                total_tokens: response.totalTokens,
            },
            cost_usd: response.costUsd,
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorLatency = (error as { latencyMs?: number }).latencyMs;
        console.error('[AI Gateway] Error:', error);

        // Log failed request
        try {
            const authHeader = req.headers.get('authorization');
            if (authHeader) {
                const apiKey = authHeader.substring(7);
                const { data: apiKeyData } = await supabaseAdmin
                    .from('api_keys')
                    .select('id, project_id')
                    .eq('key', apiKey)
                    .single();

                if (apiKeyData) {
                    await supabaseAdmin.from('ai_requests').insert({
                        project_id: apiKeyData.project_id,
                        api_key_id: apiKeyData.id,
                        model: 'unknown',
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0,
                        cost_usd: 0,
                        latency_ms: errorLatency || (Date.now() - startTime),
                        status: 'error',
                        error_message: errorMessage,
                        request_payload: {},
                    });
                }
            }
        } catch (logError) {
            console.error('[AI Gateway] Failed to log error:', logError);
        }

        return NextResponse.json(
            {
                error: errorMessage,
                details: process.env.NODE_ENV === 'development' ? error : undefined,
            },
            { status: 500 }
        );
    }
}
