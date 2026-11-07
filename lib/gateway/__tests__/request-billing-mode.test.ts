import { describe, expect, it } from 'vitest';
import { requestBillingMode } from '@/lib/gateway-middleware';

const ctx = (sponsoredModels: string[] | null = null, fullySponsoredKey = false) => ({ sponsoredModels, fullySponsoredKey });

describe('requestBillingMode', () => {
  it('is standard when Cencori charged for the call', () => {
    expect(requestBillingMode(ctx(), { model: 'gpt-x', providerCostUsd: 1, cencoriChargeUsd: 1.05 })).toBe('standard');
    // Callers that only pass costUsd are still recognised as charged.
    expect(requestBillingMode(ctx(), { model: 'gpt-x', providerCostUsd: 1, costUsd: 1.05 })).toBe('standard');
  });

  it("is byok when Cencori charged nothing but the customer's provider did", () => {
    expect(requestBillingMode(ctx(), { model: 'gpt-x', providerCostUsd: 0.4, cencoriChargeUsd: 0 })).toBe('byok');
  });

  it('is sponsored, never byok, for sponsored models or fully sponsored keys', () => {
    expect(requestBillingMode(ctx(['GPT-X']), { model: 'gpt-x', providerCostUsd: 0.4, cencoriChargeUsd: 0 })).toBe('sponsored');
    expect(requestBillingMode(ctx(null, true), { model: 'other', providerCostUsd: 0.4, cencoriChargeUsd: 0 })).toBe('sponsored');
  });

  it('is free when nobody paid anything', () => {
    expect(requestBillingMode(ctx(), { model: 'llama-free', providerCostUsd: 0, cencoriChargeUsd: 0 })).toBe('free');
  });
});
