import { Redis } from '@upstash/redis';

/**
 * Limits for a widget that anyone can talk to.
 *
 * A Porter's key is published in the page source on purpose, so every visitor to the customer's
 * website can reach this endpoint, and so can anyone who reads the HTML. The platform's own limiter
 * counts per project at 60 requests a minute, which is right for a server calling a gateway and
 * far too loose here: one script could hold that rate for an hour and spend a month of a ₦1,000
 * plan before anybody noticed.
 *
 * Two layers, because they stop different things. The visitor limit stops one person hammering it.
 * The Porter limit caps the blast radius when the requests come from many addresses, which is what
 * an actual attack looks like.
 *
 * Both fail open. Redis being unreachable should not silence a customer's support widget, and money
 * is not what these bound -- credits and spend caps do that, in the gateway, on every request.
 */

const VISITOR_LIMIT = 12;
const VISITOR_WINDOW_SECONDS = 120;

const PORTER_LIMIT = 600;
const PORTER_WINDOW_SECONDS = 3600;

let redis: Redis | null | undefined;

function getRedisClient(): Redis | null {
    if (redis !== undefined) return redis;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    redis = url && token ? new Redis({ url, token }) : null;
    return redis;
}

export type PorterRateLimitResult =
    | { allowed: true }
    | { allowed: false; scope: 'visitor' | 'porter'; retryAfterSeconds: number };

async function hit(
    client: Redis,
    key: string,
    limit: number,
    windowSeconds: number,
): Promise<{ exceeded: boolean; retryAfterSeconds: number }> {
    const pipeline = client.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSeconds);
    pipeline.ttl(key);
    const [count, , ttl] = await pipeline.exec<[number, number, number]>();

    return {
        exceeded: count > limit,
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    };
}

export async function checkPorterRateLimit(
    porterId: string,
    visitorIp: string,
): Promise<PorterRateLimitResult> {
    const client = getRedisClient();
    if (!client) return { allowed: true };

    try {
        const visitor = await hit(
            client,
            `porter_visitor:${porterId}:${visitorIp}`,
            VISITOR_LIMIT,
            VISITOR_WINDOW_SECONDS,
        );
        if (visitor.exceeded) {
            return { allowed: false, scope: 'visitor', retryAfterSeconds: visitor.retryAfterSeconds };
        }

        const porter = await hit(
            client,
            `porter_total:${porterId}`,
            PORTER_LIMIT,
            PORTER_WINDOW_SECONDS,
        );
        if (porter.exceeded) {
            return { allowed: false, scope: 'porter', retryAfterSeconds: porter.retryAfterSeconds };
        }

        return { allowed: true };
    } catch (error) {
        console.warn('[Porter] rate limit unavailable', error instanceof Error ? error.message : error);
        return { allowed: true };
    }
}
