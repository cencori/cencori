import { Redis } from '@upstash/redis';

const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute

// Initialize Redis
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Timestamp when the window resets
}

export async function checkRateLimit(projectId: string): Promise<RateLimitResult> {
    const key = `rate_limit:${projectId}`;
    const now = Date.now();

    try {
        // Atomic increment
        const requests = await redis.incr(key);

        // Set expiration if it's a new key (first request)
        if (requests === 1) {
            await redis.expire(key, RATE_LIMIT_WINDOW);
        }

        // Get TTL to return accurate reset time
        const ttl = await redis.ttl(key);

        const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - requests);
        const reset = now + (ttl * 1000);

        return {
            success: requests <= MAX_REQUESTS_PER_WINDOW,
            limit: MAX_REQUESTS_PER_WINDOW,
            remaining,
            reset,
        };
    } catch (error) {
        console.error('[Rate Limit] Redis error:', error);
        // Fail open to avoid blocking users during outage
        return {
            success: true,
            limit: MAX_REQUESTS_PER_WINDOW,
            remaining: 1,
            reset: now + (RATE_LIMIT_WINDOW * 1000),
        };
    }
}
