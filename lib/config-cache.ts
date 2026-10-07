/**
 * Fast Config Cache using Redis
 * Caches frequently accessed configs to reduce DB roundtrips
 */

import { Redis } from '@upstash/redis';

const redisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);
const redis = redisConfigured
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : ({
        get: async () => null,
        set: async () => null,
        del: async () => 0,
    } as unknown as Redis);

const CONFIG_PREFIX = 'cfg:';

// TTLs - balance between freshness and speed
const TTL = {
    API_KEY: 60,           // 1 minute for API key + project config
    CACHE_CONFIG: 300,     // 5 minutes for cache config
    SECURITY_CONFIG: 60,   // 1 minute for security config
    CUSTOM_RULES: 60,      // 1 minute for active custom data rules
    PROVIDER_CONFIG: 60,   // 1 minute for BYOK provider resolution
    FAILOVER_CONFIG: 60,   // 1 minute for reliability settings
    NETWORK_CONFIG: 60,    // 1 minute for project ingress policy
    CREDITS: 300,          // 5 minutes for balance (invalidated on spend)
    MEMORY_CONFIG: 300,    // 5 minutes for project memory settings
    /** Packed gateway bundle: one Redis GET warms the whole data plane. */
    GATEWAY_PACKED: 60,    // 1 minute for the packed project bundle
};

/** Exported so the gateway warmer can seed per-concern TTLs without drift. */
export const GATEWAY_CACHE_TTLS = { ...TTL };

/** Bound the per-instance map; serverless instances must not grow unbounded. */
const LOCAL_CACHE_MAX_ENTRIES = 2000;

const localCache = new Map<string, { value: unknown; expiresAt: number }>();

function getLocal<T>(key: string): { found: boolean; value?: T } {
    const entry = localCache.get(key);
    if (!entry) return { found: false };
    if (entry.expiresAt <= Date.now()) {
        localCache.delete(key);
        return { found: false };
    }
    return { found: true, value: entry.value as T };
}

function setLocal(key: string, value: unknown, ttlSeconds: number): void {
    if (!localCache.has(key) && localCache.size >= LOCAL_CACHE_MAX_ENTRIES) {
        const oldest = localCache.keys().next();
        if (!oldest.done) localCache.delete(oldest.value);
    }
    localCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function deleteLocal(key: string): void {
    localCache.delete(key);
}

/**
 * Seed the instance-local cache without touching Redis. Used by the gateway
 * request warmer after a single packed fetch — per-concern readers then hit
 * memory instead of issuing their own Redis/DB round trips.
 */
export function seedLocalCacheEntry(key: string, value: unknown, ttlSeconds: number): void {
    setLocal(key, value, ttlSeconds);
}

/**
 * Test-only: drop all instance-local entries. Test suites reuse fixed
 * project ids with different mock backends per case, so without a reset the
 * first case's cached config leaks into later cases.
 */
export function clearLocalGatewayCache(): void {
    localCache.clear();
}

/** Cache-key builders shared with the gateway warmer (single source of truth). */
export const gatewayCacheKeys = {
    packed: (projectId: string) => `${CONFIG_PREFIX}gwpack:${projectId}`,
    security: (projectId: string) => `${CONFIG_PREFIX}security:${projectId}`,
    customRules: (projectId: string) => `${CONFIG_PREFIX}custom_rules:${projectId}`,
    provider: (projectId: string, provider: string) => `${CONFIG_PREFIX}provider:${projectId}:${provider}`,
    failover: (projectId: string) => `${CONFIG_PREFIX}failover:${projectId}`,
    network: (projectId: string) => `${CONFIG_PREFIX}network:${projectId}`,
    cache: (projectId: string) => `${CONFIG_PREFIX}cache:${projectId}`,
};

export async function getPackedGatewayConfig(projectId: string): Promise<unknown | null> {
    const cacheKey = gatewayCacheKeys.packed(projectId);
    const local = getLocal<unknown>(cacheKey);
    if (local.found) return local.value ?? null;
    try {
        const cached = await redis.get(cacheKey);
        if (cached === null || cached === undefined) return null;
        setLocal(cacheKey, cached, TTL.GATEWAY_PACKED);
        return cached;
    } catch {
        return null;
    }
}

export async function setPackedGatewayConfig(projectId: string, bundle: unknown): Promise<void> {
    const cacheKey = gatewayCacheKeys.packed(projectId);
    setLocal(cacheKey, bundle, TTL.GATEWAY_PACKED);
    try {
        await redis.set(cacheKey, bundle, { ex: TTL.GATEWAY_PACKED });
    } catch {
        // Silently fail
    }
}

export async function invalidatePackedGatewayConfig(projectId: string): Promise<void> {
    const cacheKey = gatewayCacheKeys.packed(projectId);
    deleteLocal(cacheKey);
    try {
        await redis.del(cacheKey);
    } catch {
        // Silently fail
    }
}

/**
 * Cache organization credits balance
 */
export async function getCachedCreditsBalance(organizationId: string): Promise<number | null> {
    const cacheKey = `${CONFIG_PREFIX}credits:${organizationId}`;
    const local = getLocal<number>(cacheKey);
    if (local.found) return local.value ?? null;
    try {
        const cached = await redis.get(cacheKey);
        if (cached === null) return null;
        const balance = Number(cached);
        setLocal(cacheKey, balance, TTL.CREDITS);
        return balance;
    } catch {
        return null;
    }
}

export async function setCachedCreditsBalance(organizationId: string, balance: number): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}credits:${organizationId}`;
    setLocal(cacheKey, balance, TTL.CREDITS);
    try {
        await redis.set(cacheKey, balance, { ex: TTL.CREDITS });
    } catch {
        // Silently fail
    }
}

export async function invalidateCreditsBalance(organizationId: string): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}credits:${organizationId}`;
    deleteLocal(cacheKey);
    try {
        await redis.del(cacheKey);
    } catch {
        // Silently fail
    }
}

