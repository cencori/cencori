/** @vitest-environment node */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    eval: vi.fn(),
    counters: new Map<string, { count: number; expiresAt: number }>(),
}));
vi.mock('@upstash/redis', () => ({ Redis: class { eval = state.eval; } }));

beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T00:00:00Z'));
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test');
    state.counters.clear();
    state.eval.mockReset();
    // Redis EVAL is atomic; this clock model lets the public limiter be exercised
    // over many real window lengths without waiting hours in the test suite.
    state.eval.mockImplementation(async (_script: string, [key]: string[], [seconds]: number[]) => {
        let counter = state.counters.get(key);
        if (!counter || counter.expiresAt <= Date.now()) {
            counter = { count: 0, expiresAt: Date.now() + seconds * 1000 };
            state.counters.set(key, counter);
        }
        counter.count += 1;
        return [counter.count, Math.floor((counter.expiresAt - Date.now()) / 1000)];
    });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('Porter rate-limit windows', () => {
    it('does not accumulate ordinary hourly traffic across ten hours', async () => {
        const { checkPorterRateLimit } = await import('@/lib/porter/rate-limit');
        for (let minute = 0; minute <= 610; minute++) {
            expect(await checkPorterRateLimit('porter-1', `visitor-${minute}`)).toEqual({ allowed: true });
            vi.advanceTimersByTime(60_000);
        }
    });

    it('recovers at the original visitor boundary despite repeated denied attempts', async () => {
        const { checkPorterRateLimit } = await import('@/lib/porter/rate-limit');
        for (let i = 0; i < 12; i++) expect((await checkPorterRateLimit('p1', 'v1')).allowed).toBe(true);
        expect(await checkPorterRateLimit('p1', 'v1')).toMatchObject({ allowed: false, scope: 'visitor', retryAfterSeconds: 120 });
        vi.advanceTimersByTime(119_000);
        expect(await checkPorterRateLimit('p1', 'v1')).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
        vi.advanceTimersByTime(1_000);
        expect((await checkPorterRateLimit('p1', 'v1')).allowed).toBe(true);
    });

    it('caps concurrent visitors at 600 and restores access at the hourly boundary', async () => {
        const { checkPorterRateLimit } = await import('@/lib/porter/rate-limit');
        const results = await Promise.all(Array.from({ length: 620 }, (_, i) => checkPorterRateLimit('p1', `v${i}`)));
        expect(results.filter(result => result.allowed)).toHaveLength(600);
        expect(results.filter(result => !result.allowed)).toHaveLength(20);
        vi.advanceTimersByTime(3_599_000);
        expect(await checkPorterRateLimit('p1', 'new')).toMatchObject({ allowed: false, scope: 'porter', retryAfterSeconds: 1 });
        vi.advanceTimersByTime(1_000);
        expect((await checkPorterRateLimit('p1', 'new')).allowed).toBe(true);
    });

    it('restores session minting after five minutes even when callers retry', async () => {
        const { checkPorterSessionLimit } = await import('@/lib/porter/rate-limit');
        for (let i = 0; i < 5; i++) expect((await checkPorterSessionLimit('p1', 'v1')).allowed).toBe(true);
        vi.advanceTimersByTime(299_000);
        expect(await checkPorterSessionLimit('p1', 'v1')).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
        vi.advanceTimersByTime(1_000);
        expect((await checkPorterSessionLimit('p1', 'v1')).allowed).toBe(true);
    });

    it('keeps visitor counters isolated between Porters', async () => {
        const { checkPorterSessionLimit } = await import('@/lib/porter/rate-limit');
        for (let i = 0; i < 6; i++) await checkPorterSessionLimit('p1', 'v1');
        expect((await checkPorterSessionLimit('p2', 'v1')).allowed).toBe(true);
    });
});
