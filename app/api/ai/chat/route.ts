
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
import { UnifiedMessage, ToolCall } from '@/lib/providers/base';
import { resolveCustomProviderForProject } from '@/lib/providers/custom-provider-routing';
import { checkInputSecurity, checkOutputSecurity } from '@/lib/safety/multi-layer-check';
import { processCustomRules, CustomDataRule, ProcessedContent, applyMask, applyRedact, applyTokenize, deTokenize } from '@/lib/safety/custom-data-rules';
import { geolocation, ipAddress } from '@vercel/functions';
import { decryptApiKey } from '@/lib/encryption';
import { isCircuitOpen, recordSuccess, recordFailure } from '@/lib/providers/circuit-breaker';
import { getFallbackChain, getFallbackModel, isNonRetryableError } from '@/lib/providers/failover';
import { triggerFallbackWebhook, triggerSecurityWebhook } from '@/lib/webhooks';
import { checkSpendCap, checkAndSendBudgetAlerts } from '@/lib/budgets';
import { getProjectSecurityConfig } from '@/lib/safety/utils';
import { handleCorsPreFlight } from '@/lib/gateway-middleware';
import { checkRateLimit } from '@/lib/rate-limit';
import { extractCencoriApiKeyFromHeaders } from '@/lib/api-keys';
import { deductCredits } from '@/lib/credits';
import { computeCacheKey, getCache, getSemanticCache, saveCache, saveSemanticCache } from '@/lib/cache';
import { getGoogleApiKey } from '@/lib/providers/google-env';
import { checkEndUserQuota, recordEndUserUsage, type QuotaCheckResult } from '@/lib/end-user-billing';
import {
    getGatewayFeatureFlags,
    incrementGatewayCounter,
    logGatewayEvent,
    mapProviderErrorToHttpResponse,
} from '@/lib/gateway-reliability';


const router = new ProviderRouter();

export async function OPTIONS() {
    return handleCorsPreFlight();
}



async function getAndProcessCustomRules(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string,
    inputText: string,
    responseText?: string
): Promise<{
    rules: CustomDataRule[];
    inputResult: ProcessedContent;
    outputResult?: ProcessedContent;
}> {
    try {
        const { data: rules, error } = await supabase
            .from('custom_data_rules')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .order('priority', { ascending: false });

        if (error || !rules || rules.length === 0) {
            console.log('[CustomRules] No rules found for project:', projectId, error ? `Error: ${error.message}` : '');
            return {
                rules: [],
                inputResult: { content: inputText, wasProcessed: false, matchedRules: [], shouldBlock: false },
                outputResult: responseText
                    ? { content: responseText, wasProcessed: false, matchedRules: [], shouldBlock: false }
                    : undefined,
            };
        }

        console.log('[CustomRules] Fetched', rules.length, 'rules for project:', projectId);
        rules.forEach((r: CustomDataRule, i: number) => console.log(`  [${i}] ${r.name} (${r.match_type}/${r.action}): ${r.pattern.substring(0, 50)}...`));

        const inputResult = await processCustomRules(inputText, rules);
        console.log('[CustomRules] Input processing result:', {
            wasProcessed: inputResult.wasProcessed,
            shouldBlock: inputResult.shouldBlock,
            matchedRules: inputResult.matchedRules.map(m => m.rule.name)
        });

        let outputResult: ProcessedContent | undefined;
        if (responseText) {
            outputResult = await processCustomRules(responseText, rules);
        }

        return { rules, inputResult, outputResult };
    } catch (error) {
        console.warn('[CustomRules] Failed to process:', error);
        return {
            rules: [],
            inputResult: { content: inputText, wasProcessed: false, matchedRules: [], shouldBlock: false },
            outputResult: responseText
                ? { content: responseText, wasProcessed: false, matchedRules: [], shouldBlock: false }
                : undefined,
        };
    }
}

function initializeDefaultProviders() {
    const defaultGoogleApiKey = getGoogleApiKey();
    if (!router.hasProvider('google') && defaultGoogleApiKey) {
        try {
            router.registerProvider('google', new GeminiProvider(defaultGoogleApiKey));
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

    if (!router.hasProvider('cohere') && process.env.COHERE_API_KEY) {
        try {
            router.registerProvider('cohere', new CohereProvider(process.env.COHERE_API_KEY));
        } catch (error) {
            console.warn('[API] Cohere provider not available:', error);
        }
    }

    const openAICompatibleEnvVars: Record<string, string> = {
        xai: 'XAI_API_KEY',
        deepseek: 'DEEPSEEK_API_KEY',
        groq: 'GROQ_API_KEY',
        mistral: 'MISTRAL_API_KEY',
        together: 'TOGETHER_API_KEY',
        openrouter: 'OPENROUTER_API_KEY',
        perplexity: 'PERPLEXITY_API_KEY',
    };

    for (const [provider, envVar] of Object.entries(openAICompatibleEnvVars)) {
        const apiKey = process.env[envVar];
        if (!router.hasProvider(provider) && apiKey) {
            try {
                router.registerProvider(provider, new OpenAICompatibleProvider(provider, apiKey));
            } catch (error) {
                console.warn(`[API] ${provider} provider not available:`, error);
            }
        }
    }
}

async function initializeBYOKProviders(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string,
    organizationId: string,
    targetProvider: string
): Promise<{ success: boolean; defaultModel?: string; defaultImageModel?: string }> {
    try {
        const { data: providerKey, error } = await supabase
            .from('provider_keys')
            .select('encrypted_key, is_active, default_model, default_image_model')
            .eq('project_id', projectId)
            .eq('provider', targetProvider)
            .single();

        if (!error && providerKey && providerKey.is_active) {
            const apiKey = decryptApiKey(providerKey.encrypted_key, organizationId);
            if (targetProvider === 'google') {
                router.registerProvider(targetProvider, new GeminiProvider(apiKey));
                console.log(`[BYOK] Using user's Google API key for project ${projectId}`);
                return {
                    success: true,
                    defaultModel: providerKey.default_model || undefined,
                    defaultImageModel: providerKey.default_image_model || undefined
                };
            } else if (targetProvider === 'openai') {
                router.registerProvider(targetProvider, new OpenAIProvider(apiKey));
                console.log(`[BYOK] Using user's OpenAI API key for project ${projectId}`);
                return {
                    success: true,
                    defaultModel: providerKey.default_model || undefined,
                    defaultImageModel: providerKey.default_image_model || undefined
                };
            } else if (targetProvider === 'anthropic') {
                router.registerProvider(targetProvider, new AnthropicProvider(apiKey));
                console.log(`[BYOK] Using user's Anthropic API key for project ${projectId}`);
                return {
                    success: true,
                    defaultModel: providerKey.default_model || undefined,
                    defaultImageModel: providerKey.default_image_model || undefined
                };
            } else if (isOpenAICompatible(targetProvider)) {
                router.registerProvider(
                    targetProvider,
                    new OpenAICompatibleProvider(targetProvider, apiKey)
                );
                console.log(`[BYOK] Using user's ${targetProvider} API key for project ${projectId}`);
                return {
                    success: true,
                    defaultModel: providerKey.default_model || undefined,
                    defaultImageModel: providerKey.default_image_model || undefined
                };
            } else if (targetProvider === 'cohere') {
                router.registerProvider(targetProvider, new CohereProvider(apiKey));
                console.log(`[BYOK] Using user's Cohere API key for project ${projectId}`);
                return {
                    success: true,
                    defaultModel: providerKey.default_model || undefined,
                    defaultImageModel: providerKey.default_image_model || undefined
                };
            }
        }

        if (router.hasProvider(targetProvider)) {
            console.log(`[BYOK] No user key for ${targetProvider}, using env-based default`);
            return { success: true };
        }

        return { success: false };
    } catch (error) {
        console.error(`[API] Failed to initialize BYOK provider ${targetProvider}:`, error);
        return { success: router.hasProvider(targetProvider) };
    }
}

async function lookupCountryFromIp(ip: string): Promise<string | null> {
    try {
        if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
            return null;
        }

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
        } catch {
        }

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
        console.warn('[Geo] IP lookup failed for IP:', ip, error);
        return null;
    }
}

