import { Redis } from '@upstash/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
    getGatewayFeatureFlags,
    incrementGatewayCounter,
    logGatewayEvent,
    serializeError,
} from '@/lib/gateway-reliability';
import { getGoogleApiKey } from '@/lib/providers/google-env';

let redis: Redis | null | undefined;
let supabaseClient: ReturnType<typeof createClient> | null | undefined;

const DEFAULT_TTL = 3600; // 1 hour
const SEMANTIC_EMBEDDING_MODEL = 'text-embedding-004';

interface CacheKeyParams {
    projectId: string;
    model: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
}

export interface SemanticCacheTelemetry {
    requestId?: string;
    route?: string;
    provider?: string;
    model?: string;
    responseStatus?: number;
    namespace?: string;
}

export interface SemanticCacheLookupResult {
    response: unknown | null;
    embedding: number[] | null;
    status: 'hit' | 'miss' | 'error' | 'disabled';
    embeddingDimensions: number | null;
    errorMessage?: string;
    reason?: string;
}

export interface SemanticCacheWriteResult {
    status: 'ok' | 'skipped' | 'error' | 'disabled';
    embeddingDimensions: number | null;
    errorMessage?: string;
    reason?: string;
}

function getRedisClient(): Redis | null {
    if (redis !== undefined) {
        return redis;
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        redis = null;
        return redis;
    }

    redis = new Redis({ url, token });
    return redis;
}

function getSupabaseClient(): ReturnType<typeof createClient> | null {
    if (supabaseClient !== undefined) {
        return supabaseClient;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        supabaseClient = null;
        return supabaseClient;
    }

    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    return supabaseClient;
}

function getEmbeddingModel(apiKey?: string) {
    const key = apiKey || getGoogleApiKey();
    if (!key) {
        throw new Error('No Google API key provided for semantic cache');
    }

    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: SEMANTIC_EMBEDDING_MODEL });
}

function getMockEmbedding(prompt: string, dimensions: number): number[] {
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
        hash = ((hash << 5) - hash) + prompt.charCodeAt(i);
        hash |= 0;
    }

    return Array.from({ length: dimensions }, (_, i) => (Math.sin(hash + i) + 1) / 2);
}

async function generateSemanticEmbedding(
    prompt: string,
    apiKey: string | undefined,
    telemetry?: SemanticCacheTelemetry
): Promise<{ embedding: number[] | null; dimensions: number | null; errorMessage?: string; reason?: string }> {
    const expectedDimensions = getGatewayFeatureFlags().semanticCacheExpectedDimensions;

    try {
        let values: number[];

        if (process.env.MOCK_EMBEDDINGS === 'true') {
            values = getMockEmbedding(prompt, expectedDimensions);
        } else {
            const embeddingModel = getEmbeddingModel(apiKey);
            const result = await embeddingModel.embedContent(prompt);
            values = result.embedding.values;
        }

        const actualDimensions = Array.isArray(values) ? values.length : 0;
        if (!Array.isArray(values) || actualDimensions !== expectedDimensions) {
            incrementGatewayCounter('semantic_cache.dimension_mismatch', {
                requestId: telemetry?.requestId,
                route: telemetry?.route,
                provider: telemetry?.provider,
                model: telemetry?.model,
                expectedDimensions,
                actualDimensions,
            });

            logGatewayEvent(
                'semantic_cache.dimension_mismatch',
                {
                    requestId: telemetry?.requestId,
                    route: telemetry?.route,
                    provider: telemetry?.provider,
                    model: telemetry?.model,
                    embedding: {
                        dimensions: actualDimensions,
                        expectedDimensions,
                    },
                    semanticCache: {
                        status: 'skipped',
                    },
                },
                'warn'
            );

            return {
                embedding: null,
                dimensions: actualDimensions,
                errorMessage: `Expected ${expectedDimensions} dimensions but received ${actualDimensions}`,
                reason: 'dimension_mismatch',
            };
        }

        return {
            embedding: values,
            dimensions: actualDimensions,
        };
    } catch (error) {
        return {
            embedding: null,
            dimensions: null,
            errorMessage: error instanceof Error ? error.message : String(error),
            reason: 'embedding_generation_failed',
        };
    }
}

