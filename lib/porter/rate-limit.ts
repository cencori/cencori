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
 * These throttle request frequency; they do not enforce a monetary entitlement.
 * Redis failures retain the existing fail-open policy. Product billing and a
 * cumulative spend ceiling must be enforced independently of these counters.
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

/**
 * Minting a session is throttled harder than sending a message. A visitor mints one and then talks;
 * a script has to keep coming back for another, so this is the cheaper thing to make expensive.
 */
const SESSION_LIMIT = 5;
const SESSION_WINDOW_SECONDS = 300;

export type PorterRateLimitResult =
    | { allowed: true }
    | { allowed: false; scope: 'visitor' | 'porter'; retryAfterSeconds: number };

// Increment and initialize expiry atomically. Subsequent traffic, including
// denied requests, must never move the end of the current fixed window.
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if count == 1 or ttl < 0 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

async function hit(
    client: Redis,
    key: string,
    limit: number,
    windowSeconds: number,
): Promise<{ exceeded: boolean; retryAfterSeconds: number }> {
    const [count, ttl] = await client.eval<[number], [number, number]>(HIT_SCRIPT, [key], [windowSeconds]);

    return {
        exceeded: count > limit,
        retryAfterSeconds: Math.max(1, ttl),
    };
}

export async function checkPorterSessionLimit(
    porterId: string,
    visitorIp: string,
): Promise<PorterRateLimitResult> {
    const client = getRedisClient();
    if (!client) return { allowed: true };

    try {
        const result = await hit(
            client,
            `porter_session:${porterId}:${visitorIp}`,
            SESSION_LIMIT,
            SESSION_WINDOW_SECONDS,
        );
        return result.exceeded
            ? { allowed: false, scope: 'visitor', retryAfterSeconds: result.retryAfterSeconds }
            : { allowed: true };
    } catch (error) {
        console.warn('[Porter] session limit unavailable', error instanceof Error ? error.message : error);
        return { allowed: true };
    }
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
