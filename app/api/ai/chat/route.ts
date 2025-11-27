import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { sendChatRequest, ChatMessage } from '@/lib/gemini';
import { checkInputSecurity, checkOutputSecurity, SecurityCheckResult } from '@/lib/safety/multi-layer-check';
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

        // Get project and organization info for usage tracking
        const { data: projectData, error: projectError } = await supabaseAdmin
            .from('projects')
            .select('id, organization_id, organizations!inner(id, monthly_requests_used, monthly_request_limit, subscription_tier)')
            .eq('id', apiKeyData.project_id)
            .single();

        if (projectError || !projectData) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        const organization = Array.isArray(projectData.organizations)
            ? projectData.organizations[0]
            : projectData.organizations;

        // CHECK USAGE LIMIT (before processing request)
        if (organization.monthly_requests_used >= organization.monthly_request_limit) {
            return NextResponse.json(
                {
                    error: 'Monthly limit reached',
                    message: `You've used all ${organization.monthly_request_limit.toLocaleString()} requests this month. Upgrade to continue.`,
                    code: 'USAGE_LIMIT_EXCEEDED',
                    tier: organization.subscription_tier,
                    used: organization.monthly_requests_used,
                    limit: organization.monthly_request_limit,
                },
                {
                    status: 429,
                    headers: {
                        'X-Usage-Limit': organization.monthly_request_limit.toString(),
                        'X-Usage-Used': organization.monthly_requests_used.toString(),
                    }
                }
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

        // PHASE 1 SECURITY CHECK: Validate input content + jailbreak detection
        const combinedInputText = messages
            .map((m: RequestMessage) => m.content || m.text || '')
            .join('\n');

        // Build conversation history for context
        const conversationHistory = messages.map((m: RequestMessage) => ({
            role: m.role,
            content: m.content || m.text || '',
        }));

        const inputSecurityResult = checkInputSecurity(
            combinedInputText,
            conversationHistory
        );

        if (!inputSecurityResult.safe) {
            // Log filtered request with detailed security info (server-side only)
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
                error_message: `Security violation: ${inputSecurityResult.layer}`,
                filtered_reasons: inputSecurityResult.reasons,
                safety_score: 1 - inputSecurityResult.riskScore,
                request_payload: {
                    messages: messages.map((m: RequestMessage) => ({
                        role: m.role,
                        content: m.content?.substring(0, 1000),
                    })),
                    model: model || 'gemini-2.5-flash',
                    temperature,
                    security_layer: inputSecurityResult.layer,
                    risk_score: inputSecurityResult.riskScore,
                },
                response_payload: null
            });

            // Return generic error to user (don't reveal detection details)
            return NextResponse.json(
                {
                    error: 'Request blocked by security policy',
                    message: 'Your request was flagged by our security system. Please rephrase and try again.',
                    code: 'SECURITY_VIOLATION'
                },
                { status: 403 }
            );
        }

        // Call Gemini API
        const response = await sendChatRequest({
            messages: geminiMessages,
            model: model,
            temperature,
            maxOutputTokens,
        });

        // PHASE 2 SECURITY CHECK: Scan AI output for PII leakage and harmful content
        const outputSecurityResult = checkOutputSecurity(
            response.text,
            {
                inputText: combinedInputText,
                inputSecurityResult,
                conversationHistory,
            }
        );

        if (!outputSecurityResult.safe) {
            // Log the blocked output for security review (server-side only)
            await supabaseAdmin.from('ai_requests').insert({
                project_id: apiKeyData.project_id,
                api_key_id: apiKeyData.id,
                model: model || 'gemini-2.5-flash',
                prompt_tokens: response.promptTokens,
                completion_tokens: response.completionTokens,
                total_tokens: response.totalTokens,
                cost_usd: response.costUsd,
                latency_ms: response.latencyMs,
                status: 'blocked_output',
                error_message: `Output security violation: ${outputSecurityResult.layer}`,
                filtered_reasons: outputSecurityResult.reasons,
                safety_score: 1 - outputSecurityResult.riskScore,
                request_payload: {
                    messages: messages.map((m: RequestMessage) => ({
                        role: m.role,
                        content: m.content?.substring(0, 1000),
                    })),
                    model: model || 'gemini-2.5-flash',
                    temperature,
                },
                response_payload: {
                    blocked: true,
                    text: response.text.substring(0, 500),
                    blocked_content: outputSecurityResult.blockedContent,
                    risk_score: outputSecurityResult.riskScore,
                }
            });

            // Return generic error to user (don't reveal what was detected)
            return NextResponse.json(
                {
                    error: 'Response blocked by cencori security policy',
                    message: 'The AI response contained content that violates our security policies.',
                    code: 'CONTENT_FILTERED'
                },
                { status: 403 }
            );
        }

        // Log the successful request to database
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
            safety_score: 1.0, // Passed all security checks
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

        // INCREMENT USAGE COUNTER (atomic operation)
        const { error: usageError } = await supabaseAdmin
            .from('organizations')
            .update({ 
                monthly_requests_used: organization.monthly_requests_used + 1 
            })
            .eq('id', projectData.organization_id);

        if (usageError) {
            console.error('[AI Gateway] Failed to increment usage:', usageError);
            // Don't fail the request if usage tracking fails
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
