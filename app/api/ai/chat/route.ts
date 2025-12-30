/**
 * AI Chat API Route - Multi-Provider Support
 * 
 * Handles AI chat requests with support for multiple AI providers via BYOK
 * Includes tier-based access control, request limit enforcement, and streaming support
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import {
    GeminiProvider,
    OpenAIProvider,
    AnthropicProvider,
    OpenAICompatibleProvider,
    CohereProvider,
    isOpenAICompatible,
} from '@/lib/providers';
import { ProviderRouter } from '@/lib/providers/router';
import { UnifiedMessage } from '@/lib/providers/base';
import { checkInputSecurity, checkOutputSecurity, SecurityCheckResult } from '@/lib/safety/multi-layer-check';
import { geolocation, ipAddress } from '@vercel/functions';
import { decryptApiKey } from '@/lib/encryption';

// Initialize providers
const router = new ProviderRouter();

// Lazy initialization of default providers (env-based)
function initializeDefaultProviders() {
    if (!router.hasProvider('google') && process.env.GOOGLE_AI_API_KEY) {
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

/**
 * Initialize providers from BYOK keys stored in database
 */
async function initializeBYOKProviders(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string,
    organizationId: string,
    targetProvider: string
): Promise<boolean> {
    // Check if we already have this provider
    if (router.hasProvider(targetProvider)) {
        return true;
    }

    try {
        // Fetch the provider key from database
        const { data: providerKey, error } = await supabase
            .from('provider_keys')
            .select('encrypted_key, is_active')
            .eq('project_id', projectId)
            .eq('provider', targetProvider)
            .single();

        if (error || !providerKey || !providerKey.is_active) {
            return false;
        }

        // Decrypt the API key
        const apiKey = decryptApiKey(providerKey.encrypted_key, organizationId);

        // Create the appropriate provider
        if (isOpenAICompatible(targetProvider)) {
            router.registerProvider(
                targetProvider,
                new OpenAICompatibleProvider(targetProvider, apiKey)
            );
            return true;
        } else if (targetProvider === 'cohere') {
            router.registerProvider(targetProvider, new CohereProvider(apiKey));
            return true;
        }

        return false;
    } catch (error) {
        console.error(`[API] Failed to initialize BYOK provider ${targetProvider}:`, error);
        return false;
    }
}

/**
 * Lookup country code from IP address using ipinfo.io (HTTPS, 50k req/month free)
 * Fallback to ip-api.com if needed
 * Returns ISO alpha-2 country code or null on failure
 */
