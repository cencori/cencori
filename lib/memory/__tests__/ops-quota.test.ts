import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildMemoryOpsExceededBody,
    checkMemoryOpsQuota,
    MemoryOpsExceededError,
} from '../ops-quota';
import { getMemoryOpsQuota, getMemoryOpsUserDailyQuota } from '@/lib/entitlements';

vi.mock('@/lib/rate-limit', () => ({
    checkCustomRateLimit: vi.fn(async () => ({ allowed: true, remaining: 999, reset: Date.now() + 1000 })),
}));

import { checkCustomRateLimit } from '@/lib/rate-limit';

const mockedCheck = vi.mocked(checkCustomRateLimit);

function deny(remaining = 0) {
    return { allowed: false, remaining, reset: Date.now() + 60_000 };
}

function allow(remaining = 999) {
    return { allowed: true, remaining, reset: Date.now() + 60_000 };
}

describe('memory ops quota tables', () => {
    it('scales free < pro < team and never blocks enterprise', () => {
        expect(getMemoryOpsQuota('free').writes).toBeLessThan(getMemoryOpsQuota('pro').writes);
        expect(getMemoryOpsQuota('pro').writes).toBeLessThan(getMemoryOpsQuota('team').writes);
        expect(getMemoryOpsQuota('enterprise').writes).toBe(Number.POSITIVE_INFINITY);
        expect(getMemoryOpsQuota('enterprise').searches).toBe(Number.POSITIVE_INFINITY);
        expect(getMemoryOpsUserDailyQuota('free').searches).toBeLessThan(
            getMemoryOpsUserDailyQuota('pro').searches
        );
    });

    it('pilot allowance fits comfortably inside pro writes', () => {
        // 5,000 turns/mo pilot << 100,000 pro writes/mo.
        expect(getMemoryOpsQuota('pro').writes).toBeGreaterThanOrEqual(20 * 5_000);
    });
});

describe('checkMemoryOpsQuota', () => {
    beforeEach(() => {
        mockedCheck.mockReset();
        mockedCheck.mockResolvedValue(allow());
    });

    it('checks the project-monthly bucket first with the monthly window', async () => {
        const status = await checkMemoryOpsQuota('proj_1', 'free', 'user_a', 'write');
        expect(status.allowed).toBe(true);
        expect(mockedCheck).toHaveBeenCalledTimes(2);
        expect(mockedCheck.mock.calls[0][0]).toBe('memory_ops:v1:proj_1:write:month');
        expect(mockedCheck.mock.calls[0][1]).toBe(getMemoryOpsQuota('free').writes);
        expect(mockedCheck.mock.calls[0][2]).toBe(30 * 24 * 60 * 60);
        expect(mockedCheck.mock.calls[1][0]).toBe('memory_ops:v1:proj_1:user_a:write:day');
    });

    it('denies on the project bucket without consulting the user bucket', async () => {
        mockedCheck.mockResolvedValueOnce(deny());
        const status = await checkMemoryOpsQuota('proj_1', 'free', 'user_a', 'write');
        expect(status).toMatchObject({ allowed: false, scope: 'project', limit: 2000, used: 2000 });
        expect(status.resetMs).toBeGreaterThan(0);
        expect(mockedCheck).toHaveBeenCalledTimes(1);
    });

    it('denies on the user-daily bucket when the project allows', async () => {
        mockedCheck.mockResolvedValueOnce(allow()).mockResolvedValueOnce(deny());
        const status = await checkMemoryOpsQuota('proj_1', 'free', 'user_a', 'search');
        expect(status).toMatchObject({ allowed: false, scope: 'user', limit: 200 });
        expect(mockedCheck).toHaveBeenCalledTimes(2);
    });

    it('uses the search field for search ops', async () => {
        await checkMemoryOpsQuota('proj_1', 'pro', 'user_a', 'search');
        expect(mockedCheck.mock.calls[0][1]).toBe(getMemoryOpsQuota('pro').searches);
    });

    it('never touches Redis for enterprise', async () => {
        const status = await checkMemoryOpsQuota('proj_1', 'enterprise', 'user_a', 'write');
        expect(status.allowed).toBe(true);
        expect(status.scope).toBeNull();
        expect(mockedCheck).not.toHaveBeenCalled();
    });
});

