/**
 * A small JSON cache shared by every server instance (Redis), for slow
 * third-party lookups that rarely change. Without Redis it does nothing and
 * callers fall back to their own memory cache.
 */

import { createRedisClient } from '@/lib/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? createRedisClient({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null;

export async function cacheGet<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
        return (await redis.get<T>(key)) ?? null;
    } catch {
        return null;
    }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!redis) return;
    try {
        await redis.set(key, value, { ex: ttlSeconds });
    } catch {
        // A cache that can't be written is only slower, never wrong.
    }
}

export async function cacheDelete(key: string): Promise<void> {
    if (!redis) return;
    try {
        await redis.del(key);
    } catch {
        // Expires on its own.
    }
}
