/**
 * Shared Gateway Middleware
 * 
 * Central validation layer for all AI Gateway endpoints.
 * Handles: auth, rate limiting, spend caps, usage tracking,
 * request ID, CORS, domain validation, and geo/IP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { geolocation, ipAddress } from '@vercel/functions';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkSpendCap } from '@/lib/budgets';
import { deductCredits } from '@/lib/credits';
import { extractCencoriApiKeyFromHeaders } from '@/lib/api-keys';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface GatewayContext {
    supabase: ReturnType<typeof createAdminClient>;
    projectId: string;
    organizationId: string;
    apiKeyId: string;
    environment: string;
    keyType: string;
    tier: string;
    requestId: string;
    startTime: number;
    clientIp: string;
    countryCode: string | null;
    projectName: string;
    defaultModel: string | null;
    defaultProvider: string | null;
}

export type GatewayValidationResult =
    | { success: true; context: GatewayContext }
    | { success: false; response: NextResponse };

export interface LogRequestParams {
    endpoint: string;
    model: string;
    provider: string;
    status: 'success' | 'error' | 'filtered' | 'blocked' | 'success_fallback';
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costUsd?: number;
    providerCostUsd?: number;
    cencoriChargeUsd?: number;
    markupPercentage?: number;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    endUserId?: string;
    fallbackProvider?: string;
    fallbackModel?: string;
}

// ──────────────────────────────────────────────
// Domain Validation
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// IP / Geolocation
// ──────────────────────────────────────────────

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
            // Fall through to fallback
        }

        const fallbackResponse = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, {
            signal: AbortSignal.timeout(3000),
            headers: { 'Accept': 'text/plain' },
        });
        if (fallbackResponse.ok) {
            const countryCode = (await fallbackResponse.text()).trim();
            if (countryCode && countryCode.length === 2) {
                return countryCode.toUpperCase();
            }
        }

        return null;
    } catch {
        return null;
    }
}

// ──────────────────────────────────────────────
// Main Validation
// ──────────────────────────────────────────────

/**
 * Validate a gateway request: auth, rate limit, spend cap, domain, geo.
 * Call this at the top of every AI endpoint POST handler.
 */
export async function validateGatewayRequest(req: NextRequest): Promise<GatewayValidationResult> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const supabase = createAdminClient();

    // ── Extract IP / Geo ──
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

    // ── Extract API Key ──
    const apiKey = extractCencoriApiKeyFromHeaders(req.headers);

    if (!apiKey) {
        return {
            success: false,
            response: addGatewayHeaders(
                NextResponse.json(
                    { error: 'Missing API key. Provide CENCORI_API_KEY header or Authorization: Bearer <key>' },
                    { status: 401 }
                ),
                { requestId }
            ),
        };
    }

    // ── Look up key ──
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

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
                name,
                organization_id,
                default_model,
                default_provider,
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
        return {
            success: false,
            response: addGatewayHeaders(
                NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
                { requestId }
            ),
        };
    }

    // ── Domain validation for publishable keys ──
    if (keyData.key_type === 'publishable') {
        const origin = req.headers.get('origin') || req.headers.get('referer');
        const allowedDomains = keyData.allowed_domains as string[] | null;

        if (!validateDomain(origin, allowedDomains)) {
            return {
                success: false,
                response: addGatewayHeaders(
                    NextResponse.json(
                        { error: 'Domain not allowed for this API key' },
                        { status: 403 }
                    ),
                    { requestId }
                ),
            };
        }
    }

    // ── Project & Org data ──
    const project = keyData.projects as unknown as {
        id: string;
        name: string;
        organization_id: string;
        default_model: string | null;
        default_provider: string | null;
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
        return {
            success: false,
            response: addGatewayHeaders(
                NextResponse.json(
                    {
                        error: 'Billing account frozen',
                        message: 'Billing is currently frozen for this organization. Contact support.',
                    },
                    { status: 403 }
                ),
                { requestId }
            ),
        };
    }

    if (shouldEnforceCredits && creditsBalance <= 0) {
        return {
            success: false,
            response: addGatewayHeaders(
                NextResponse.json(
                    {
                        error: 'Credit balance exhausted',
                        message: 'Your organization has run out of credits. Top up to continue.',
                        balance: 0,
                        top_up_url: '/dashboard/organizations',
                    },
                    { status: 403 }
                ),
                { requestId }
            ),
        };
    }

    // ── Monthly limit check ──
    const currentUsage = organization.monthly_requests_used || 0;
    const limit = organization.monthly_request_limit || 1000;

    if (currentUsage >= limit) {
        return {
            success: false,
            response: addGatewayHeaders(
                NextResponse.json(
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
                ),
                { requestId }
            ),
        };
    }

    // ── Per-minute rate limit ──
    const rateLimitResult = await checkRateLimit(project.id);

    if (!rateLimitResult.success) {
        return {
            success: false,
            response: addGatewayHeaders(
                NextResponse.json(
                    {
                        error: 'Rate limit exceeded',
                        message: `${rateLimitResult.limit} requests per minute allowed. Try again shortly.`,
                        retry_after_ms: rateLimitResult.reset - Date.now(),
                    },
                    { status: 429 }
                ),
                { requestId, rateLimit: rateLimitResult }
            ),
        };
    }

    // ── Spend cap check ──
    const spendCapResult = await checkSpendCap(project.id);
    if (!spendCapResult.allowed) {
        return {
            success: false,
            response: addGatewayHeaders(
                NextResponse.json(
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
                ),
                { requestId }
            ),
        };
    }

    // ── Build context ──
    const context: GatewayContext = {
        supabase,
        projectId: project.id,
        organizationId,
        apiKeyId: keyData.id,
        environment: keyData.environment || 'production',
        keyType: keyData.key_type || 'secret',
        tier,
        requestId,
        startTime,
        clientIp,
        countryCode,
        projectName: project.name,
        defaultModel: project.default_model,
        defaultProvider: project.default_provider,
    };

    return { success: true, context };
}

