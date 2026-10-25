import { Redis as UpstashRedis } from '@upstash/redis';
import type IORedis from 'ioredis';

/**
 * The Redis client every cache, rate limit, budget and queue uses. They are written against
 * Upstash's client, which talks HTTP; that is what Vercel uses. On Brimble the database is a
 * Redis on the same private network, and going through an HTTP proxy to it cost 20–25 ms a call,
 * several times per gateway request. With REDIS_URL set, calls go over one native connection
 * instead (about 1 ms), behind the same interface. The callers keep their UPSTASH_* checks: they
 * only decide whether Redis is configured at all.
 */
export type RedisClient = UpstashRedis;

let nativeClient: RedisClient | null = null;

export function createRedisClient(config: { url?: string; token?: string }): RedisClient {
    const nativeUrl = process.env.REDIS_URL;
    if (nativeUrl) {
        nativeClient ??= createNativeRedisClient(nativeUrl);
        return nativeClient;
    }
    return new UpstashRedis({ url: config.url, token: config.token });
}

// Upstash stores strings as they are and everything else as JSON, and parses what it reads back
// when it can; values written by either client must read the same through both.
function serialize(value: unknown): string {
    return typeof value === 'string' ? value : JSON.stringify(value);
}

function deserialize(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

type SetOptions = { ex?: number; px?: number; nx?: boolean; xx?: boolean; keepTtl?: boolean };

function setArgs(options?: SetOptions): Array<string | number> {
    const args: Array<string | number> = [];
    if (options?.ex !== undefined) args.push('EX', options.ex);
    if (options?.px !== undefined) args.push('PX', options.px);
    if (options?.keepTtl) args.push('KEEPTTL');
    if (options?.nx) args.push('NX');
    if (options?.xx) args.push('XX');
    return args;
}

/** The commands this codebase uses, with Upstash's return shapes. Exported for tests. */
export function nativeRedisCommands(client: IORedis) {
    const commands = {
        get: async (key: string) => deserialize(await client.get(key)),
        set: async (key: string, value: unknown, options?: SetOptions) =>
            // ioredis's overloads don't cover a variable option list.
            (client.set as (...args: unknown[]) => Promise<'OK' | null>)(key, serialize(value), ...setArgs(options)),
        del: (...keys: string[]) => client.del(...keys),
        expire: (key: string, seconds: number) => client.expire(key, seconds),
        ttl: (key: string) => client.ttl(key),
        incr: (key: string) => client.incr(key),
        incrbyfloat: async (key: string, increment: number) => Number(await client.incrbyfloat(key, increment)),
        keys: (pattern: string) => client.keys(pattern),
        rpush: (key: string, ...values: unknown[]) => client.rpush(key, ...values.map(serialize)),
        lpush: (key: string, ...values: unknown[]) => client.lpush(key, ...values.map(serialize)),
        lpop: async (key: string) => deserialize(await client.lpop(key)),
        lrange: async (key: string, start: number, stop: number) =>
            (await client.lrange(key, start, stop)).map(deserialize),
        ltrim: (key: string, start: number, stop: number) => client.ltrim(key, start, stop),
        pipeline: () => {
            const queued = client.pipeline();
            const pipeline = {
                incr: (key: string) => (queued.incr(key), pipeline),
                ttl: (key: string) => (queued.ttl(key), pipeline),
                expire: (key: string, seconds: number) => (queued.expire(key, seconds), pipeline),
                get: (key: string) => (queued.get(key), pipeline),
                exec: async () => {
                    const results = (await queued.exec()) ?? [];
                    return results.map(([error, value]) => {
                        if (error) throw error;
                        return deserialize(value);
                    });
                },
            };
            return pipeline;
        },
    };
    return commands;
}

function createNativeRedisClient(url: string): RedisClient {
    // Loaded only here, so Vercel (no REDIS_URL) never opens or bundles a native connection.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require('ioredis') as typeof IORedis;
    const client = new Redis(url, {
        // Commands wait while reconnecting instead of failing at once; callers already treat a
        // slow or failed Redis as a cache miss.
        maxRetriesPerRequest: 2,
        connectTimeout: 2_000,
        enableAutoPipelining: true,
    });
    client.on('error', (error) => console.error('[Redis] connection error:', error.message));
    const commands = nativeRedisCommands(client);
    // A command missing from the list above fails loudly, rather than as `undefined is not a function`.
    return new Proxy(commands, {
        get(target, property) {
            if (property in target) return target[property as keyof typeof target];
            if (property === 'then') return undefined;
            throw new Error(`[Redis] ${String(property)} is not supported by the native client; add it to lib/redis.ts`);
        },
    }) as unknown as RedisClient;
}