/**
 * Cache API key + project config lookup
 * This is the most frequent DB call - caching it will save ~100-200ms per request
 */
export async function getCachedApiKeyConfig(keyHash: string): Promise<{
    data: any;
    fromCache: boolean;
} | null> {
    const cacheKey = `${CONFIG_PREFIX}key:${keyHash}`;
    const local = getLocal<any>(cacheKey);
    if (local.found) return { data: local.value, fromCache: true };
    
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            setLocal(cacheKey, cached, TTL.API_KEY);
            return { data: cached, fromCache: true };
        }
        return null;
    } catch {
        return null;
    }
}

export async function setCachedApiKeyConfig(keyHash: string, data: any): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}key:${keyHash}`;
    setLocal(cacheKey, data, TTL.API_KEY);
    try {
        await redis.set(cacheKey, data, { ex: TTL.API_KEY });
    } catch {
        // Silently fail - don't block requests
    }
}

export async function invalidateApiKeyCache(keyHash: string): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}key:${keyHash}`;
    deleteLocal(cacheKey);
    try {
        await redis.del(cacheKey);
    } catch {
        // Silently fail
    }
}

/**
 * Cache project cache settings
 */
export async function getCachedCacheConfig(projectId: string): Promise<{
    data: any;
    fromCache: boolean;
} | null> {
    const cacheKey = `${CONFIG_PREFIX}cache:${projectId}`;
    const local = getLocal<any>(cacheKey);
    if (local.found) return { data: local.value, fromCache: true };
    
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            setLocal(cacheKey, cached, TTL.CACHE_CONFIG);
            return { data: cached, fromCache: true };
        }
        return null;
    } catch {
        return null;
    }
}

export async function setCachedCacheConfig(projectId: string, data: any): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}cache:${projectId}`;
    setLocal(cacheKey, data, TTL.CACHE_CONFIG);
    try {
        await redis.set(cacheKey, data, { ex: TTL.CACHE_CONFIG });
    } catch {
        // Silently fail
    }
}

export async function invalidateCacheConfig(projectId: string): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}cache:${projectId}`;
    deleteLocal(cacheKey);
    try {
        await redis.del(cacheKey);
    } catch {
        // Silently fail
    }
    await invalidatePackedGatewayConfig(projectId);
}

/**
 * Cache project memory settings
 */
export async function getCachedMemoryConfig(projectId: string): Promise<{
    data: any;
    fromCache: boolean;
} | null> {
    const cacheKey = `${CONFIG_PREFIX}memory:${projectId}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return { data: cached, fromCache: true };
        }
        return null;
    } catch {
        return null;
    }
}

export async function setCachedMemoryConfig(projectId: string, data: any): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}memory:${projectId}`;
    try {
        await redis.set(cacheKey, data, { ex: TTL.MEMORY_CONFIG });
    } catch {
        // Silently fail
    }
}