function logSemanticCacheRead(
    status: SemanticCacheLookupResult['status'],
    telemetry?: SemanticCacheTelemetry,
    extras: Record<string, unknown> = {},
    level: 'info' | 'warn' = 'info'
): void {
    logGatewayEvent(
        'semantic_cache.read',
        {
            requestId: telemetry?.requestId,
            route: telemetry?.route,
            provider: telemetry?.provider,
            model: telemetry?.model,
            semanticCache: {
                read: status,
            },
            response: {
                status: telemetry?.responseStatus,
            },
            ...extras,
        },
        level
    );
}

function logSemanticCacheWrite(
    status: SemanticCacheWriteResult['status'],
    telemetry?: SemanticCacheTelemetry,
    extras: Record<string, unknown> = {},
    level: 'info' | 'warn' = 'info'
): void {
    logGatewayEvent(
        'semantic_cache.write',
        {
            requestId: telemetry?.requestId,
            route: telemetry?.route,
            provider: telemetry?.provider,
            model: telemetry?.model,
            semanticCache: {
                write: status,
            },
            response: {
                status: telemetry?.responseStatus,
            },
            ...extras,
        },
        level
    );
}

// --- Exact Match Caching (Legacy) ---

export function computeCacheKey(params: CacheKeyParams): string {
    const data = JSON.stringify({
        p: params.projectId,
        m: params.model,
        t: params.temperature || 0,
        mx: params.maxTokens || 0,
        pr: params.prompt.trim(),
    });

    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return `cache:completion:${hash}`;
}

export async function getCache(key: string): Promise<unknown | null> {
    const client = getRedisClient();
    if (!client) {
        return null;
    }

    try {
        const data = await client.get(key);
        return data as unknown;
    } catch (error) {
        console.warn('[Cache] Get failed:', error);
        return null;
    }
}

export async function saveCache(key: string, data: unknown, ttl: number = DEFAULT_TTL): Promise<void> {
    const client = getRedisClient();
    if (!client) {
        return;
    }

    try {
        await client.set(key, JSON.stringify(data), { ex: ttl });
    } catch (error) {
        console.warn('[Cache] Save failed:', error);
    }
}

// --- Vector Semantic Caching (Supabase pgvector) ---