async function incrementMonthlyUsage(
    supabase: ReturnType<typeof createAdminClient>,
    organizationId: string,
    fallbackUsage: number
): Promise<void> {
    const { error } = await supabase.rpc('increment_monthly_usage', {
        org_id: organizationId,
    });

    if (!error) {
        return;
    }

    // Fallback path for environments where RPC is unavailable.
    await supabase
        .from('organizations')
        .update({ monthly_requests_used: fallbackUsage + 1 })
        .eq('id', organizationId);
}

async function chargeUsageCredits(
    supabase: ReturnType<typeof createAdminClient>,
    organizationId: string,
    tier: string,
    amount: number,
    referenceId: string | null,
    endpoint: string
): Promise<void> {
    // Free and enterprise tiers are not credit-gated by default.
    if (tier === 'free' || tier === 'enterprise') {
        return;
    }
    if (!(amount > 0) || !referenceId) {
        return;
    }

    // Idempotency guard: avoid duplicate usage debits for the same request log row.
    const { data: existingCharge, error: existingChargeError } = await supabase
        .from('credit_transactions')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('transaction_type', 'usage')
        .eq('reference_id', referenceId)
        .maybeSingle();

    if (existingChargeError) {
        console.warn(`[Billing] Failed to check existing charge for reference=${referenceId}:`, existingChargeError.message);
    }

    if (existingCharge?.id) {
        return;
    }

    const charged = await deductCredits(
        organizationId,
        amount,
        `Usage charge: ${endpoint}`,
        referenceId
    );

    if (!charged) {
        console.warn(`[Billing] Failed to deduct credits for org=${organizationId} endpoint=${endpoint} amount=${amount}`);
    }
}

function parseCachedPayload(rawPayload: unknown): Record<string, unknown> | null {
    if (!rawPayload) return null;
    if (typeof rawPayload === 'object') {
        return rawPayload as Record<string, unknown>;
    }
    if (typeof rawPayload === 'string') {
        try {
            const parsed = JSON.parse(rawPayload);
            return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
        } catch {
            return null;
        }
    }
    return null;
}

function getCachedContent(payload: Record<string, unknown>): string {
    if (typeof payload.content === 'string') {
        return payload.content;
    }

    const choices = payload.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
        return '';
    }

    const firstChoice = choices[0];
    if (!firstChoice || typeof firstChoice !== 'object') {
        return '';
    }

    const choiceRecord = firstChoice as Record<string, unknown>;
    const message = choiceRecord.message;
    if (!message || typeof message !== 'object') {
        return '';
    }

    const messageRecord = message as Record<string, unknown>;
    return typeof messageRecord.content === 'string' ? messageRecord.content : '';
}

function getCachedUsage(payload: Record<string, unknown>): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
} {
    const usageRaw = payload.usage;
    const usage = usageRaw && typeof usageRaw === 'object'
        ? usageRaw as Record<string, unknown>
        : {};

    const parseNumber = (value: unknown): number => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const promptTokens = parseNumber(usage.prompt_tokens ?? usage.promptTokens);
    const completionTokens = parseNumber(usage.completion_tokens ?? usage.completionTokens);
    const totalTokens = parseNumber(usage.total_tokens ?? usage.totalTokens);

    return {
        promptTokens,
        completionTokens,
        totalTokens: totalTokens > 0 ? totalTokens : promptTokens + completionTokens,
    };
}

async function resolveSemanticEmbeddingApiKey(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string,
    organizationId: string
): Promise<string | undefined> {
    const envGoogleKey = getGoogleApiKey();
    if (envGoogleKey) {
        return envGoogleKey;
    }

    const { data: providerKey, error } = await supabase
        .from('provider_keys')
        .select('encrypted_key, is_active')
        .eq('project_id', projectId)
        .eq('provider', 'google')
        .single();

    if (error || !providerKey || !providerKey.is_active) {
        return undefined;
    }

    try {
        return decryptApiKey(providerKey.encrypted_key, organizationId);
    } catch (error) {
        console.warn('[Semantic Cache] Failed to decrypt Google provider key:', error);
        return undefined;
    }
}