async function lookupCountryFromIp(ip: string): Promise<string | null> {
    try {
        // Skip lookup for private/localhost IPs
        if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
            return null;
        }

        // Try ipinfo.io first (HTTPS, more reliable)
        try {
            const response = await fetch(`https://ipinfo.io/${ip}/country`, {
                signal: AbortSignal.timeout(3000),
                headers: { 'Accept': 'text/plain' }
            });

            if (response.ok) {
                const countryCode = (await response.text()).trim();
                if (countryCode && countryCode.length === 2) {
                    return countryCode.toUpperCase();
                }
            }
        } catch (e) {
            // ipinfo.io failed, try fallback
        }

        // Fallback to ip-api.com
        const fallbackResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`, {
            signal: AbortSignal.timeout(3000),
        });

        if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            if (data.status === 'success' && data.countryCode) {
                return data.countryCode;
            }
        }

        return null;
    } catch (error) {
        // Silently fail - don't block the main request for geo lookup
        console.warn('[Geo] IP lookup failed for IP:', ip, error);
        return null;
    }
}

/**
 * Validate if the origin/referer matches allowed domains for publishable keys
 * Supports wildcard patterns like *.example.com
 */
function validateDomain(origin: string | null, allowedDomains: string[] | null): boolean {
    if (!origin || !allowedDomains || allowedDomains.length === 0) {
        return false;
    }

    try {
        const url = new URL(origin);
        const hostname = url.hostname;

        return allowedDomains.some(pattern => {
            // Exact match
            if (hostname === pattern) return true;

            // Wildcard match: *.example.com matches sub.example.com and example.com
            if (pattern.startsWith('*.')) {
                const baseDomain = pattern.slice(2);
                return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
            }

            // Allow localhost with any port for development
            if (pattern === 'localhost' && hostname === 'localhost') {
                return true;
            }

            return false;
        });
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    const supabase = createAdminClient();

    // Extract client IP and country using Vercel's official helpers
    // Priority:
    // 1. X-Cencori-User-Country (customer explicitly provides country)
    // 2. X-Cencori-User-IP (customer provides end-user IP, we lookup)
    // 3. Vercel's geolocation() helper (automatic, most reliable)
    // 4. x-forwarded-for fallback

    // Get IP from Vercel helper or fallback
    const customerProvidedIp = req.headers.get('x-cencori-user-ip');
    const vercelIp = ipAddress(req);
    const fallbackIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const clientIp = customerProvidedIp || vercelIp || fallbackIp || 'unknown';

    // Get country code
    let countryCode = req.headers.get('x-cencori-user-country');

    // If customer provided IP but no country, do lookup
    if (!countryCode && customerProvidedIp) {
        countryCode = await lookupCountryFromIp(customerProvidedIp);
    }

    // Use Vercel's geolocation helper (most reliable on Vercel)
    if (!countryCode) {
        const geo = geolocation(req);
        countryCode = geo.country || null;
    }

    try {
        // 1. Validate API key
        const apiKey = req.headers.get('CENCORI_API_KEY') || req.headers.get('Authorization')?.replace('Bearer ', '');

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Missing CENCORI_API_KEY header' },
                { status: 401 }
            );
        }

        // 2. Hash the provided API key to compare with stored hash
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        // 3. Look up API key by hash and get project/organization info
        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select(`
        id,
        project_id,
        environment,
        key_type,
        allowed_domains,
        projects!inner(
          id,
          organization_id,
          organizations!inner(
            id,
            subscription_tier,
            monthly_requests_used,
            monthly_request_limit
          )
        )
      `)
            .eq('key_hash', keyHash)
            .is('revoked_at', null)
            .single();

        if (keyError || !keyData) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 }
            );
        }

        // 4. Validate domain for publishable keys
        if (keyData.key_type === 'publishable') {
            const origin = req.headers.get('origin') || req.headers.get('referer');
            const allowedDomains = keyData.allowed_domains as string[] | null;

            if (!validateDomain(origin, allowedDomains)) {
                return NextResponse.json(
                    { error: 'Domain not allowed for this API key' },
                    { status: 403 }
                );
            }

            // For publishable keys, Vercel's geolocation() already captures the browser's
            // location correctly. Just log for debugging.
            console.log('[Geo] Publishable key:', { clientIp, countryCode });
        }

        const project = keyData.projects as unknown as {
            id: string;
            organization_id: string;
            organizations: {
                id: string;
                subscription_tier: string;
                monthly_requests_used: number;
                monthly_request_limit: number;
            };
        };

        const organization = project.organizations;
        const organizationId = organization.id;
        const tier = organization.subscription_tier || 'free';

        // 3. Check monthly request limit
        const currentUsage = organization.monthly_requests_used || 0;
        const limit = organization.monthly_request_limit || 1000;

        if (currentUsage >= limit) {
            return NextResponse.json(
                {
                    error: 'Monthly request limit reached',
                    message: `You've used ${currentUsage.toLocaleString()} of ${limit.toLocaleString()} requests this month.`,
                    current_tier: tier,
                    usage: {
                        used: currentUsage,
                        limit: limit,
                        percentage: Math.round((currentUsage / limit) * 100)
                    },
                    upgrade_message: tier === 'free'
                        ? 'Upgrade to Pro for 50,000 requests/month'
                        : 'Upgrade your plan to get more requests',
                    upgrade_url: '/billing'
                },
                { status: 429 }
            );
        }

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

        // SEMANTIC ANALYSIS & SECURITY CHECK (INPUT)
        const lastUserMessage = unifiedMessages.slice().reverse().find(m => m.role === 'user');
        const inputText = lastUserMessage?.content || '';

        const inputSecurity = checkInputSecurity(inputText, unifiedMessages);

        if (!inputSecurity.safe) {
            // Log security incident
            await supabase.from('security_incidents').insert({
                project_id: project.id,
                api_key_id: keyData.id,
                incident_type: inputSecurity.layer,
                severity: inputSecurity.riskScore > 0.8 ? 'critical' : 'high',
                description: `Blocked ${inputSecurity.layer} attack: ${inputSecurity.reasons.join(', ')}`,
                input_text: inputText,
                risk_score: inputSecurity.riskScore,
                details: inputSecurity.details,
                action_taken: 'blocked',
                end_user_id: userId
            });

            return NextResponse.json(
                {
                    error: 'Security violation detected',
                    message: 'I cannot provide that information as it may contain sensitive data or violates our safety policies.',
                    reasons: inputSecurity.reasons
                },
                { status: 403 }
            );
        }

        // 4. Determine model and provider
        const requestedModel = model || 'gemini-2.0-flash';
        const providerName = router.detectProvider(requestedModel);
        const normalizedModel = router.normalizeModelName(requestedModel);

        // Initialize default providers (env-based)
        initializeDefaultProviders();

        // Try to initialize BYOK provider if needed
        if (!router.hasProvider(providerName)) {
            const byokInitialized = await initializeBYOKProviders(
                supabase,
                project.id,
                organizationId,
                providerName
            );

            if (!byokInitialized) {
                return NextResponse.json(
                    {
                        error: `Provider '${providerName}' is not configured`,
                        message: `Please add your ${providerName} API key in project settings to use this model.`,
                        settingsUrl: `/dashboard/projects/${project.id}/providers`
                    },
                    { status: 400 }
                );
            }
        }

        // 5. Get provider (removed tier restrictions - BYOK means users bring their own keys)
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
                            // Accumulate content for security scanning
                            fullContent += chunk.delta;

                            // Real-time Output Security Scan
                            // We check the accumulating content to catch PII leakage as it happens
                            const outputSecurity = checkOutputSecurity(fullContent, {
                                inputText,
                                inputSecurityResult: inputSecurity,
                                conversationHistory: unifiedMessages
                            });

                            if (!outputSecurity.safe) {
                                // Close stream with error
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Response blocked due to security content policy' })}\n\n`));

                                // Log security incident
                                await supabase.from('security_incidents').insert({
                                    project_id: project.id,
                                    api_key_id: keyData.id,
                                    incident_type: 'output_leakage',
                                    severity: 'critical',
                                    description: `Blocked output leakage: ${outputSecurity.reasons.join(', ')}`,
                                    input_text: inputText,
                                    output_text: fullContent,
                                    risk_score: outputSecurity.riskScore,
                                    details: outputSecurity.details,
                                    action_taken: 'blocked_stream',
                                    end_user_id: userId
                                });

                                controller.close();
                                return; // Stop processing
                            }

                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk.delta, finish_reason: chunk.finishReason })}\n\n`));

                            if (chunk.finishReason) {
                                const promptTokens = await provider.countTokens(unifiedMessages.map(m => m.content).join(' '), normalizedModel);
                                const completionTokens = await provider.countTokens(fullContent, normalizedModel);
                                const pricing = await provider.getPricing(normalizedModel);
                                const cost = (promptTokens / 1000) * pricing.inputPer1KTokens + (completionTokens / 1000) * pricing.outputPer1KTokens;
                                const charge = cost * (1 + pricing.cencoriMarkupPercentage / 100);

                                // Increment usage counter
                                await supabase
                                    .from('organizations')
                                    .update({ monthly_requests_used: currentUsage + 1 })
                                    .eq('id', organizationId);

                                const { error: streamLogError } = await supabase.from('ai_requests').insert({
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
                                    request_payload: { messages, model, temperature, maxTokens, max_tokens, stream },
                                    response_payload: { content: fullContent },
                                    ip_address: clientIp,
                                    country_code: countryCode,
                                });

                                if (streamLogError) {
                                    console.error('[API] Failed to log streaming request:', streamLogError);
                                }

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

        // Output Security Check
        const outputSecurity = checkOutputSecurity(response.content, {
            inputText,
            inputSecurityResult: inputSecurity,
            conversationHistory: unifiedMessages
        });

        if (!outputSecurity.safe) {
            // Log security incident
            await supabase.from('security_incidents').insert({
                project_id: project.id,
                api_key_id: keyData.id,
                incident_type: 'output_leakage',
                severity: 'critical',
                description: `Blocked output leakage: ${outputSecurity.reasons.join(', ')}`,
                input_text: inputText,
                output_text: response.content,
                risk_score: outputSecurity.riskScore,
                details: outputSecurity.details,
                action_taken: 'blocked',
                end_user_id: userId
            });

            return NextResponse.json(
                {
                    error: 'Security violation detected',
                    message: 'Response blocked as it contains sensitive data.',
                    reasons: outputSecurity.reasons
                },
                { status: 403 }
            );
        }

        // 10. Increment usage counter
        await supabase
            .from('organizations')
            .update({ monthly_requests_used: currentUsage + 1 })
            .eq('id', organizationId);

        // 11. Log request
        const { error: logError } = await supabase.from('ai_requests').insert({
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
            request_payload: { messages, model, temperature, maxTokens, max_tokens, stream },
            response_payload: { content: response.content, finishReason: response.finishReason },
            ip_address: clientIp,
            country_code: countryCode,
        });

        if (logError) {
            console.error('[API] Failed to log request:', logError);
            console.error('[API] Request data:', {
                project_id: project.id,
                api_key_id: keyData.id,
                provider: providerName,
                model: normalizedModel,
            });
        }

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
