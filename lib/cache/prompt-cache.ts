import { Redis } from '@upstash/redis';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { generateEmbedding } from './embeddings';
import { DEFAULT_CACHE_CONFIG } from './types';
import type { CacheConfig, CacheLookupResult, CacheStoreParams } from './types';
import crypto from 'crypto';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const REDIS_PREFIX = 'pcache:';

// ---- Cache Key ----

export function computeExactCacheKey(params: {
    projectId: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    messages: Array<{ role: string; content: string }>;
}): string {
    const normalized = JSON.stringify({
        p: params.projectId,
        m: params.model,
        t: params.temperature ?? 0,
        mt: params.maxTokens ?? null,
        msgs: params.messages.map(msg => ({
            r: msg.role,
            c: msg.content.trim(),
        })),
    });
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ---- Config ----

export async function getProjectCacheConfig(projectId: string): Promise<CacheConfig> {
    try {
        const supabase = createAdminClient();
        const { data } = await supabase
            .from('prompt_cache_settings')
            .select('*')
            .eq('project_id', projectId)
            .single();

        if (!data) return DEFAULT_CACHE_CONFIG;

        return {
            cacheEnabled: data.cache_enabled,
            exactMatchEnabled: data.exact_match_enabled,
            semanticMatchEnabled: data.semantic_match_enabled,
            ttlSeconds: data.ttl_seconds,
            similarityThreshold: data.similarity_threshold,
            maxEntries: data.max_entries,
            excludedModels: data.excluded_models || [],
            maxCacheableTemperature: data.max_cacheable_temperature,
        };
    } catch {
        return DEFAULT_CACHE_CONFIG;
    }
}

// ---- Lookup ----

export async function lookupCache(params: {
    projectId: string;
    cacheKey: string;
    promptText: string;
    model: string;
    config: CacheConfig;
}): Promise<CacheLookupResult> {
    const { projectId, cacheKey, promptText, model, config } = params;
    const miss: CacheLookupResult = { hit: false, hitType: null, response: null, entryId: null, similarityScore: null, embedding: null };

    // 1. Exact match via Redis
    if (config.exactMatchEnabled) {
        try {
            const cached = await redis.get<string>(`${REDIS_PREFIX}${cacheKey}`);
            if (cached) {
                // Look up entry ID for hit tracking
                const supabase = createAdminClient();
                const { data: entry } = await supabase
                    .from('prompt_cache_entries')
                    .select('id, tokens_saved, cost_saved_usd')
                    .eq('project_id', projectId)
                    .eq('cache_key', cacheKey)
                    .single();

                const response = typeof cached === 'string' ? JSON.parse(cached) : cached;

                return {
                    hit: true,
                    hitType: 'exact',
                    response,
                    entryId: entry?.id || null,
                    similarityScore: 1.0,
                    embedding: null,
                };
            }
        } catch (error) {
            console.error('[Cache] Redis exact lookup failed:', error);
        }
    }

    // 2. Semantic match via pgvector
    if (config.semanticMatchEnabled) {
        try {
            const embedding = await generateEmbedding(promptText);
            if (embedding) {
                const supabase = createAdminClient();
                const { data: matches } = await supabase.rpc('match_prompt_cache', {
                    p_project_id: projectId,
                    query_embedding: JSON.stringify(embedding),
                    match_threshold: config.similarityThreshold,
                    match_count: 1,
                });

                if (matches && matches.length > 0) {
                    const best = matches[0];
                    return {
                        hit: true,
                        hitType: 'semantic',
                        response: best.response,
                        entryId: best.id,
                        similarityScore: best.similarity,
                        embedding,
                    };
                }

                // Return embedding so caller can reuse it for store
                return { ...miss, embedding };
            }
        } catch (error) {
            console.error('[Cache] Semantic lookup failed:', error);
        }
    }

    return miss;
}

// ---- Store ----

export async function storeInCache(params: CacheStoreParams): Promise<void> {
    const {
        projectId, cacheKey, promptText, model,
        temperature, maxTokens, response, embedding,
        ttlSeconds, estimatedTokens, estimatedCostUsd,
    } = params;

    try {
        // 1. Redis exact-match store
        await redis.set(
            `${REDIS_PREFIX}${cacheKey}`,
            JSON.stringify(response),
            { ex: ttlSeconds }
        );

        // 2. Supabase persistent store
        const supabase = createAdminClient();
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

        await supabase
            .from('prompt_cache_entries')
            .upsert({
                project_id: projectId,
                cache_key: cacheKey,
                prompt_text: promptText,
                model,
                temperature: temperature ?? 0,
                max_tokens: maxTokens ?? null,
                response,
                embedding: embedding ? JSON.stringify(embedding) : null,
                expires_at: expiresAt,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'project_id,cache_key',
            });

        // 3. Log store event
        void logCacheEvent({
            projectId,
            entryId: null,
            eventType: 'store',
            model,
            tokensSaved: estimatedTokens,
            costSavedUsd: estimatedCostUsd,
        });
    } catch (error) {
        console.error('[Cache] Store failed:', error);
    }
}

// ---- Hit Tracking ----

export async function recordCacheHit(
    entryId: string,
    tokensSaved: number,
    costSaved: number,
): Promise<void> {
    try {
        const supabase = createAdminClient();
        await supabase.rpc('increment_cache_hit', {
            p_entry_id: entryId,
            p_tokens: tokensSaved,
            p_cost: costSaved,
        });
    } catch (error) {
        console.error('[Cache] Hit tracking failed:', error);
    }
}

// ---- Event Logging ----

export async function logCacheEvent(params: {
    projectId: string;
    entryId: string | null;
    eventType: 'hit_exact' | 'hit_semantic' | 'miss' | 'store' | 'evict' | 'invalidate';
    model?: string;
    similarityScore?: number;
    latencySavedMs?: number;
    tokensSaved?: number;
    costSavedUsd?: number;
    requestId?: string;
}): Promise<void> {
    try {
        const supabase = createAdminClient();
        await supabase.from('prompt_cache_events').insert({
            project_id: params.projectId,
            cache_entry_id: params.entryId,
            event_type: params.eventType,
            model: params.model,
            similarity_score: params.similarityScore,
            latency_saved_ms: params.latencySavedMs,
            tokens_saved: params.tokensSaved,
            cost_saved_usd: params.costSavedUsd,
            request_id: params.requestId,
        });
    } catch (error) {
        console.error('[Cache] Event logging failed:', error);
    }
}

// ---- Invalidation ----

export async function invalidateCache(params: {
    projectId: string;
    cacheKey?: string;
    model?: string;
    all?: boolean;
}): Promise<{ deletedCount: number }> {
    const supabase = createAdminClient();
    let query = supabase
        .from('prompt_cache_entries')
        .select('id, cache_key')
        .eq('project_id', params.projectId);

    if (params.cacheKey) {
        query = query.eq('cache_key', params.cacheKey);
    } else if (params.model) {
        query = query.eq('model', params.model);
    }

    const { data: entries } = await query;
    if (!entries || entries.length === 0) return { deletedCount: 0 };

    // Delete from Redis
    const redisKeys = entries.map(e => `${REDIS_PREFIX}${e.cache_key}`);
    try {
        await redis.del(...redisKeys);
    } catch (error) {
        console.error('[Cache] Redis invalidation failed:', error);
    }

    // Delete from Supabase
    const ids = entries.map(e => e.id);
    await supabase
        .from('prompt_cache_entries')
        .delete()
        .in('id', ids);

    // Log invalidation events
    await Promise.all(
        entries.map(e =>
            logCacheEvent({
                projectId: params.projectId,
                entryId: e.id,
                eventType: 'invalidate',
            })
        )
    );

    return { deletedCount: entries.length };
}
