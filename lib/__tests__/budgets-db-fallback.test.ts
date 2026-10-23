import { beforeEach, describe, expect, it, vi } from 'vitest';

// Redis unavailable: no Upstash env, so getCurrentMonthSpend uses the DB scan.
const pageCalls = vi.fn();
const projectRow = vi.fn();

vi.mock('@/lib/supabaseAdmin', () => ({
    createAdminClient: () => ({
        from: (table: string) => {
            if (table === 'projects') {
                return { select: () => ({ eq: () => ({ single: async () => projectRow() }) }) };
            }
            const query = {
                select: () => query,
                eq: () => query,
                gte: () => query,
                lt: () => query,
                order: () => query,
                range: async () => {
                    pageCalls();
                    return { data: [{ cencori_charge_usd: 1.5 }, { cencori_charge_usd: 2 }], error: null };
                },
            };
            return query;
        },
    }),
}));
vi.mock('@/lib/webhooks/trigger', () => ({ triggerCostThresholdWebhook: vi.fn() }));

describe('month spend DB fallback (Redis down)', () => {
    beforeEach(() => {
        vi.resetModules();
        pageCalls.mockClear();
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    it('shares one scan between concurrent requests and reuses it', async () => {
        const { getCurrentMonthSpend } = await import('@/lib/budgets');
        const totals = await Promise.all(Array.from({ length: 20 }, () => getCurrentMonthSpend('p1')));
        expect(totals.every((t) => t === 3.5)).toBe(true);
        expect(pageCalls).toHaveBeenCalledTimes(1);

        await getCurrentMonthSpend('p1');
        expect(pageCalls).toHaveBeenCalledTimes(1);
    });

    it('skips the scan on the gateway path when no cap or budget is set', async () => {
        projectRow.mockReturnValue({
            data: { monthly_budget: null, spend_cap: null, enforce_spend_cap: false, budget_alerts_enabled: true },
            error: null,
        });
        const { checkSpendCap } = await import('@/lib/budgets');
        const result = await checkSpendCap('p2');
        expect(result.allowed).toBe(true);
        expect(pageCalls).not.toHaveBeenCalled();
    });

    it('still enforces an enforced spend cap', async () => {
        projectRow.mockReturnValue({
            data: { monthly_budget: null, spend_cap: '3', enforce_spend_cap: true, budget_alerts_enabled: true },
            error: null,
        });
        const { checkSpendCap } = await import('@/lib/budgets');
        const result = await checkSpendCap('p3');
        expect(result.allowed).toBe(false);
        expect(pageCalls).toHaveBeenCalledTimes(1);
    });
});
