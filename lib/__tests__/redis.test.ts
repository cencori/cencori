// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Runs against a real Redis when REDIS_TEST_URL is set (e.g. redis://127.0.0.1:6390/15);
// skipped otherwise. The native client must answer exactly as Upstash's would.
const url = process.env.REDIS_TEST_URL;

describe.skipIf(!url)('native Redis client', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let redis: any;
    const prefix = `test:${Date.now()}:`;

    beforeAll(async () => {
        vi.stubEnv('REDIS_URL', url!);
        const { createRedisClient } = await import('@/lib/redis');
        redis = createRedisClient({});
    });

    afterAll(async () => {
        const keys: string[] = await redis.keys(`${prefix}*`);
        if (keys.length) await redis.del(...keys);
        vi.unstubAllEnvs();
    });

    it('stores strings as they are and other values as JSON, parsing on read', async () => {
        await redis.set(`${prefix}s`, 'plain text');
        await redis.set(`${prefix}o`, { a: 1, b: ['x'] });
        await redis.set(`${prefix}n`, String(12.5));
        expect(await redis.get(`${prefix}s`)).toBe('plain text');
        expect(await redis.get(`${prefix}o`)).toEqual({ a: 1, b: ['x'] });
        expect(await redis.get(`${prefix}n`)).toBe(12.5);
        expect(await redis.get(`${prefix}missing`)).toBeNull();
    });

    it('honours ex and nx', async () => {
        expect(await redis.set(`${prefix}lock`, '1', { nx: true, ex: 30 })).toBe('OK');
        expect(await redis.set(`${prefix}lock`, '2', { nx: true, ex: 30 })).toBeNull();
        const ttl = await redis.ttl(`${prefix}lock`);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(30);
    });

    it('counts with incr, incrbyfloat and a pipeline', async () => {
        expect(await redis.incr(`${prefix}c`)).toBe(1);
        expect(await redis.incrbyfloat(`${prefix}f`, 0.25)).toBe(0.25);
        expect(await redis.incrbyfloat(`${prefix}f`, 0.5)).toBe(0.75);
        const pipeline = redis.pipeline();
        pipeline.incr(`${prefix}c`);
        pipeline.ttl(`${prefix}c`);
        expect(await pipeline.exec()).toEqual([2, -1]);
        expect(await redis.expire(`${prefix}c`, 60)).toBe(1);
    });

    it('queues JSON through rpush and lpop, and keeps a capped list', async () => {
        await redis.rpush(`${prefix}q`, JSON.stringify({ id: 1 }), JSON.stringify({ id: 2 }));
        expect(await redis.lpop(`${prefix}q`)).toEqual({ id: 1 });
        expect(await redis.lpop(`${prefix}q`)).toEqual({ id: 2 });
        expect(await redis.lpop(`${prefix}q`)).toBeNull();

        await redis.lpush(`${prefix}l`, { turn: 1 });
        await redis.lpush(`${prefix}l`, { turn: 2 });
        await redis.lpush(`${prefix}l`, { turn: 3 });
        await redis.ltrim(`${prefix}l`, 0, 1);
        expect(await redis.lrange(`${prefix}l`, 0, -1)).toEqual([{ turn: 3 }, { turn: 2 }]);
    });

    it('fails loudly for a command it does not implement', () => {
        expect(() => redis.zadd).toThrow(/not supported by the native client/);
    });
});