function validateDomain(origin: string | null, allowedDomains: string[] | null): boolean {
    if (!origin || !allowedDomains || allowedDomains.length === 0) {
        return false;
    }

    try {
        const url = new URL(origin);
        const hostname = url.hostname;

        return allowedDomains.some(pattern => {
            if (hostname === pattern) return true;

            if (pattern.startsWith('*.')) {
                const baseDomain = pattern.slice(2);
                return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
            }

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
    const requestId = crypto.randomUUID();
    const route = '/api/ai/chat';
    const supabase = createAdminClient();
    const reliabilityFlags = getGatewayFeatureFlags();

    const customerProvidedIp = req.headers.get('x-cencori-user-ip');
    const vercelIp = ipAddress(req);
    const fallbackIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const clientIp = customerProvidedIp || vercelIp || fallbackIp || 'unknown';
    let countryCode = req.headers.get('x-cencori-user-country');

    if (!countryCode && customerProvidedIp) {
        countryCode = await lookupCountryFromIp(customerProvidedIp);
    }
    if (!countryCode) {
        const geo = geolocation(req);
        countryCode = geo.country || null;
    }

    let rateLimitStatus: 'ok' | 'skipped' | 'failed_open' | 'failed_closed' = reliabilityFlags.rateLimitEnabled ? 'ok' : 'skipped';
    let semanticCacheReadStatus: 'hit' | 'miss' | 'error' | 'disabled' = reliabilityFlags.semanticCacheEnabled ? 'miss' : 'disabled';
    let semanticCacheWriteStatus: 'ok' | 'skipped' | 'error' | 'disabled' = reliabilityFlags.semanticCacheEnabled ? 'skipped' : 'disabled';

    try {
        const apiKey = extractCencoriApiKeyFromHeaders(req.headers);

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Missing API key. Provide CENCORI_API_KEY or Authorization: Bearer <key>' },
                { status: 401 }
            );
        }

        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select(`
        id,
        project_id,
        environment,
        key_type,
        allowed_domains,
        agent_id,
        agents (
            id,
            name,
            is_active,
            shadow_mode
        ),
        projects!inner(
          id,
          organization_id,
          default_model,
          default_provider,
          end_user_billing_enabled,
	          organizations!inner(
	            id,
	            subscription_tier,
	            monthly_requests_used,
	            monthly_request_limit,
	            credits_balance,
	            billing_frozen
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

        let agentConfigModel: string | null = null;

        if (keyData.key_type === 'agent' || apiKey.startsWith('cake_')) {
            if (!keyData.agent_id) {
                return NextResponse.json(
                    { error: 'Invalid Agent Key: No agent associated with this key' },
                    { status: 401 }
                );
            }

            const rawAgent = keyData.agents;
            const agent = Array.isArray(rawAgent) ? rawAgent[0] : rawAgent;

            if (agent && !agent.is_active) {
                return NextResponse.json(
                    { error: 'Agent is disabled', message: 'This agent has been deactivated.' },
                    { status: 403 }
                );
            }
            if (agent) {
                console.log('[Agent Identity] Request from:', agent.name);
                // Fetch the agent's configured model from agent_configs
                const { data: agentConfig } = await supabase
                    .from('agent_configs')
                    .select('model')
                    .eq('agent_id', keyData.agent_id)
                    .single();
                if (agentConfig?.model) {
                    agentConfigModel = agentConfig.model;
                }
            }
        }



        if (keyData.key_type === 'publishable') {
            const origin = req.headers.get('origin') || req.headers.get('referer');
            const allowedDomains = keyData.allowed_domains as string[] | null;

            if (!validateDomain(origin, allowedDomains)) {
                return NextResponse.json(
                    { error: 'Domain not allowed for this API key' },
                    { status: 403 }
                );
            }

            console.log('[Geo] Publishable key:', { clientIp, countryCode });
        }

        const project = keyData.projects as unknown as {
            id: string;
            organization_id: string;
            default_model: string | null;
            default_provider: string | null;
            end_user_billing_enabled: boolean | null;
	            organizations: {
	                id: string;
	                subscription_tier: string;
	                monthly_requests_used: number;
	                monthly_request_limit: number;
	                credits_balance: string | number | null;
	                billing_frozen: boolean | null;
	            };
	        };

	        const organization = project.organizations;
	        const organizationId = organization.id;
	        const tier = organization.subscription_tier || 'free';
	        const billingFrozen = Boolean(organization.billing_frozen);
	        const creditsBalance = Number(organization.credits_balance ?? 0);
	        const shouldEnforceCredits = tier !== 'free' && tier !== 'enterprise';

	        if (billingFrozen) {
	            return NextResponse.json(
	                {
	                    error: 'Billing account frozen',
	                    message: 'Billing is currently frozen for this organization. Contact support.',
	                },
	                { status: 403 }
	            );
	        }

	        if (shouldEnforceCredits && creditsBalance <= 0) {
	            return NextResponse.json(
	                {
	                    error: 'Credit balance exhausted',
	                    message: 'Your organization has run out of credits. Top up to continue.',
	                    balance: 0,
	                    top_up_url: '/dashboard/organizations',
	                },
	                { status: 403 }
	            );
	        }

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

        const rateLimitResult = await checkRateLimit(project.id, {
            requestId,
            route,
        });
        rateLimitStatus = rateLimitResult.status;
        if (!rateLimitResult.allowed) {
            const status = rateLimitResult.reason === 'backend_unavailable' ? 503 : 429;
            const responseBody = rateLimitResult.reason === 'backend_unavailable'
                ? {
                    error: 'Rate limit unavailable',
                    message: 'Rate limiting backend is unavailable and fail-open mode is disabled.',
                }
                : {
                    error: 'Rate limit exceeded',
                    message: `${rateLimitResult.limit} requests per minute allowed. Try again shortly.`,
                    retry_after_ms: Math.max(0, rateLimitResult.reset - Date.now()),
                };

            logGatewayEvent('chat.response', {
                requestId,
                route,
                rateLimit: {
                    status: rateLimitResult.status,
                },
                semanticCache: {
                    read: semanticCacheReadStatus,
                    write: semanticCacheWriteStatus,
                },
                response: {
                    status,
                },
            }, status >= 500 ? 'error' : 'warn');

            return NextResponse.json(responseBody, { status });
        }

        const spendCapResult = await checkSpendCap(project.id);
        if (!spendCapResult.allowed) {
            return NextResponse.json(
                {
                    error: 'Spend cap reached',
                    message: spendCapResult.reason || 'Monthly spend cap has been reached.',
                    spend: {
                        current: spendCapResult.status.currentSpend,
                        cap: spendCapResult.status.spendCap,
                    },
                    upgrade_url: '/billing'
                },
                { status: 402 }
            );
        }

        const body = await req.json();
        const { messages, model, temperature, maxTokens, max_tokens, stream, userId, tools, toolChoice } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: 'Invalid request: messages array is required' },
                { status: 400 }
            );
        }

        // ── End-User Quota Check ──
        let endUserQuota: QuotaCheckResult | null = null;
        if (project.end_user_billing_enabled && userId) {
            try {
                endUserQuota = await checkEndUserQuota(project.id, userId, model);
                if (!endUserQuota.allowed) {
                    return NextResponse.json(
                        {
                            error: 'End-user quota exceeded',
                            message: endUserQuota.reason || 'Usage limit reached for this user.',
                            quota: {
                                daily_tokens: { used: endUserQuota.dailyTokensUsed, limit: endUserQuota.dailyTokensLimit },
                                monthly_tokens: { used: endUserQuota.monthlyTokensUsed, limit: endUserQuota.monthlyTokensLimit },
                                daily_requests: { used: endUserQuota.dailyRequestsUsed, limit: endUserQuota.dailyRequestsLimit },
                                monthly_requests: { used: endUserQuota.monthlyRequestsUsed, limit: endUserQuota.monthlyRequestsLimit },
                            },
                            rate_plan: endUserQuota.ratePlan,
                        },
                        { status: 429 }
                    );
                }
                // Check model restrictions
                if (endUserQuota.allowedModels && model && model !== 'auto' && model !== 'cencori/auto') {
                    if (!endUserQuota.allowedModels.includes(model)) {
                        return NextResponse.json(
                            {
                                error: 'Model not allowed',
                                message: `Model '${model}' is not available on the '${endUserQuota.ratePlan}' plan.`,
                                allowed_models: endUserQuota.allowedModels,
                            },
                            { status: 403 }
                        );
                    }
                }
            } catch (err) {
                console.error('[EndUserBilling] Quota check failed, allowing request:', err);
            }
        }

        const unifiedMessages: UnifiedMessage[] = messages.map((msg: { role: string; content: string }) => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content,
        }));
        const lastUserMessage = unifiedMessages.slice().reverse().find(m => m.role === 'user');
        const inputText = lastUserMessage?.content || '';

        const securityConfig = await getProjectSecurityConfig(supabase, project.id);

        const inputSecurity = checkInputSecurity(inputText, unifiedMessages, securityConfig);

        if (!inputSecurity.safe) {
            const severity = inputSecurity.riskScore > 0.8 ? 'critical' : 'high';

            const { error: incidentError } = await supabase.from('security_incidents').insert({
                project_id: project.id,
                api_key_id: keyData.id,
                environment: keyData.environment || 'production',
                incident_type: inputSecurity.layer,
                severity,
                description: `Blocked ${inputSecurity.layer} attack: ${inputSecurity.reasons.join(', ')}`,
                input_text: inputText,
                risk_score: Math.min(Math.max(inputSecurity.riskScore, 0), 1),
                details: inputSecurity.details,
                action_taken: 'blocked',
                end_user_id: userId,
                blocked_at: 'input',
                detection_method: inputSecurity.layer
            });

            if (incidentError) {
                console.error('[SECURITY] Failed to log incident:', incidentError);
                console.error('[SECURITY] Insert data:', {
                    project_id: project.id,
                    incident_type: inputSecurity.layer,
                    severity,
                    risk_score: inputSecurity.riskScore
                });
            } else {
                console.log('[SECURITY] Incident logged successfully for project:', project.id);
            }

            triggerSecurityWebhook(project.id, {
                incident_type: inputSecurity.layer,
                severity,
                description: `Blocked ${inputSecurity.layer} attack: ${inputSecurity.reasons.join(', ')}`,
                end_user_id: userId || undefined,
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

        const customRulesResult = await getAndProcessCustomRules(
            supabase,
            project.id,
            inputText
        );

        if (customRulesResult.inputResult.shouldBlock) {
            const matchedRuleNames = customRulesResult.inputResult.matchedRules
                .filter(r => r.rule.action === 'block')
                .map(r => r.rule.name);
            const blockRule = customRulesResult.inputResult.matchedRules.find(r => r.rule.action === 'block');
            if (blockRule) {
                const { error: incidentError } = await supabase.from('security_incidents').insert({
                    project_id: project.id,
                    environment: keyData.environment || 'production',
                    incident_type: 'data_rule_block',
                    severity: 'high',
                    risk_score: 0.8,
                    description: `Blocked by data rule: ${blockRule.rule.name}`,
                    input_text: inputText.substring(0, 500),
                    blocked_at: 'input',
                    detection_method: 'custom_data_rule',
                    action_taken: 'blocked'
                });
                if (incidentError) {
                    console.error('[CustomRules] Failed to log block incident:', incidentError);
                }
            }

            return NextResponse.json(
                {
                    error: 'Request blocked by data rule',
                    message: 'This request contains content that matches a blocked data pattern.',
                    matched_rules: matchedRuleNames,
                },
                { status: 403 }
            );
        }

        if (customRulesResult.inputResult.wasProcessed && customRulesResult.inputResult.matchedRules.length > 0) {
            const processedRules = customRulesResult.inputResult.matchedRules
                .filter(r => r.rule.action === 'mask' || r.rule.action === 'redact' || r.rule.action === 'tokenize');

            for (const match of processedRules) {
                const actionLabel = match.rule.action === 'tokenize' ? 'tokenized' : `${match.rule.action}ed`;
                const { error: incidentError } = await supabase.from('security_incidents').insert({
                    project_id: project.id,
                    environment: keyData.environment || 'production',
                    incident_type: `data_rule_${match.rule.action}`,
                    severity: 'medium',
                    risk_score: 0.5,
                    description: `Data ${actionLabel} by rule: ${match.rule.name}`,
                    input_text: inputText.substring(0, 500),
                    blocked_at: 'input',
                    detection_method: 'custom_data_rule',
                    action_taken: match.rule.action
                });
                if (incidentError) {
                    console.error(`[CustomRules] Failed to log ${match.rule.action} incident:`, incidentError);
                }
            }
        }

        // Track token map for de-tokenization of LLM response
        let requestTokenMap: Map<string, string> | undefined = customRulesResult.inputResult.tokenMap;

        if (customRulesResult.inputResult.wasProcessed && !customRulesResult.inputResult.shouldBlock) {
            // Apply data rules to ALL user messages in conversation history, not just the last one
            for (let i = 0; i < unifiedMessages.length; i++) {
                if (unifiedMessages[i].role === 'user') {
                    const msgResult = await processCustomRules(unifiedMessages[i].content, customRulesResult.rules);
                    unifiedMessages[i] = {
                        ...unifiedMessages[i],
                        content: msgResult.content
                    };
                    // Merge any token maps from history messages
                    if (msgResult.tokenMap) {
                        if (!requestTokenMap) {
                            requestTokenMap = new Map();
                        }
                        for (const [key, value] of msgResult.tokenMap.entries()) {
                            requestTokenMap.set(key, value);
                        }
                    }
                }
            }
            console.log('[CustomRules] Applied data rules to all user messages in conversation');
        }

        // Resolve model: "auto" means use agent/project config, not a literal model name
        const resolvedModel = (model === 'auto' || model === 'cencori/auto') ? null : model;
        const requestedModel = resolvedModel || agentConfigModel || project.default_model || 'gemini-2.0-flash';
        const customProvider = await resolveCustomProviderForProject({
            supabase,
            projectId: project.id,
            organizationId,
            requestedModel,
        });

        let providerName: string;
        let normalizedModel: string;

        if (customProvider) {
            providerName = customProvider.providerTag;
            normalizedModel = customProvider.upstreamModel;

            if (customProvider.apiFormat === 'anthropic' && !(customProvider.apiKey || process.env.ANTHROPIC_API_KEY)) {
                return NextResponse.json(
                    {
                        error: `Custom provider '${customProvider.name}' is missing an API key.`,
                        message: 'Add the provider API key in Custom Providers before sending requests.',
                    },
                    { status: 400 }
                );
            }

            if (!router.hasProvider(providerName)) {
                const customProviderImpl = customProvider.apiFormat === 'anthropic'
                    ? new AnthropicProvider(customProvider.apiKey || process.env.ANTHROPIC_API_KEY, { baseURL: customProvider.baseUrl })
                    : new OpenAICompatibleProvider(providerName, customProvider.apiKey || 'cencori-no-key', customProvider.baseUrl);
                router.registerProvider(providerName, customProviderImpl);
            }
        } else {
            providerName = router.detectProvider(requestedModel);
            normalizedModel = router.normalizeModelName(requestedModel);

            const byokResult = await initializeBYOKProviders(
                supabase,
                project.id,
                organizationId,
                providerName
            );

            if (!byokResult.success) {
                initializeDefaultProviders();
            }
        }

        if (!router.hasProvider(providerName)) {
            return NextResponse.json(
                {
                    error: `Provider '${providerName}' is not configured`,
                    message: `Please add your ${providerName} API key in project settings to use this model.`,
                    settingsUrl: `/dashboard/projects/${project.id}/providers`
                },
                { status: 400 }
            );
        }

        const provider = customProvider
            ? router.getProvider(providerName)
            : router.getProviderForModel(requestedModel);

        const chatRequest = {
            messages: unifiedMessages,
            model: normalizedModel,
            temperature,
            maxTokens: maxTokens || max_tokens,
            userId,
            tools,
            toolChoice,
        };

        const cacheEligible = stream !== true && (!Array.isArray(tools) || tools.length === 0);
        const cacheMaxTokens = typeof maxTokens === 'number'
            ? maxTokens
            : (typeof max_tokens === 'number' ? max_tokens : undefined);
        const cacheTemperature = typeof temperature === 'number' ? temperature : undefined;
        const cachePromptPayload = JSON.stringify(
            unifiedMessages.map((message) => ({
                role: message.role,
                content: message.content,
            }))
        );
        const exactCacheKey = computeCacheKey({
            projectId: project.id,
            model: normalizedModel,
            prompt: cachePromptPayload,
            temperature: cacheTemperature,
            maxTokens: cacheMaxTokens,
        });
        const semanticCachePrompt = JSON.stringify({
            projectId: project.id,
            model: normalizedModel,
            temperature: cacheTemperature ?? 0,
            maxTokens: cacheMaxTokens ?? 0,
            messages: unifiedMessages,
        });

        let semanticEmbeddingForSave: number[] | null = null;
        let semanticCacheApiKey: string | undefined;

        const maybeReturnCachedResponse = async (
            rawCachedPayload: unknown,
            cacheType: 'exact' | 'semantic'
        ): Promise<NextResponse | null> => {
            const cachedPayload = parseCachedPayload(rawCachedPayload);
            if (!cachedPayload) {
                return null;
            }

            const cachedContent = getCachedContent(cachedPayload);
            if (!cachedContent) {
                return null;
            }

            const finalCachedContent = requestTokenMap
                ? deTokenize(cachedContent, requestTokenMap)
                : cachedContent;

            const cachedOutputSecurity = checkOutputSecurity(finalCachedContent, {
                inputText,
                inputSecurityResult: inputSecurity,
                conversationHistory: unifiedMessages
            });
            if (!cachedOutputSecurity.safe) {
                console.warn(`[Cache] Ignoring ${cacheType} cache hit because output failed current policy checks`);
                return null;
            }

            const cachedUsage = getCachedUsage(cachedPayload);
            const cachedProvider = typeof cachedPayload.provider === 'string'
                ? cachedPayload.provider
                : providerName;
            const cachedModel = typeof cachedPayload.model === 'string'
                ? cachedPayload.model
                : normalizedModel;
            const cachedFinishReason = typeof cachedPayload.finish_reason === 'string'
                ? cachedPayload.finish_reason
                : (typeof cachedPayload.finishReason === 'string' ? cachedPayload.finishReason : null);

            const toolCallsCandidate = cachedPayload.tool_calls ?? cachedPayload.toolCalls;
            const cachedToolCalls = Array.isArray(toolCallsCandidate) ? toolCallsCandidate : null;

            const { error: cacheLogError } = await supabase
                .from('ai_requests')
                .insert({
                    project_id: project.id,
                    api_key_id: keyData.id,
                    provider: cachedProvider,
                    model: cachedModel,
                    prompt_tokens: cachedUsage.promptTokens,
                    completion_tokens: cachedUsage.completionTokens,
                    total_tokens: cachedUsage.totalTokens,
                    cost_usd: 0,
                    provider_cost_usd: 0,
                    cencori_charge_usd: 0,
                    markup_percentage: 0,
                    latency_ms: Date.now() - startTime,
                    status: 'success',
                    end_user_id: userId,
                    request_payload: {
                        messages,
                        model,
                        temperature,
                        maxTokens,
                        max_tokens,
                        stream,
                        cache_hit: true,
                        cache_type: cacheType,
                    },
                    response_payload: {
                        content: finalCachedContent,
                        finishReason: cachedFinishReason,
                        cache_hit: true,
                        cache_type: cacheType,
                    },
                    ip_address: clientIp,
                    country_code: countryCode,
                })
                .select('id')
                .single();

            if (cacheLogError) {
                console.error('[AI Chat] Failed to log cached request:', cacheLogError);
            }

            await incrementMonthlyUsage(supabase, organizationId, currentUsage);

            checkAndSendBudgetAlerts(project.id, project.id, organizationId).catch(err => {
                console.error('[Budget] Failed to check budget alerts:', err);
            });

            const completionId = `chatcmpl-${crypto.randomUUID()}`;
            const createdAt = Math.floor(Date.now() / 1000);

            const responseBody: Record<string, unknown> = {
                id: completionId,
                object: 'chat.completion',
                created: createdAt,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: finalCachedContent,
                        ...(cachedToolCalls && cachedToolCalls.length > 0 ? { tool_calls: cachedToolCalls } : {}),
                    },
                    finish_reason: cachedFinishReason,
                }],
                content: finalCachedContent,
                model: cachedModel,
                provider: cachedProvider,
                ...(cachedToolCalls && cachedToolCalls.length > 0 ? { tool_calls: cachedToolCalls } : {}),
                toolCalls: cachedToolCalls ?? null,
                usage: {
                    prompt_tokens: cachedUsage.promptTokens,
                    completion_tokens: cachedUsage.completionTokens,
                    total_tokens: cachedUsage.totalTokens,
                },
                cost_usd: 0,
                finish_reason: cachedFinishReason,
                cache_hit: true,
                cache_type: cacheType,
            };

            if (cachedPayload.fallback_used === true) {
                responseBody.fallback_used = true;
                if (typeof cachedPayload.original_model === 'string') {
                    responseBody.original_model = cachedPayload.original_model;
                }
                if (typeof cachedPayload.original_provider === 'string') {
                    responseBody.original_provider = cachedPayload.original_provider;
                }
            }

            const cacheResponse = NextResponse.json(responseBody);
            cacheResponse.headers.set('X-Cencori-Cache', cacheType === 'semantic' ? 'SEMANTIC-HIT' : 'HIT');
            logGatewayEvent('chat.response', {
                requestId,
                route,
                provider: cachedProvider,
                model: cachedModel,
                rateLimit: {
                    status: rateLimitStatus,
                },
                semanticCache: {
                    read: semanticCacheReadStatus,
                    write: semanticCacheWriteStatus,
                },
                response: {
                    status: 200,
                },
                cache: {
                    type: cacheType,
                },
            });
            return cacheResponse;
        };

        if (cacheEligible) {
            const exactCached = await getCache(exactCacheKey);
            const exactHit = await maybeReturnCachedResponse(exactCached, 'exact');
            if (exactHit) {
                return exactHit;
            }

            if (reliabilityFlags.semanticCacheEnabled) {
                semanticCacheApiKey = await resolveSemanticEmbeddingApiKey(supabase, project.id, organizationId);
                if (semanticCacheApiKey) {
                    const semanticLookup = await getSemanticCache(
                        semanticCachePrompt,
                        semanticCacheApiKey,
                        0.95,
                        {
                            requestId,
                            route,
                            provider: providerName,
                            model: normalizedModel,
                        }
                    );
                    semanticCacheReadStatus = semanticLookup.status;
                    semanticEmbeddingForSave = semanticLookup.embedding;
                    const semanticHit = await maybeReturnCachedResponse(semanticLookup.response, 'semantic');
                    if (semanticHit) {
                        return semanticHit;
                    }
                } else {
                    semanticCacheReadStatus = 'disabled';
                    semanticCacheWriteStatus = 'disabled';
                }
            } else {
                semanticCacheReadStatus = 'disabled';
                semanticCacheWriteStatus = 'disabled';
            }
        }

        if (stream === true) {
            const encoder = new TextEncoder();

            const { data: streamProjectSettings } = await supabase
                .from('project_settings')
                .select('enable_fallback, fallback_provider, max_retries_before_fallback')
                .eq('project_id', project.id)
                .single();

            const streamEnableFallback = streamProjectSettings?.enable_fallback ?? true;
            const streamConfiguredFallback = streamProjectSettings?.fallback_provider;
            const streamMaxRetries = streamProjectSettings?.max_retries_before_fallback ?? 3;

            async function* tryStreamWithFallback(): AsyncGenerator<{
                delta: string;
                finishReason?: string;
                toolCalls?: ToolCall[];
                actualProvider: string;
                actualModel: string;
                usedFallback: boolean;
            }> {
                let actualProvider = providerName;
                let actualModel = normalizedModel;
                let usedFallback = false;
                let lastError: Error | null = null;

                if (!(await isCircuitOpen(providerName))) {
                    for (let attempt = 0; attempt < streamMaxRetries; attempt++) {
                        try {
                            const streamGen = provider.stream(chatRequest);
                            for await (const chunk of streamGen) {
                                yield { ...chunk, actualProvider, actualModel, usedFallback };
                            }
                            await recordSuccess(providerName);
                            return;
                        } catch (error) {
                            lastError = error instanceof Error ? error : new Error(String(error));
                            console.warn(`[Failover/Stream] Attempt ${attempt + 1}/${streamMaxRetries} failed for ${providerName}:`, lastError.message);

                            if (isNonRetryableError(error)) {
                                throw error;
                            }

                            await recordFailure(providerName);

                            if (attempt < streamMaxRetries - 1) {
                                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
                            }
                        }
                    }
                } else {
                    console.log(`[Failover/Stream] Primary provider ${providerName} circuit is open`);
                    lastError = new Error(`Provider ${providerName} circuit is open`);
                }

                if (streamEnableFallback && lastError) {
                    const fallbackChain = getFallbackChain(providerName, streamConfiguredFallback);
                    console.log(`[Failover/Stream] Trying fallbacks:`, fallbackChain);

                    for (const fallbackProviderName of fallbackChain) {
                        if (await isCircuitOpen(fallbackProviderName)) {
                            console.log(`[Failover/Stream] Skipping ${fallbackProviderName} - circuit open`);
                            continue;
                        }

                        let fallbackDefaultModel: string | undefined;
                        if (!router.hasProvider(fallbackProviderName)) {
                            const byokResult = await initializeBYOKProviders(
                                supabase,
                                project.id,
                                organizationId,
                                fallbackProviderName
                            );
                            if (!byokResult.success) {
                                console.log(`[Failover/Stream] Skipping ${fallbackProviderName} - not configured`);
                                continue;
                            }
                            fallbackDefaultModel = byokResult.defaultModel;
                        } else {
                            // If provider already registered (e.g. it was an env default), 
                            // we still want to check if the user has a preferred model for it
                            const { data: pk } = await supabase
                                .from('provider_keys')
                                .select('default_model')
                                .eq('project_id', project.id)
                                .eq('provider', fallbackProviderName)
                                .single();
                            fallbackDefaultModel = pk?.default_model || undefined;
                        }

                        try {
                            const fallbackProvider = router.getProvider(fallbackProviderName);
                            const fallbackModel = fallbackDefaultModel || await getFallbackModel(normalizedModel, fallbackProviderName);

                            console.log(`[Failover/Stream] Trying ${fallbackProviderName} with model ${fallbackModel} (User Preference: ${!!fallbackDefaultModel})`);

                            actualProvider = fallbackProviderName;
                            actualModel = fallbackModel;
                            usedFallback = true;

                            const streamGen = fallbackProvider.stream({
                                ...chatRequest,
                                model: fallbackModel,
                            });

                            for await (const chunk of streamGen) {
                                yield { ...chunk, actualProvider, actualModel, usedFallback };
                            }

                            await recordSuccess(fallbackProviderName);

                            triggerFallbackWebhook(project.id, {
                                original_provider: providerName,
                                original_model: normalizedModel,
                                fallback_provider: fallbackProviderName,
                                fallback_model: fallbackModel,
                                reason: lastError?.message || 'Primary provider failed',
                            });

                            console.log(`[Failover/Stream] Success with ${fallbackProviderName}`);
                            return;
                        } catch (fallbackError) {
                            console.warn(`[Failover/Stream] Fallback ${fallbackProviderName} failed:`, fallbackError);
                            await recordFailure(fallbackProviderName);
                        }
                    }
                }

                throw lastError || new Error('All providers failed');
            }

            const customReadable = new ReadableStream({
                async start(controller) {
                    try {
                        let fullContent = '';
                        let streamActualProvider = providerName;
                        let streamActualModel = normalizedModel;
                        let streamUsedFallback = false;

                        for await (const chunk of tryStreamWithFallback()) {
                            // Track actual provider/model from first chunk
                            streamActualProvider = chunk.actualProvider;
                            streamActualModel = chunk.actualModel;
                            streamUsedFallback = chunk.usedFallback;

                            // Accumulate content for security scanning
                            fullContent += chunk.delta;

                            // Real-time Output Security Scan
                            const outputSecurity = checkOutputSecurity(fullContent, {
                                inputText,
                                inputSecurityResult: inputSecurity,
                                conversationHistory: unifiedMessages
                            });

                            if (!outputSecurity.safe) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Response blocked due to security content policy' })}\n\n`));

                                await supabase.from('security_incidents').insert({
                                    project_id: project.id,
                                    api_key_id: keyData.id,
                                    environment: keyData.environment || 'production',
                                    incident_type: 'output_leakage',
                                    severity: 'critical',
                                    description: `Blocked output leakage: ${outputSecurity.reasons.join(', ')}`,
                                    input_text: inputText,
                                    output_text: fullContent,
                                    risk_score: Math.min(Math.max(outputSecurity.riskScore, 0), 1),
                                    details: outputSecurity.details,
                                    action_taken: 'blocked_stream',
                                    end_user_id: userId,
                                    blocked_at: 'output',
                                    detection_method: 'automated_check'
                                });

                                // Trigger security webhook (fire and forget)
                                triggerSecurityWebhook(project.id, {
                                    incident_type: 'output_leakage',
                                    severity: 'critical',
                                    description: `Blocked output leakage: ${outputSecurity.reasons.join(', ')}`,
                                    end_user_id: userId || undefined,
                                });

                                controller.close();
                                return;
                            }

                            // Include fallback info in first chunk if fallback was used
                            // De-tokenize the chunk before sending to user
                            const deTokenizedDelta = requestTokenMap
                                ? deTokenize(chunk.delta, requestTokenMap)
                                : chunk.delta;

                            const chunkData: Record<string, unknown> = {
                                delta: deTokenizedDelta,
                                finish_reason: chunk.finishReason
                            };
                            if (streamUsedFallback && fullContent === chunk.delta) {
                                chunkData.fallback_used = true;
                                chunkData.original_provider = providerName;
                                chunkData.original_model = normalizedModel;
                            }
                            // Include tool calls if present
                            if (chunk.toolCalls && chunk.toolCalls.length > 0) {
                                chunkData.tool_calls = chunk.toolCalls;
                            }

                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));

                            if (chunk.finishReason) {
                                const streamProvider = router.getProvider(streamActualProvider);
                                const promptTokens = await streamProvider.countTokens(unifiedMessages.map(m => m.content).join(' '), streamActualModel);
                                const completionTokens = await streamProvider.countTokens(fullContent, streamActualModel);
                                const pricing = await streamProvider.getPricing(streamActualModel);
                                const cost = (promptTokens / 1000) * pricing.inputPer1KTokens + (completionTokens / 1000) * pricing.outputPer1KTokens;
                                const charge = cost * (1 + pricing.cencoriMarkupPercentage / 100);

                                let streamLoggedContent = fullContent;
                                let streamLoggedMessages = messages;
                                if (customRulesResult.rules.length > 0) {
                                    const streamResponseRulesResult = await processCustomRules(
                                        fullContent,
                                        customRulesResult.rules
                                    );
                                    streamLoggedContent = streamResponseRulesResult.content;

                                    if (customRulesResult.inputResult.wasProcessed) {
                                        streamLoggedMessages = messages.map((msg: { role: string; content: string }) => ({
                                            ...msg,
                                            content: customRulesResult.inputResult.matchedRules.reduce((content: string, match: { rule: { action: string; name: string }; snippets: string[] }) => {
                                                if (match.rule.action === 'mask') {
                                                    return applyMask(content, match.snippets);
                                                } else if (match.rule.action === 'redact') {
                                                    return applyRedact(content, match.snippets);
                                                } else if (match.rule.action === 'tokenize') {
                                                    return applyTokenize(content, match.snippets, match.rule.name).text;
                                                }
                                                return content;
                                            }, msg.content)
                                        }));
                                    }
                                }

                                const { data: streamLogData, error: streamLogError } = await supabase
                                    .from('ai_requests')
                                    .insert({
                                        project_id: project.id,
                                        api_key_id: keyData.id,
                                        provider: streamActualProvider,
                                        model: streamActualModel,
                                        prompt_tokens: promptTokens,
                                        completion_tokens: completionTokens,
                                        total_tokens: promptTokens + completionTokens,
                                        cost_usd: cost,
                                        provider_cost_usd: cost,
                                        cencori_charge_usd: charge,
                                        markup_percentage: pricing.cencoriMarkupPercentage,
                                        latency_ms: Date.now() - startTime,
                                        status: streamUsedFallback ? 'success_fallback' : 'success',
                                        end_user_id: userId,
                                        request_payload: {
                                            messages: streamLoggedMessages,
                                            model,
                                            temperature,
                                            maxTokens,
                                            max_tokens,
                                            stream,
                                            original_provider: streamUsedFallback ? providerName : undefined,
                                            original_model: streamUsedFallback ? normalizedModel : undefined,
                                            data_rules_applied: customRulesResult.rules.length > 0,
                                        },
                                        response_payload: { content: streamLoggedContent },
                                        ip_address: clientIp,
                                        country_code: countryCode,
                                    })
                                    .select('id')
                                    .single();

                                if (streamLogError) {
                                    console.error('[API] Failed to log streaming request:', streamLogError);
                                } else {
                                    await chargeUsageCredits(
                                        supabase,
                                        organizationId,
                                        tier,
                                        charge,
                                        streamLogData?.id ?? null,
                                        'ai/chat'
                                    );
                                }

                                await incrementMonthlyUsage(supabase, organizationId, currentUsage);

                                // Record end-user usage for streaming (fire-and-forget)
                                if (project.end_user_billing_enabled && userId && endUserQuota) {
                                    recordEndUserUsage({
                                        projectId: project.id,
                                        externalUserId: userId,
                                        tokens: {
                                            prompt: promptTokens,
                                            completion: completionTokens,
                                            total: promptTokens + completionTokens,
                                        },
                                        cost: {
                                            providerUsd: cost,
                                            cencoriChargeUsd: charge,
                                        },
                                        customerMarkupPercentage: endUserQuota.markupPercentage,
                                        flatRatePerRequest: endUserQuota.flatRatePerRequest,
                                    });
                                }

                                checkAndSendBudgetAlerts(project.id, project.id, organizationId).catch(err => {
                                    console.error('[Budget] Failed to check budget alerts:', err);
                                });

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

        let response;
        let actualProvider = providerName;
        let actualModel = normalizedModel;
        let usedFallback = false;
        const { data: projectSettings } = await supabase
            .from('project_settings')
            .select('enable_fallback, fallback_provider, max_retries_before_fallback')
            .eq('project_id', project.id)
            .single();

        const enableFallback = projectSettings?.enable_fallback ?? true;
        const configuredFallbackProvider = projectSettings?.fallback_provider;
        const maxRetries = projectSettings?.max_retries_before_fallback ?? 3;

        let lastError: Error | null = null;
        let attempts = 0;

        if (await isCircuitOpen(providerName)) {
            console.log(`[Failover] Primary provider ${providerName} circuit is open, going to fallback`);
            lastError = new Error(`Provider ${providerName} circuit is open`);
        } else {
            for (attempts = 0; attempts < maxRetries; attempts++) {
                try {
                    response = await provider.chat(chatRequest);
                    await recordSuccess(providerName);
                    break;
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    console.warn(`[Failover] Attempt ${attempts + 1}/${maxRetries} failed for ${providerName}:`, lastError.message);

                    if (isNonRetryableError(error)) {
                        console.log(`[Failover] Non-retryable error, not attempting fallback`);
                        throw error;
                    }

                    await recordFailure(providerName);

                    if (attempts < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
                    }
                }
            }
        }

        if (!response && enableFallback && lastError) {
            const fallbackChain = getFallbackChain(providerName, configuredFallbackProvider);
            console.log(`[Failover] Primary ${providerName} failed after ${attempts} attempts, trying fallbacks:`, fallbackChain);

            for (const fallbackProviderName of fallbackChain) {
                if (await isCircuitOpen(fallbackProviderName)) {
                    console.log(`[Failover] Skipping ${fallbackProviderName} - circuit is open`);
                    continue;
                }
                if (!router.hasProvider(fallbackProviderName)) {
                    const initialized = await initializeBYOKProviders(
                        supabase,
                        project.id,
                        organizationId,
                        fallbackProviderName
                    );
                    if (!initialized) {
                        console.log(`[Failover] Skipping ${fallbackProviderName} - not configured`);
                        continue;
                    }
                }

                try {
                    const fallbackProvider = router.getProvider(fallbackProviderName);
                    const fallbackModel = await getFallbackModel(normalizedModel, fallbackProviderName);

                    console.log(`[Failover] Trying ${fallbackProviderName} with model ${fallbackModel}`);

                    response = await fallbackProvider.chat({
                        ...chatRequest,
                        model: fallbackModel,
                    });

                    actualProvider = fallbackProviderName;
                    actualModel = fallbackModel;
                    usedFallback = true;
                    await recordSuccess(fallbackProviderName);

                    triggerFallbackWebhook(project.id, {
                        original_provider: providerName,
                        original_model: normalizedModel,
                        fallback_provider: fallbackProviderName,
                        fallback_model: fallbackModel,
                        reason: lastError?.message || 'Primary provider failed',
                    });

                    console.log(`[Failover] Success with fallback ${fallbackProviderName}`);
                    break;
                } catch (fallbackError) {
                    console.warn(`[Failover] Fallback ${fallbackProviderName} failed:`, fallbackError);
                    await recordFailure(fallbackProviderName);
                }
            }
        }

        if (!response) {
            const providerFailure = mapProviderErrorToHttpResponse(lastError, actualProvider);

            console.error('[AI Chat] All providers failed:', lastError?.message);
            incrementGatewayCounter('provider_request_failure', {
                requestId,
                route,
                provider: providerFailure.provider || actualProvider,
                model: actualModel,
                status: providerFailure.status,
            });
            logGatewayEvent('chat.response', {
                requestId,
                route,
                provider: providerFailure.provider || actualProvider,
                model: actualModel,
                rateLimit: {
                    status: rateLimitStatus,
                },
                semanticCache: {
                    read: semanticCacheReadStatus,
                    write: semanticCacheWriteStatus,
                },
                response: {
                    status: providerFailure.status,
                },
                error: providerFailure.error,
                message: providerFailure.message,
            }, providerFailure.status >= 500 ? 'error' : 'warn');

            return NextResponse.json(
                {
                    error: providerFailure.error,
                    message: providerFailure.message,
                    ...(providerFailure.retryAfter ? { retry_after: providerFailure.retryAfter } : {}),
                    ...(providerFailure.provider ? { provider: providerFailure.provider } : {}),
                },
                { status: providerFailure.status }
            );
        }

        const outputSecurity = checkOutputSecurity(response.content, {
            inputText,
            inputSecurityResult: inputSecurity,
            conversationHistory: unifiedMessages
        });

        if (!outputSecurity.safe) {
            await supabase.from('security_incidents').insert({
                project_id: project.id,
                api_key_id: keyData.id,
                environment: keyData.environment || 'production',
                incident_type: 'output_leakage',
                severity: 'critical',
                description: `Blocked output leakage: ${outputSecurity.reasons.join(', ')}`,
                input_text: inputText,
                output_text: response.content,
                risk_score: Math.min(Math.max(outputSecurity.riskScore, 0), 1),
                details: outputSecurity.details,
                action_taken: 'blocked',
                end_user_id: userId,
                blocked_at: 'output',
                detection_method: 'automated_check'
            });

            triggerSecurityWebhook(project.id, {
                incident_type: 'output_leakage',
                severity: 'critical',
                description: `Blocked output leakage: ${outputSecurity.reasons.join(', ')}`,
                end_user_id: userId || undefined,
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

        let loggedMessages = messages;
        let loggedResponse = response.content;

        if (customRulesResult.rules.length > 0) {
            const responseRulesResult = await processCustomRules(
                response.content,
                customRulesResult.rules
            );
            loggedResponse = responseRulesResult.content;

            const inputRulesResult = customRulesResult.inputResult;
            if (inputRulesResult.wasProcessed) {
                loggedMessages = messages.map((msg: { role: string; content: string }) => ({
                    ...msg,
                    content: inputRulesResult.matchedRules.reduce((content, match) => {
                        if (match.rule.action === 'mask') {
                            return applyMask(content, match.snippets);
                        } else if (match.rule.action === 'redact') {
                            return applyRedact(content, match.snippets);
                        } else if (match.rule.action === 'tokenize') {
                            return applyTokenize(content, match.snippets, match.rule.name).text;
                        }
                        return content;
                    }, msg.content)
                }));
            }
        }

        const { data: logData, error: logError } = await supabase
            .from('ai_requests')
            .insert({
                project_id: project.id,
                api_key_id: keyData.id,
                provider: actualProvider,
                model: actualModel,
                prompt_tokens: response.usage.promptTokens,
                completion_tokens: response.usage.completionTokens,
                total_tokens: response.usage.totalTokens,
                cost_usd: response.cost.providerCostUsd,
                provider_cost_usd: response.cost.providerCostUsd,
                cencori_charge_usd: response.cost.cencoriChargeUsd,
                markup_percentage: response.cost.markupPercentage,
                latency_ms: response.latencyMs,
                status: usedFallback ? 'success_fallback' : 'success',
                end_user_id: userId,
                request_payload: {
                    messages: loggedMessages,
                    model,
                    temperature,
                    maxTokens,
                    max_tokens,
                    stream,
                    original_provider: usedFallback ? providerName : undefined,
                    original_model: usedFallback ? normalizedModel : undefined,
                    data_rules_applied: customRulesResult.rules.length > 0,
                },
                response_payload: { content: loggedResponse, finishReason: response.finishReason },
                ip_address: clientIp,
                country_code: countryCode,
            })
            .select('id')
            .single();

        if (logError) {
            console.error('[AI Chat] Failed to log request:', logError);
        } else {
            await chargeUsageCredits(
                supabase,
                organizationId,
                tier,
                response.cost.cencoriChargeUsd,
                logData?.id ?? null,
                'ai/chat'
            );
        }

        await incrementMonthlyUsage(supabase, organizationId, currentUsage);

        // Record end-user usage (fire-and-forget)
        if (project.end_user_billing_enabled && userId && endUserQuota) {
            recordEndUserUsage({
                projectId: project.id,
                externalUserId: userId,
                tokens: {
                    prompt: response.usage.promptTokens,
                    completion: response.usage.completionTokens,
                    total: response.usage.totalTokens,
                },
                cost: {
                    providerUsd: response.cost.providerCostUsd,
                    cencoriChargeUsd: response.cost.cencoriChargeUsd,
                },
                customerMarkupPercentage: endUserQuota.markupPercentage,
                flatRatePerRequest: endUserQuota.flatRatePerRequest,
            });
        }

        checkAndSendBudgetAlerts(project.id, project.id, organizationId).catch(err => {
            console.error('[Budget] Failed to check budget alerts:', err);
        });
        // De-tokenize response before returning to user
        const finalContent = requestTokenMap
            ? deTokenize(response.content, requestTokenMap)
            : response.content;

        // Keep legacy Cencori fields while adding OpenAI-compatible response shape.
        const completionId = `chatcmpl-${crypto.randomUUID()}`;
        const createdAt = Math.floor(Date.now() / 1000);
        const openAiToolCalls = response.toolCalls?.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: tc.function,
        }));
        const responseBody: Record<string, unknown> = {
            id: completionId,
            object: 'chat.completion',
            created: createdAt,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: finalContent,
                    ...(openAiToolCalls && openAiToolCalls.length > 0 ? { tool_calls: openAiToolCalls } : {}),
                },
                finish_reason: response.finishReason,
            }],
            content: finalContent,
            model: actualModel,
            provider: actualProvider,
            ...(openAiToolCalls && openAiToolCalls.length > 0 ? { tool_calls: openAiToolCalls } : {}),
            toolCalls: openAiToolCalls ?? null,
            usage: {
                prompt_tokens: response.usage.promptTokens,
                completion_tokens: response.usage.completionTokens,
                total_tokens: response.usage.totalTokens,
            },
            cost_usd: response.cost.cencoriChargeUsd,
            finish_reason: response.finishReason,
            ...(usedFallback && {
                fallback_used: true,
                original_model: normalizedModel,
                original_provider: providerName,
            }),
        };

        if (cacheEligible) {
            // Save exact cache entry keyed by scoped chat payload.
            saveCache(exactCacheKey, responseBody).catch(error => {
                console.error('[Cache] Failed to save exact cache entry:', error);
            });

            if (semanticCacheApiKey && reliabilityFlags.semanticCacheEnabled) {
                // Save semantic cache entry keyed by project/model-scoped payload representation.
                const embeddingToSave = semanticEmbeddingForSave || undefined;
                void saveSemanticCache(
                    semanticCachePrompt,
                    responseBody,
                    semanticCacheApiKey,
                    embeddingToSave,
                    {
                        requestId,
                        route,
                        provider: actualProvider,
                        model: actualModel,
                        responseStatus: 200,
                    }
                ).then((result) => {
                    semanticCacheWriteStatus = result.status;
                }).catch(error => {
                    console.error('[Cache] Failed to save semantic cache entry:', error);
                    semanticCacheWriteStatus = 'error';
                });
            }
        }

        incrementGatewayCounter('provider_request_success', {
            requestId,
            route,
            provider: actualProvider,
            model: actualModel,
        });
        logGatewayEvent('chat.response', {
            requestId,
            route,
            provider: actualProvider,
            model: actualModel,
            rateLimit: {
                status: rateLimitStatus,
            },
            semanticCache: {
                read: semanticCacheReadStatus,
                write: semanticCacheWriteStatus,
            },
            embedding: {
                dimensions: semanticEmbeddingForSave?.length ?? null,
            },
            response: {
                status: 200,
            },
        });

        const finalResponse = NextResponse.json(responseBody);
        if (cacheEligible) {
            finalResponse.headers.set('X-Cencori-Cache', 'MISS');
        }
        return finalResponse;

    } catch (error: unknown) {
        console.error('[API] Error:', error);
        const providerFailure = mapProviderErrorToHttpResponse(error);
        const status = providerFailure.status;

        if (providerFailure.provider) {
            incrementGatewayCounter('provider_request_failure', {
                requestId,
                route,
                provider: providerFailure.provider,
                status,
            });
        }
        logGatewayEvent('chat.response', {
            requestId,
            route,
            rateLimit: {
                status: rateLimitStatus,
            },
            semanticCache: {
                read: semanticCacheReadStatus,
                write: semanticCacheWriteStatus,
            },
            response: {
                status,
            },
            error: providerFailure.error,
            message: providerFailure.message,
        }, status >= 500 ? 'error' : 'warn');
        return NextResponse.json(
            {
                error: providerFailure.error,
                message: providerFailure.message,
                ...(providerFailure.retryAfter ? { retry_after: providerFailure.retryAfter } : {}),
                ...(providerFailure.provider ? { provider: providerFailure.provider } : {}),
            },
            { status }
        );
    }
}
