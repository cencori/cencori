import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { SUPPORTED_PROVIDERS } from '@/lib/providers/config';
import { addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { extractGatewayCallerIdentity, logApiGatewayRequest } from '@/lib/api-gateway-logs';
import { extractCencoriApiKeyFromHeaders } from '@/lib/api-keys';

/**
 * GET /api/v1/models
 * 
 * Lists all available models through the Cencori gateway.
 * Dynamically derived from lib/providers/config.ts — always up to date.
 * 
 * Headers:
 *   Authorization: Bearer <api_key>
 * 
 * Returns:
 *   200: { object: "list", data: [...models] }
 *   401: { error: "..." }
 */

// Build models list once at module load from the provider config (single source of truth)
const MODELS = SUPPORTED_PROVIDERS.flatMap(provider =>
    provider.models.map(model => ({
        id: model.id,
        object: 'model' as const,
        created: Math.floor(Date.now() / 1000),
        owned_by: provider.id,
        name: model.name,
        type: model.type,
        context_window: model.contextWindow,
        description: model.description,
    }))
);

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const callerIdentity = extractGatewayCallerIdentity(req.headers);
    let apiLogContext: { projectId: string; apiKeyId: string; environment: string | null } | null = null;

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
            .select('id, project_id, environment')
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

    // Optional filtering by provider or type (Restored Feature)
    const url = new URL(req.url);
    const filterProvider = url.searchParams.get('provider');
    const filterType = url.searchParams.get('type');

    let filteredModels = MODELS;
    if (filterProvider) {
        filteredModels = filteredModels.filter(m => m.owned_by === filterProvider);
    }
    if (filterType) {
        filteredModels = filteredModels.filter(m => m.type === filterType);
    }

    return respond(
        NextResponse.json({
            object: 'list',
            data: filteredModels,
            providers: SUPPORTED_PROVIDERS.map(p => ({
                id: p.id,
                name: p.name,
                model_count: p.models.length,
            })),
        })
    );
}
