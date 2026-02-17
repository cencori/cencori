
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

// Initialize Redis 
// (sharing the same instance as rate-limit, or new one - here we create new for modularity 
// but in a real app might want a singleton. For now, following pattern in rate-limit.ts)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DEFAULT_TTL = 3600; // 1 hour in seconds

interface CacheKeyParams {
    projectId: string;
    model: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
}

/**
 * Generate a deterministic cache key based on request parameters
 */
export function computeCacheKey(params: CacheKeyParams): string {
    const data = JSON.stringify({
        p: params.projectId,
        m: params.model,
        t: params.temperature || 0, // default temp
        mx: params.maxTokens || 0, // default max tokens
        pr: params.prompt.trim(),
    });

    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return `cache:completion:${hash}`;
}

/**
 * Retrieve cached response
 */
export async function getCache(key: string): Promise<any | null> {
    try {
        const data = await redis.get(key);
        return data ? data : null;
    } catch (error) {
        console.warn('[Cache] Get failed:', error);
        return null;
    }
}

/**
 * Save response to cache
 */
export async function saveCache(key: string, data: any, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
        await redis.set(key, JSON.stringify(data), { ex: ttl });
    } catch (error) {
        console.warn('[Cache] Save failed:', error);
    }
}