describe('checkMemoryOpsQuota custom project caps', () => {
    beforeEach(() => {
        mockedCheck.mockReset();
        mockedCheck.mockResolvedValue(allow());
    });

    it('an explicit custom cap wins over the tier default', async () => {
        mockedCheck.mockResolvedValueOnce(deny());
        const status = await checkMemoryOpsQuota('proj_1', 'pro', 'user_a', 'write', {
            maxWritesMonthly: 5000,
        });
        expect(mockedCheck.mock.calls[0][1]).toBe(5000);
        expect(status).toMatchObject({ allowed: false, scope: 'project', limit: 5000 });
    });

    it('an explicit custom cap wins even over enterprise infinity', async () => {
        mockedCheck.mockResolvedValueOnce(deny());
        const status = await checkMemoryOpsQuota('proj_1', 'enterprise', 'user_a', 'write', {
            maxWritesMonthly: 100,
        });
        expect(mockedCheck).toHaveBeenCalledTimes(1);
        expect(status).toMatchObject({ allowed: false, limit: 100 });
    });

    it('null custom caps fall through to the tier default', async () => {
        await checkMemoryOpsQuota('proj_1', 'pro', 'user_a', 'search', {
            maxSearchesMonthly: null,
            maxWritesMonthly: null,
        });
        expect(mockedCheck.mock.calls[0][1]).toBe(getMemoryOpsQuota('pro').searches);
    });

    it('non-positive custom caps fall through to the tier default', async () => {
        await checkMemoryOpsQuota('proj_1', 'pro', 'user_a', 'write', { maxWritesMonthly: 0 });
        expect(mockedCheck.mock.calls[0][1]).toBe(getMemoryOpsQuota('pro').writes);
        await checkMemoryOpsQuota('proj_1', 'pro', 'user_a', 'write', { maxWritesMonthly: -50 });
        // Each check consumes two calls (project-monthly, then user-daily).
        expect(mockedCheck.mock.calls[2][1]).toBe(getMemoryOpsQuota('pro').writes);
    });

    it('search and write customs apply to their own op only', async () => {
        await checkMemoryOpsQuota('proj_1', 'pro', 'user_a', 'search', {
            maxSearchesMonthly: 111,
            maxWritesMonthly: 222,
        });
        expect(mockedCheck.mock.calls[0][1]).toBe(111);
        await checkMemoryOpsQuota('proj_1', 'pro', 'user_a', 'write', {
            maxSearchesMonthly: 111,
            maxWritesMonthly: 222,
        });
        expect(mockedCheck.mock.calls[2][1]).toBe(222);
    });
});
describe('buildMemoryOpsExceededBody', () => {
    it('matches the 429 payload shape', () => {
        const body = buildMemoryOpsExceededBody('proj_xxx', 'free', 'write', {
            allowed: false,
            used: 2000,
            limit: 2000,
            resetMs: 12345,
            scope: 'project',
        });
        expect(body).toEqual({
            error: {
                code: 'memory_ops_quota_exceeded',
                message: 'Project has exceeded its memory write operations allowance for this period.',
                upgradeUrl: 'https://cencori.com/pricing?upgrade=memory&project=proj_xxx',
                tier: 'free',
                op: 'write',
                scope: 'project',
                used: 2000,
                limit: 2000,
                retryAfterMs: 12345,
            },
        });
    });
});

describe('MemoryOpsExceededError', () => {
    it('carries op + status for route mapping', () => {
        const status = { allowed: false, used: 1, limit: 1, resetMs: 5, scope: 'user' as const };
        const err = new MemoryOpsExceededError('search', status);
        expect(err.op).toBe('search');
        expect(err.status).toBe(status);
        expect(err.name).toBe('MemoryOpsExceededError');
    });
});
