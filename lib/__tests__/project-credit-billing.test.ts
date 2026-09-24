import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/providers/pricing', () => ({
    getPricingFromDB: vi.fn().mockResolvedValue({
        inputPer1KTokens: 0.002,
        outputPer1KTokens: 0.01,
        cencoriMarkupPercentage: 50,
        fixedFeePerRequest: 0.001,
    }),
}));
vi.mock('@/lib/credits', () => ({ deductCredits: vi.fn() }));

import { calculateTokenCharge, shouldEnforceProjectCredits } from '@/lib/project-credit-billing';

describe('project usage credits', () => {
    it('requires prepaid credits on free and paid tiers, except enterprise contracts', () => {
        expect(shouldEnforceProjectCredits('free')).toBe(true);
        expect(shouldEnforceProjectCredits('pro')).toBe(true);
        expect(shouldEnforceProjectCredits('enterprise')).toBe(false);
    });

    it('does not deduct Cencori usage for BYOK while retaining the provider estimate', async () => {
        expect(await calculateTokenCharge('openai', 'test-model', 1000, 500, true)).toEqual({
            providerCostUsd: 0.007,
            cencoriChargeUsd: 0,
            markupPercentage: 0,
        });
    });

    it('charges the configured provider rate on managed keys', async () => {
        expect(await calculateTokenCharge('openai', 'test-model', 1000, 500)).toEqual({
            providerCostUsd: 0.007,
            cencoriChargeUsd: 0.007,
            markupPercentage: 0,
        });
    });
});