export async function getSemanticCache(
    prompt: string,
    apiKey?: string,
    threshold = 0.95,
    telemetry?: SemanticCacheTelemetry
): Promise<SemanticCacheLookupResult> {
    const flags = getGatewayFeatureFlags();
    if (!flags.semanticCacheEnabled) {
        logSemanticCacheRead('disabled', telemetry);
        return {
            response: null,
            embedding: null,
            status: 'disabled',
            embeddingDimensions: null,
            reason: 'feature_disabled',
        };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        incrementGatewayCounter('semantic_cache.read_error', {
            requestId: telemetry?.requestId,
            route: telemetry?.route,
            provider: telemetry?.provider,
            model: telemetry?.model,
        });
        logSemanticCacheRead(
            'error',
            telemetry,
            {
                reason: 'missing_supabase_config',
            },
            'warn'
        );
        return {
            response: null,
            embedding: null,
            status: 'error',
            embeddingDimensions: null,
            errorMessage: 'Semantic cache is not configured',
            reason: 'missing_supabase_config',
        };
    }

    const embeddingResult = await generateSemanticEmbedding(prompt, apiKey, telemetry);
    if (!embeddingResult.embedding) {
        if (embeddingResult.reason === 'dimension_mismatch') {
            logSemanticCacheRead(
                'error',
                telemetry,
                {
                    reason: embeddingResult.reason,
                    embedding: {
                        dimensions: embeddingResult.dimensions,
                        expectedDimensions: flags.semanticCacheExpectedDimensions,
                    },
                },
                'warn'
            );
            return {
                response: null,
                embedding: null,
                status: 'error',
                embeddingDimensions: embeddingResult.dimensions,
                errorMessage: embeddingResult.errorMessage,
                reason: embeddingResult.reason,
            };
        }

        incrementGatewayCounter('semantic_cache.read_error', {
            requestId: telemetry?.requestId,
            route: telemetry?.route,
            provider: telemetry?.provider,
            model: telemetry?.model,
        });
        logSemanticCacheRead(
            'error',
            telemetry,
            {
                reason: embeddingResult.reason,
                errorMessage: embeddingResult.errorMessage,
            },
            'warn'
        );
        return {
            response: null,
            embedding: null,
            status: 'error',
            embeddingDimensions: embeddingResult.dimensions,
            errorMessage: embeddingResult.errorMessage,
            reason: embeddingResult.reason,
        };
    }

    try {
        const rpcClient = supabase as unknown as {
            rpc: (
                fn: string,
                args: Record<string, unknown>
            ) => Promise<{ data: unknown; error: { message?: string } | null }>;
        };
        const rpcResult = await rpcClient.rpc('match_semantic_cache', {
            query_embedding: embeddingResult.embedding,
            match_threshold: threshold,
            match_count: 1,
        });
        const error = rpcResult?.error as { message?: string } | null | undefined;
        const matches = Array.isArray(rpcResult?.data)
            ? rpcResult.data as Array<{ response: unknown }>
            : [];

        if (error) {
            incrementGatewayCounter('semantic_cache.read_error', {
                requestId: telemetry?.requestId,
                route: telemetry?.route,
                provider: telemetry?.provider,
                model: telemetry?.model,
            });
            logSemanticCacheRead(
                'error',
                telemetry,
                {
                    embedding: {
                        dimensions: embeddingResult.dimensions,
                    },
                    error: error.message,
                },
                'warn'
            );
            return {
                response: null,
                embedding: embeddingResult.embedding,
                status: 'error',
                embeddingDimensions: embeddingResult.dimensions,
                errorMessage: error.message,
                reason: 'rpc_error',
            };
        }

        if (matches && matches.length > 0) {
            logSemanticCacheRead('hit', telemetry, {
                embedding: {
                    dimensions: embeddingResult.dimensions,
                },
            });
            return {
                response: matches[0].response,
                embedding: embeddingResult.embedding,
                status: 'hit',
                embeddingDimensions: embeddingResult.dimensions,
            };
        }

        logSemanticCacheRead('miss', telemetry, {
            embedding: {
                dimensions: embeddingResult.dimensions,
            },
        });
        return {
            response: null,
            embedding: embeddingResult.embedding,
            status: 'miss',
            embeddingDimensions: embeddingResult.dimensions,
        };
    } catch (error) {
        incrementGatewayCounter('semantic_cache.read_error', {
            requestId: telemetry?.requestId,
            route: telemetry?.route,
            provider: telemetry?.provider,
            model: telemetry?.model,
        });
        logSemanticCacheRead(
            'error',
            telemetry,
            {
                embedding: {
                    dimensions: embeddingResult.dimensions,
                },
                error: serializeError(error),
            },
            'warn'
        );
        return {
            response: null,
            embedding: embeddingResult.embedding,
            status: 'error',
            embeddingDimensions: embeddingResult.dimensions,
            errorMessage: error instanceof Error ? error.message : String(error),
            reason: 'unexpected_error',
        };
    }
}

