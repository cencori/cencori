import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { extractGatewayCallerIdentity, logApiGatewayRequest } from '@/lib/api-gateway-logs';
import { extractCencoriApiKeyFromHeaders } from '@/lib/api-keys';
import { buildUnifiedModelRegistry } from '@/lib/embedded/model-registry';
import type { ModelSource } from '@/lib/embedded/types';

/**
 * GET /api/v1/models — single unified model registry (M0 ADR-002).
 *
 * Returns Cencori-managed + project BYOK/synced/custom models with per-project
 * availability metadata. Filters narrow the registry; no second catalog endpoint.
 *
 * Query: ?provider= ?type= ?available=true ?source=cencori|byok|custom ?connection_id=prc_123
 * Callers needing legacy callable-only behavior use ?available=true.
 */

/**
 * `created` is resolved per request from the model's pricing row rather than
 * baked in here: evaluating Date.now() at module load stamps every model with
 * the server's boot time, so the same model reports a different `created` from
 * each serverless instance and the value drifts on every deploy. The pricing
 * row's created_at is the closest real answer — when the model became
 * available on Cencori — and it is stable across instances and deploys.
 * (Registry assembly now lives in lib/embedded/model-registry.ts.)
 */

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const callerIdentity = extractGatewayCallerIdentity(req.headers);
    let apiLogContext: { projectId: string; apiKeyId: string; environment: string | null } | null = null;
    let apiKeyModelAccess: { allowedModels: string[] | null; sponsoredModels: string[] | null } = {
        allowedModels: null,
        sponsoredModels: null,
    };

    const respond = (response: NextResponse, errorCode?: string, errorMessage?: string) => {
        if (apiLogContext) {
            const forwardedFor = req.headers.get('x-forwarded-for');
            const clientIp = forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip');

            void logApiGatewayRequest({
                projectId: apiLogContext.projectId,
                apiKeyId: apiLogContext.apiKeyId,
                requestId,
                endpoint: '/v1/models',
                method: 'GET',
                statusCode: response.status,
                startedAt,
                environment: apiLogContext.environment,
                ipAddress: clientIp,
                countryCode: req.headers.get('x-vercel-ip-country') || req.headers.get('x-cencori-user-country'),
                userAgent: req.headers.get('user-agent'),
                callerOrigin: callerIdentity.callerOrigin,
                clientApp: callerIdentity.clientApp,
                errorCode: errorCode || null,
                errorMessage: errorMessage || null,
            });
        }

        return addGatewayHeaders(response, { requestId });
    };

    // 1. Try API Key Auth (Legacy/External)
    const authHeader = req.headers.get('Authorization');
    const apiKey = extractCencoriApiKeyFromHeaders(req.headers);

    let isAuthenticated = false;

    if (apiKey) {
        // Validate API key
        const supabase = createAdminClient();
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select('id, project_id, environment, allowed_models, sponsored_models')
            .eq('key_hash', keyHash)
            .is('revoked_at', null)
            .single();

        if (keyError || !keyData) {
            return respond(
                NextResponse.json({
                    error: {
                        message: 'Invalid API key',
                        type: 'invalid_request_error',
                        code: 'invalid_api_key'
                    }
                }, { status: 401 }),
                'invalid_api_key',
                'Invalid API key'
            );
        }

        apiLogContext = {
            projectId: keyData.project_id,
            apiKeyId: keyData.id,
            environment: keyData.environment || null,
        };
        apiKeyModelAccess = {
            allowedModels: Array.isArray(keyData.allowed_models) ? keyData.allowed_models : null,
            sponsoredModels: Array.isArray(keyData.sponsored_models) ? keyData.sponsored_models : null,
        };

        isAuthenticated = true;
    } else if (authHeader) {
        // 2. Try User Session Auth (OpenClaw Gateway)
        // If no recognized API key was provided, assume the bearer token is a Supabase JWT.
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (!authError && user) {
            isAuthenticated = true;
        }
    }

    if (!isAuthenticated) {
        // 3. Unauthorized
        return respond(
            NextResponse.json({
                error: {
                    message: 'Missing API key or valid session. Use Authorization: Bearer <key>',
                    type: 'invalid_request_error',
                    code: 'missing_api_key'
                }
            }, { status: 401 }),
            'missing_api_key',
            'Missing API key or valid session'
        );
    }

    const url = new URL(req.url);
    const filterProvider = url.searchParams.get('provider');
    const filterType = url.searchParams.get('type');
    const availableParam = url.searchParams.get('available');
    const sourceParam = url.searchParams.get('source') as ModelSource | null;
    const connectionParam = url.searchParams.get('connection_id');

    const registry = await buildUnifiedModelRegistry(createAdminClient() as never, {
        projectId: apiLogContext?.projectId ?? null,
        keyAccess: apiKeyModelAccess,
        query: {
            provider: filterProvider,
            type: filterType,
            available: availableParam === 'true' ? true : availableParam === 'false' ? false : null,
            source: sourceParam === 'cencori' || sourceParam === 'byok' || sourceParam === 'custom' ? sourceParam : null,
            connectionId: connectionParam,
        },
    });

    return respond(
        NextResponse.json({
            object: 'list',
            data: registry.models.map((m) => ({
                id: m.id,
                object: 'model',
                created: m.created,
                owned_by: m.owned_by,
                name: m.name,
                // Backward compat: legacy `type` (first capability) + canonical `types`.
                type: m.types[0] ?? 'chat',
                types: m.types,
                context_window: m.context_window,
                description: m.description,
                // Unified registry extensions (additive).
                provider: m.provider,
                source: m.source,
                connection_id: m.connection_id,
                status: m.status,
                available: m.available,
                unavailable_reason: m.unavailable_reason,
                reasoning_supported: m.reasoning_supported,
                byok_supported: m.byok_supported,
                managed_access: m.managed_access,
                pricing_status: m.pricing_status,
                pricing: m.pricing ?? undefined,
            })),
            providers: registry.providers.map((p) => ({
                id: p.id,
                name: p.name,
                supports_byok: p.supports_byok,
                connection_status: p.connection_status,
                model_count: p.model_count,
            })),
        })
    );
}
