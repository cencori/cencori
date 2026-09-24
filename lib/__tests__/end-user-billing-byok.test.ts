import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseAdmin', () => ({
    createAdminClient: () => ({ rpc: mockRpc }),
}));

import { recordEndUserUsageAsync } from '@/lib/end-user-billing';

describe('BYOK end-user billing', () => {
    beforeEach(() => {
        mockRpc.mockReset();
        mockRpc.mockResolvedValue({ error: null });
    });

    it('keeps the customer markup and cost cap based on provider cost when Cencori charges zero', async () => {
        await recordEndUserUsageAsync({
            projectId: 'project-1',
            externalUserId: 'customer-1',
            tokens: { prompt: 800, completion: 200, total: 1000 },
            cost: { providerUsd: 0.01, cencoriChargeUsd: 0 },
            customerMarkupPercentage: 20,
            flatRatePerRequest: null,
            currency: 'USD',
            pricingModel: 'flat',
            pricingTiers: [],
            monthlyTokensUsed: 0,
            platformCommissionPercentage: 20,
        });

        expect(mockRpc).toHaveBeenCalledWith('increment_end_user_usage', expect.objectContaining({
            p_total_cost_usd: 0.01,
            p_provider_cost_usd: 0.01,
            p_customer_charge_usd: 0.012,
            p_platform_commission_usd: expect.closeTo(0.0004),
        }));
    });
});