export async function saveSemanticCache(
    prompt: string,
    response: unknown,
    apiKey?: string,
    embedding?: number[],
    telemetry?: SemanticCacheTelemetry
): Promise<SemanticCacheWriteResult> {
    const flags = getGatewayFeatureFlags();
    if (!flags.semanticCacheEnabled) {
        logSemanticCacheWrite('disabled', telemetry);
        return {
            status: 'disabled',
            embeddingDimensions: null,
            reason: 'feature_disabled',
        };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        logSemanticCacheWrite(
            'skipped',
            telemetry,
            {
                reason: 'missing_supabase_config',
            },
            'warn'
        );
        return {
            status: 'skipped',
            embeddingDimensions: null,
            reason: 'missing_supabase_config',
            errorMessage: 'Semantic cache is not configured',
        };
    }

    let vector = embedding;
    let embeddingDimensions = Array.isArray(vector) ? vector.length : null;

    if (!vector) {
        const embeddingResult = await generateSemanticEmbedding(prompt, apiKey, telemetry);
        vector = embeddingResult.embedding ?? undefined;
        embeddingDimensions = embeddingResult.dimensions;

        if (!vector) {
            if (embeddingResult.reason === 'dimension_mismatch') {
                return {
                    status: 'skipped',
                    embeddingDimensions,
                    errorMessage: embeddingResult.errorMessage,
                    reason: embeddingResult.reason,
                };
            }

            incrementGatewayCounter('semantic_cache.write_error', {
                requestId: telemetry?.requestId,
                route: telemetry?.route,
                provider: telemetry?.provider,
                model: telemetry?.model,
            });
            logSemanticCacheWrite(
                'error',
                telemetry,
                {
                    reason: embeddingResult.reason,
                    errorMessage: embeddingResult.errorMessage,
                },
                'warn'
            );
            return {
                status: 'error',
                embeddingDimensions,
                errorMessage: embeddingResult.errorMessage,
                reason: embeddingResult.reason,
            };
        }
    }

    if (vector.length !== flags.semanticCacheExpectedDimensions) {
        incrementGatewayCounter('semantic_cache.dimension_mismatch', {
            requestId: telemetry?.requestId,
            route: telemetry?.route,
            provider: telemetry?.provider,
            model: telemetry?.model,
            expectedDimensions: flags.semanticCacheExpectedDimensions,
            actualDimensions: vector.length,
        });
        logSemanticCacheWrite(
            'skipped',
            telemetry,
            {
                reason: 'dimension_mismatch',
                embedding: {
                    dimensions: vector.length,
                    expectedDimensions: flags.semanticCacheExpectedDimensions,
                },
            },
            'warn'
        );
        return {
            status: 'skipped',
            embeddingDimensions: vector.length,
            errorMessage: `Expected ${flags.semanticCacheExpectedDimensions} dimensions but received ${vector.length}`,
            reason: 'dimension_mismatch',
        };
    }

    try {
        const semanticCacheTable = supabase as unknown as {
            from: (
                table: string
            ) => {
                upsert: (
                    values: Record<string, unknown>,
                    options?: { onConflict?: string }
                ) => Promise<{ error: { message?: string } | null }>;
            };
        };
        const { error } = await semanticCacheTable
            .from('semantic_cache')
            .upsert(
                {
                    prompt,
                    response,
                    embedding: vector,
                },
                { onConflict: 'prompt' }
            );

        if (error) {
            incrementGatewayCounter('semantic_cache.write_error', {
                requestId: telemetry?.requestId,
                route: telemetry?.route,
                provider: telemetry?.provider,
                model: telemetry?.model,
            });
            logSemanticCacheWrite(
                'error',
                telemetry,
                {
                    embedding: {
                        dimensions: vector.length,
                    },
                    error: error.message,
                },
                'warn'
            );
            return {
                status: 'error',
                embeddingDimensions: vector.length,
                errorMessage: error.message,
                reason: 'upsert_error',
            };
        }

        logSemanticCacheWrite('ok', telemetry, {
            embedding: {
                dimensions: vector.length,
            },
        });
        return {
            status: 'ok',
            embeddingDimensions: vector.length,
        };
    } catch (error) {
        incrementGatewayCounter('semantic_cache.write_error', {
            requestId: telemetry?.requestId,
            route: telemetry?.route,
            provider: telemetry?.provider,
            model: telemetry?.model,
        });
        logSemanticCacheWrite(
            'error',
            telemetry,
            {
                embedding: {
                    dimensions: vector.length,
                },
                error: serializeError(error),
            },
            'warn'
        );
        return {
            status: 'error',
            embeddingDimensions: vector.length,
            errorMessage: error instanceof Error ? error.message : String(error),
            reason: 'unexpected_error',
        };
    }
}
