import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@upstash/redis', () => ({ Redis: vi.fn() }));

type Entry = { count: number; expiresAt: number | null };

function createFakeRedis() {
    const store = new Map<string, Entry>();
    const now = () => Date.now();
    const prune = (key: string): Entry | undefined => {
        const entry = store.get(key);
        if (entry && entry.expiresAt !== null && entry.expiresAt <= now()) {
            store.delete(key);
            return undefined;
        }
        return entry;
    };
    const pipeline = () => {
        const ops: Array<() => number> = [];
        const api = {
            incr(key: string) {
                ops.push(() => {
                    const existing = prune(key);
                    const next = (existing?.count ?? 0) + 1;
                    const expiresAt = existing?.expiresAt ?? null;
                    store.set(key, { count: next, expiresAt });
                    return next;
                });
                return api;
            },
            ttl(key: string) {
                ops.push(() => {
                    const entry = prune(key);
                    if (!entry) return -2;
                    if (entry.expiresAt === null) return -1;
                    return Math.ceil((entry.expiresAt - now()) / 1000);
                });
                return api;
            },
            async exec<T>(): Promise<T> {
                return ops.map((op) => op()) as unknown as T;
            },
        };
        return api;
    };
    return {
        store,
        pipeline,
        async expire(key: string, seconds: number) {
            const entry = prune(key) ?? { count: 0, expiresAt: null };
            entry.expiresAt = now() + seconds * 1000;
            store.set(key, entry);
            return 1;
        },
    };
}

async function loadModuleWithFake(fake: ReturnType<typeof createFakeRedis>) {
    vi.resetModules();
    const { Redis } = await import('@upstash/redis');
    vi.mocked(Redis).mockImplementation((function (this: unknown) {
        return fake;
    }) as never);
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.RATE_LIMIT_FAIL_OPEN = 'false';
    return import('@/lib/rate-limit');
}

describe('rate limit tier classification', () => {
    test('routes requests to write, read, or exempt buckets', async () => {
        const mod = await import('@/lib/rate-limit');
        expect(mod.classifyRateLimitTier('GET', '/v1/runs/run_123')).toBe('read');
        expect(mod.classifyRateLimitTier('GET', '/V1/RUNS/RUN_123/EVENTS')).toBe('read');
        expect(mod.classifyRateLimitTier('POST', '/v1/runs/run_123/cancel')).toBe('cancel_exempt');
        expect(mod.classifyRateLimitTier('post', '/v1/agents/agt_1/runs')).toBe('write');
        expect(mod.classifyRateLimitTier('POST', '/v1/agents/agt_1/runs')).toBe('write');
        expect(mod.classifyRateLimitTier('DELETE', '/v1/sessions/ses_1')).toBe('write');
    });
});

describe('rate limiter fixed window', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    test('sustained low-rate traffic is never rejected', async () => {
        const fake = createFakeRedis();
        const mod = await loadModuleWithFake(fake);
        let now = 1_700_000_000_000;
        const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
        try {
            // One request every 10s for 700s: ~6 per minute, must all pass.
            for (let i = 0; i < 70; i++) {
                const res = await mod.checkCustomRateLimit('probe-low-rate', 60, 60);
                expect(res.allowed).toBe(true);
                now += 10_000;
            }
        } finally {
            nowSpy.mockRestore();
        }
    });

    test('read and write buckets are independent', async () => {
        const fake = createFakeRedis();
        const mod = await loadModuleWithFake(fake);
        // Exhaust the 60/min write bucket...
        for (let i = 0; i < 60; i++) {
            const res = await mod.checkRateLimit('project-tiers', { route: '/v1/agents/a/runs' });
            expect(res.allowed).toBe(true);
            expect(res.limit).toBe(60);
        }
        const blocked = await mod.checkRateLimit('project-tiers', { route: '/v1/agents/a/runs' });
        expect(blocked.allowed).toBe(false);
        expect(blocked.limit).toBe(60);
        // ...while reads on the same project still flow from their own bucket.
        const read = await mod.checkRateLimit(
            'project-tiers',
            { route: '/v1/runs/r1' },
            { limit: mod.MAX_READ_REQUESTS_PER_WINDOW, keySuffix: mod.READ_BUCKET_SUFFIX },
        );
        expect(read.allowed).toBe(true);
        expect(read.limit).toBe(300);
        expect(read.remaining).toBe(299);
    });

    test('rejected requests do not extend the window', async () => {
        const fake = createFakeRedis();
        const mod = await loadModuleWithFake(fake);
        let now = 1_700_000_000_000;
        const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
        try {
            let firstReset = 0;
            for (let i = 0; i < 60; i++) {
                const res = await mod.checkCustomRateLimit('probe-burst', 60, 60);
                expect(res.allowed).toBe(true);
                if (i === 0) firstReset = res.reset;
            }
            // 61st is over the limit...
            const rejected = await mod.checkCustomRateLimit('probe-burst', 60, 60);
            expect(rejected.allowed).toBe(false);
            // ...but the window still ends on the original schedule.
            expect(rejected.reset).toBe(firstReset);
            // After 61 idle seconds the window has rolled and traffic flows.
            now += 61_000;
            const recovered = await mod.checkCustomRateLimit('probe-burst', 60, 60);
            expect(recovered.allowed).toBe(true);
        } finally {
            nowSpy.mockRestore();
        }
    });
});