export async function invalidateMemoryConfig(projectId: string): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}memory:${projectId}`;
    try {
        await redis.del(cacheKey);
    } catch {
        // Silently fail
    }
}

/**
 * Cache agent config lookup
 */
export async function getCachedAgentConfig(agentId: string): Promise<{
    data: any;
    fromCache: boolean;
} | null> {
    const cacheKey = `${CONFIG_PREFIX}agent:${agentId}`;
    const local = getLocal<any>(cacheKey);
    if (local.found) return { data: local.value, fromCache: true };
    
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            setLocal(cacheKey, cached, TTL.API_KEY);
            return { data: cached, fromCache: true };
        }
        return null;
    } catch {
        return null;
    }
}

export async function setCachedAgentConfig(agentId: string, data: any): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}agent:${agentId}`;
    setLocal(cacheKey, data, TTL.API_KEY);
    try {
        await redis.set(cacheKey, data, { ex: TTL.API_KEY });
    } catch {
        // Silently fail
    }
}

export async function invalidateAgentConfig(agentId: string): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}agent:${agentId}`;
    deleteLocal(cacheKey);
    try {
        await redis.del(cacheKey);
    } catch {
        // Silently fail
    }
}

/**
 * Cache security settings per project
 */
export async function getCachedSecurityConfig(projectId: string): Promise<{
    data: any;
    fromCache: boolean;
} | null> {
    const cacheKey = `${CONFIG_PREFIX}security:${projectId}`;
    const local = getLocal<any>(cacheKey);
    if (local.found) return { data: local.value, fromCache: true };
    
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            setLocal(cacheKey, cached, TTL.SECURITY_CONFIG);
            return { data: cached, fromCache: true };
        }
        return null;
    } catch {
        return null;
    }
}

export async function setCachedSecurityConfig(projectId: string, data: any): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}security:${projectId}`;
    setLocal(cacheKey, data, TTL.SECURITY_CONFIG);
    try {
        await redis.set(cacheKey, data, { ex: TTL.SECURITY_CONFIG });
    } catch {
        // Silently fail
    }
}

export async function invalidateSecurityConfig(projectId: string): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}security:${projectId}`;
    deleteLocal(cacheKey);
    try {
        await redis.del(cacheKey);
    } catch {
        // Silently fail
    }
    await invalidatePackedGatewayConfig(projectId);
}

export async function getCachedCustomRules(projectId: string): Promise<any[] | null> {
    const cacheKey = `${CONFIG_PREFIX}custom_rules:${projectId}`;
    const local = getLocal<any[]>(cacheKey);
    if (local.found) return local.value ?? null;
    try {
        const cached = await redis.get<any[]>(cacheKey);
        if (cached === null) return null;
        setLocal(cacheKey, cached, TTL.CUSTOM_RULES);
        return cached;
    } catch {
        return null;
    }
}

export async function setCachedCustomRules(projectId: string, rules: any[]): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}custom_rules:${projectId}`;
    setLocal(cacheKey, rules, TTL.CUSTOM_RULES);
    try {
        await redis.set(cacheKey, rules, { ex: TTL.CUSTOM_RULES });
    } catch {
        // Silently fail
    }
}

export async function invalidateCustomRules(projectId: string): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}custom_rules:${projectId}`;
    deleteLocal(cacheKey);
    try {
        await redis.del(cacheKey);
    } catch {
        // Silently fail
    }
    await invalidatePackedGatewayConfig(projectId);
}

export async function getCachedProviderConfig(
    projectId: string,
    provider: string
): Promise<{ row: any | null } | null> {
    const cacheKey = `${CONFIG_PREFIX}provider:${projectId}:${provider}`;
    const local = getLocal<{ row: any | null }>(cacheKey);
    if (local.found) return local.value ?? null;
    try {
        const cached = await redis.get<{ row: any | null }>(cacheKey);
        if (cached) setLocal(cacheKey, cached, TTL.PROVIDER_CONFIG);
        return cached;
    } catch {
        return null;
    }
}

export async function setCachedProviderConfig(
    projectId: string,
    provider: string,
    row: any | null
): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}provider:${projectId}:${provider}`;
    setLocal(cacheKey, { row }, TTL.PROVIDER_CONFIG);
    try {
        await redis.set(cacheKey, { row }, { ex: TTL.PROVIDER_CONFIG });
    } catch {
        // Silently fail
    }
}