// ──────────────────────────────────────────────
// Response Headers
// ──────────────────────────────────────────────

interface HeaderOptions {
    requestId: string;
    rateLimit?: {
        limit: number;
        remaining: number;
        reset: number;
    };
}

/**
 * Add standard gateway headers to every response:
 * request ID, rate limit info, and CORS.
 */
export function addGatewayHeaders(response: NextResponse, options: HeaderOptions): NextResponse {
    // Request ID
    response.headers.set('X-Request-Id', options.requestId);

    // Rate limit headers
    if (options.rateLimit) {
        response.headers.set('X-RateLimit-Limit', String(options.rateLimit.limit));
        response.headers.set('X-RateLimit-Remaining', String(options.rateLimit.remaining));
        response.headers.set('X-RateLimit-Reset', String(options.rateLimit.reset));
    }

    // CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, CENCORI_API_KEY, X-Cencori-User-IP, X-Cencori-User-Country, X-Cencori-Prompt, X-Cencori-Prompt-Vars');
    response.headers.set('Access-Control-Expose-Headers', 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Cache, X-Cache-Similarity');

    return response;
}

/**
 * Create a standard OPTIONS response for CORS preflight.
 */
export function handleCorsPreFlight(): NextResponse {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, CENCORI_API_KEY, X-Cencori-User-IP, X-Cencori-User-Country, X-Cencori-Prompt, X-Cencori-Prompt-Vars');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
}

// ──────────────────────────────────────────────
// Logging
// ──────────────────────────────────────────────

/**
 * Log a request to the ai_requests table with full cost tracking.
 */
export async function logGatewayRequest(context: GatewayContext, params: LogRequestParams): Promise<void> {
    const latencyMs = Date.now() - context.startTime;

    try {
        await context.supabase.from('ai_requests').insert({
            project_id: context.projectId,
            api_key_id: context.apiKeyId,
            environment: context.environment === 'test' ? 'test' : 'production',
            endpoint: params.endpoint,
            model: params.model,
            provider: params.provider,
            status: params.status,
            prompt_tokens: params.promptTokens || 0,
            completion_tokens: params.completionTokens || 0,
            total_tokens: params.totalTokens || 0,
            cost_usd: params.costUsd || 0,
            provider_cost_usd: params.providerCostUsd || 0,
            cencori_charge_usd: params.cencoriChargeUsd || 0,
            markup_percentage: params.markupPercentage || 0,
            latency_ms: latencyMs,
            ip_address: context.clientIp,
            country_code: context.countryCode,
            end_user_id: params.endUserId,
            error_message: params.errorMessage,
            metadata: params.metadata || {},
            request_id: context.requestId,
            fallback_provider: params.fallbackProvider,
            fallback_model: params.fallbackModel,
        });
    } catch (error) {
        console.error(`[Gateway] Failed to log request ${context.requestId}:`, error);
    }
}

async function chargeCreditsForRequest(context: GatewayContext): Promise<void> {
    // Free and enterprise tiers are not credit-gated by default.
    if (context.tier === 'free' || context.tier === 'enterprise') {
        return;
    }

    const { data: requestLog, error: requestLogError } = await context.supabase
        .from('ai_requests')
        .select('id, endpoint, cencori_charge_usd')
        .eq('request_id', context.requestId)
        .maybeSingle();

    if (requestLogError || !requestLog) {
        if (requestLogError) {
            console.warn(`[Gateway] Failed to load request log for credit charge (${context.requestId}):`, requestLogError.message);
        }
        return;
    }

    const amount = Number(requestLog.cencori_charge_usd ?? 0);
    if (!(amount > 0)) {
        return;
    }

    // Idempotency guard: avoid duplicate charges for the same request log row.
    const { data: existingCharge, error: existingChargeError } = await context.supabase
        .from('credit_transactions')
        .select('id')
        .eq('organization_id', context.organizationId)
        .eq('transaction_type', 'usage')
        .eq('reference_id', requestLog.id)
        .maybeSingle();

    if (existingChargeError) {
        console.warn(`[Gateway] Failed to check existing credit charge (${context.requestId}):`, existingChargeError.message);
    }

    if (existingCharge?.id) {
        return;
    }

    const description = `Usage charge: ${requestLog.endpoint || 'gateway'}`;
    const charged = await deductCredits(context.organizationId, amount, description, requestLog.id);
    if (!charged) {
        console.warn(`[Gateway] Credit deduction failed for request ${context.requestId}. org=${context.organizationId} amount=${amount}`);
    }
}

/**
 * Increment the monthly usage counter for the organization.
 * Called after a successful request.
 */
export async function incrementUsage(context: GatewayContext): Promise<void> {
    try {
        await chargeCreditsForRequest(context);

        // Try RPC first (atomic increment)
        const { error } = await context.supabase.rpc('increment_monthly_usage', {
            org_id: context.organizationId,
        });

        if (error) {
            // Fallback: read-then-write (less safe but works without RPC)
            const { data } = await context.supabase
                .from('organizations')
                .select('monthly_requests_used')
                .eq('id', context.organizationId)
                .single();

            if (data) {
                await context.supabase
                    .from('organizations')
                    .update({ monthly_requests_used: (data.monthly_requests_used || 0) + 1 })
                    .eq('id', context.organizationId);
            }
        }
    } catch (error) {
        console.error('[Gateway] Failed to increment usage:', error);
    }
}
