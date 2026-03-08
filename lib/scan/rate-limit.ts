/**
 * In-memory per-user rate limiter for scan endpoints.
 *
 * Uses a sliding-window counter stored in a Map. Counters are pruned
 * lazily — stale entries are removed on each check to prevent unbounded growth.
 *
 * This is NOT cluster-safe: each serverless instance has its own counter.
 * For Vercel deployments this is acceptable because a single instance
 * handles bursts from one user, and the paywall already prevents abuse.
 *
 * For stricter limits, swap this for a Supabase or Redis counter.
 */

import { NextResponse } from "next/server";

interface RateLimitEntry {
    count: number;
    windowStart: number;
}

const store = new Map<string, RateLimitEntry>();
const PRUNE_INTERVAL_MS = 60_000;
let lastPruneAt = Date.now();

function pruneStaleEntries(windowMs: number): void {
    const now = Date.now();
    if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
    lastPruneAt = now;

    for (const [key, entry] of store) {
        if (now - entry.windowStart > windowMs * 2) {
            store.delete(key);
        }
    }
}

export interface RateLimitConfig {
    /** Maximum requests allowed per window. */
    maxRequests: number;
    /** Window duration in milliseconds. */
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetMs: number;
}

/**
 * Check whether a request from the given key is within the rate limit.
 * Returns the result without side effects on headers.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    pruneStaleEntries(config.windowMs);

    const existing = store.get(key);

    if (!existing || now - existing.windowStart > config.windowMs) {
        store.set(key, { count: 1, windowStart: now });
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetMs: config.windowMs,
        };
    }

    existing.count += 1;
    const resetMs = config.windowMs - (now - existing.windowStart);

    if (existing.count > config.maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetMs,
        };
    }

    return {
        allowed: true,
        remaining: config.maxRequests - existing.count,
        resetMs,
    };
}

/**
 * Apply rate limiting and return a 429 response if the limit is exceeded.
 * Returns null if the request is allowed.
 */
export function rateLimitOrNull(
    userId: string,
    endpoint: string,
    config: RateLimitConfig,
): NextResponse | null {
    const key = `${endpoint}:${userId}`;
    const result = checkRateLimit(key, config);

    if (!result.allowed) {
        const retryAfterSeconds = Math.ceil(result.resetMs / 1000);
        return NextResponse.json(
            {
                error: "Rate limit exceeded. Please try again shortly.",
                retryAfterSeconds,
            },
            {
                status: 429,
                headers: {
                    "Retry-After": String(retryAfterSeconds),
                },
            },
        );
    }

    return null;
}

// Pre-configured limits for scan endpoints
export const SCAN_RATE_LIMITS = {
    /** Max scan runs per user per window */
    scan: { maxRequests: 10, windowMs: 5 * 60 * 1000 } satisfies RateLimitConfig,
    /** Max chat messages per user per window */
    chat: { maxRequests: 60, windowMs: 5 * 60 * 1000 } satisfies RateLimitConfig,
} as const;