export async function invalidateProviderConfig(projectId: string, provider: string): Promise<void> {
    deleteLocal(`${CONFIG_PREFIX}provider:${projectId}:${provider}`);
    try {
        await redis.del(`${CONFIG_PREFIX}provider:${projectId}:${provider}`);
    } catch {
        // Silently fail
    }
    await invalidatePackedGatewayConfig(projectId);
}

export async function getCachedFailoverConfig(projectId: string): Promise<any | null> {
    const cacheKey = `${CONFIG_PREFIX}failover:${projectId}`;
    const local = getLocal<any>(cacheKey);
    if (local.found) return local.value ?? null;
    try {
        const cached = await redis.get(cacheKey);
        if (cached) setLocal(cacheKey, cached, TTL.FAILOVER_CONFIG);
        return cached;
    } catch {
        return null;
    }
}

export async function setCachedFailoverConfig(projectId: string, data: any): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}failover:${projectId}`;
    setLocal(cacheKey, data, TTL.FAILOVER_CONFIG);
    try {
        await redis.set(cacheKey, data, { ex: TTL.FAILOVER_CONFIG });
    } catch {
        // Silently fail
    }
}

export async function invalidateFailoverConfig(projectId: string): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}failover:${projectId}`;
    deleteLocal(cacheKey);
    try {
        await redis.del(cacheKey);
    } catch {
        // Silently fail
    }
    await invalidatePackedGatewayConfig(projectId);
}

/**
 * Cache project ingress policy. Policy writes invalidate this key so gateway
 * enforcement changes take effect immediately instead of waiting for the TTL.
 */
export async function getCachedNetworkConfig<T = unknown>(projectId: string): Promise<{
    data: T;
    fromCache: boolean;
} | null> {
    const cacheKey = `${CONFIG_PREFIX}network:${projectId}`;
    const local = getLocal<T>(cacheKey);
    if (local.found) return { data: local.value as T, fromCache: true };

    try {
        const cached = await redis.get<T>(cacheKey);
        if (!cached) return null;
        setLocal(cacheKey, cached, TTL.NETWORK_CONFIG);
        return { data: cached, fromCache: true };
    } catch {
        return null;
    }
}

export async function setCachedNetworkConfig(projectId: string, data: unknown): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}network:${projectId}`;
    setLocal(cacheKey, data, TTL.NETWORK_CONFIG);
    try {
        await redis.set(cacheKey, data, { ex: TTL.NETWORK_CONFIG });
    } catch {
        // Network policy must still work when Redis is unavailable.
    }
}

export async function invalidateNetworkConfig(projectId: string): Promise<void> {
    const cacheKey = `${CONFIG_PREFIX}network:${projectId}`;
    deleteLocal(cacheKey);
    try {
        await redis.del(cacheKey);
    } catch {
        // The one-minute TTL remains the fallback.
    }
    await invalidatePackedGatewayConfig(projectId);
}

/**
 * Tensor turn entitlement (`basecode_gateway_access`) per user.
 *
 * The RPC only re-confirms a reservation the turn already took, but every
 * model call in an agent turn paid it again (0.8–1.7s observed). Only an
 * allowed answer is cached, and only in Redis: finishing or releasing a turn
 * deletes the entry, and an instance-local copy could not be reached by that
 * delete. Denials are never cached, so a top-up or a new reservation takes
 * effect on the next call. Budget and wallet checks may lag by up to the TTL.
 */
const TENSOR_ACCESS_TTL_SECONDS = 15;

function tensorAccessKey(userId: string) {
    return `${CONFIG_PREFIX}tensor-access:${userId}`;
}

export async function getCachedTensorAccess<T = unknown>(userId: string): Promise<T | null> {
    if (!redisConfigured) return null;
    try {
        return (await redis.get<T>(tensorAccessKey(userId))) ?? null;
    } catch {
        return null;
    }
}

export async function setCachedTensorAccess(userId: string, data: unknown): Promise<void> {
    if (!redisConfigured) return;
    try {
        await redis.set(tensorAccessKey(userId), data, { ex: TENSOR_ACCESS_TTL_SECONDS });
    } catch {
        // A miss only costs the RPC.
    }
}

export async function invalidateTensorAccess(userId: string): Promise<void> {
    if (!redisConfigured) return;
    try {
        await redis.del(tensorAccessKey(userId));
    } catch {
        // The TTL bounds staleness.
    }
}
