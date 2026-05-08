import { Redis } from '@upstash/redis';
import crypto from 'crypto';

let redis: Redis | null | undefined;

const DEFAULT_TTL = 3600; // 1 hour

interface CacheKeyParams {
    projectId: string;
    model: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
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
        return await client.get(key);
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
