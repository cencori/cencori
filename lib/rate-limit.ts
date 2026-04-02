import { Redis } from '@upstash/redis';
import {
    getGatewayFeatureFlags,
    incrementGatewayCounter,
    logGatewayEvent,
    serializeError,
} from '@/lib/gateway-reliability';

const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute

let redis: Redis | null | undefined;

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

export interface RateLimitResult {
    success: boolean;
    allowed: boolean;
    limit: number;
    remaining: number;
    reset: number; // Timestamp when the window resets
    status: 'ok' | 'skipped' | 'failed_open' | 'failed_closed';
    reason: 'allowed' | 'limit_exceeded' | 'disabled' | 'backend_unavailable';
    errorMessage?: string;
}

export interface RateLimitTelemetryContext {
    requestId?: string;
    route?: string;
}

function fallbackResult(
    now: number,
    status: 'failed_open' | 'failed_closed',
    error: unknown,
    context?: RateLimitTelemetryContext
): RateLimitResult {
    const flags = getGatewayFeatureFlags();
    const errorMessage = error instanceof Error ? error.message : String(error);

    incrementGatewayCounter('rate_limit.redis_unavailable', {
        requestId: context?.requestId,
        route: context?.route,
    });

    logGatewayEvent(
        'rate_limit.backend_unavailable',
        {
            requestId: context?.requestId,
            route: context?.route,
            rateLimit: {
                status,
                failOpen: flags.rateLimitFailOpen,
            },
            error: serializeError(error),
        },
        'warn'
    );

    return {
        success: status === 'failed_open',
        allowed: status === 'failed_open',
        limit: MAX_REQUESTS_PER_WINDOW,
        remaining: status === 'failed_open' ? MAX_REQUESTS_PER_WINDOW : 0,
        reset: now + (RATE_LIMIT_WINDOW * 1000),
        status,
        reason: 'backend_unavailable',
        errorMessage,
    };
}

export async function checkRateLimit(
    projectId: string,
    context?: RateLimitTelemetryContext
): Promise<RateLimitResult> {
    const key = `rate_limit:${projectId}`;
    const now = Date.now();
    const flags = getGatewayFeatureFlags();

    if (!flags.rateLimitEnabled) {
        logGatewayEvent('rate_limit.disabled', {
            requestId: context?.requestId,
            route: context?.route,
            rateLimit: {
                status: 'skipped',
            },
        });

        return {
            success: true,
            allowed: true,
            limit: MAX_REQUESTS_PER_WINDOW,
            remaining: MAX_REQUESTS_PER_WINDOW,
            reset: now + (RATE_LIMIT_WINDOW * 1000),
            status: 'skipped',
            reason: 'disabled',
        };
    }

    const client = getRedisClient();
    if (!client) {
        return fallbackResult(
            now,
            flags.rateLimitFailOpen ? 'failed_open' : 'failed_closed',
            new Error('Upstash Redis is not configured for rate limiting'),
            context
        );
    }

    try {
        // Atomic increment
        const requests = await client.incr(key);

        // Set expiration if it's a new key (first request)
        if (requests === 1) {
            await client.expire(key, RATE_LIMIT_WINDOW);
        }

        // Get TTL to return accurate reset time
        const ttl = await client.ttl(key);

        const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - requests);
        const reset = now + (ttl * 1000);

        return {
            success: requests <= MAX_REQUESTS_PER_WINDOW,
            allowed: requests <= MAX_REQUESTS_PER_WINDOW,
            limit: MAX_REQUESTS_PER_WINDOW,
            remaining,
            reset,
            status: 'ok',
            reason: requests <= MAX_REQUESTS_PER_WINDOW ? 'allowed' : 'limit_exceeded',
        };
    } catch (error) {
        return fallbackResult(
            now,
            flags.rateLimitFailOpen ? 'failed_open' : 'failed_closed',
            error,
            context
        );
    }
}
