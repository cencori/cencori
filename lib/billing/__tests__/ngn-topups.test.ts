import { describe, expect, it } from 'vitest';
import type { BachsCharge } from '@/lib/bachsClient';
import { verifyBachsNgnTopupCharge } from '@/lib/billing/verify-paid-topups';
import { ngnTopupCredits, parseNgnTopupAmount } from '@/lib/billing/credit-pricing';

const charge = {
  charge_id: 'charge-ngn',
  status: 'succeeded',
  currency: 'NGN',
  amount: '15000.00',
  metadata: { purchase_type: 'credits_topup_ngn', org_id: 'org-1' },
  product_cart: null,
} as unknown as BachsCharge;

const verify = (overrides: Partial<BachsCharge> = {}, organizationId = 'org-1') =>
  verifyBachsNgnTopupCharge({ charge: { ...charge, ...overrides } as BachsCharge, chargeId: 'charge-ngn', organizationId });

describe('naira top-up amounts', () => {
  it('accepts whole naira from ₦2,000 to ₦5,000,000', () => {
    expect(parseNgnTopupAmount(2000)).toBe(2000);
    expect(parseNgnTopupAmount('15,000')).toBe(15000);
    expect(parseNgnTopupAmount(5_000_000)).toBe(5_000_000);
    expect(parseNgnTopupAmount(1999)).toBeNull();
    expect(parseNgnTopupAmount(5_000_001)).toBeNull();
    expect(parseNgnTopupAmount(2500.5)).toBeNull();
    expect(parseNgnTopupAmount('abc')).toBeNull();
    expect(parseNgnTopupAmount(null)).toBeNull();
  });

  it('credits at ₦1,500 per $1 less the 5.5% fee', () => {
    expect(ngnTopupCredits(15000)).toBe(9.45);
    expect(ngnTopupCredits(2000)).toBe(1.26);
  });
});

describe('naira top-up verification', () => {
  it('verifies a settled naira charge and returns the paid amount', () => {
    expect(verify()).toEqual({ ok: true, amountNgn: 15000 });
  });

  it('credits on whole naira paid, dropping kobo', () => {
    expect(verify({ amount: '15000.99' })).toEqual({ ok: true, amountNgn: 15000 });
  });

  it('rejects anything that is not a settled naira payment in range for this org', () => {
    expect(verify({ status: 'pending' })).toEqual({ ok: false, reason: 'unsettled_status' });
    expect(verify({ currency: 'USD' })).toEqual({ ok: false, reason: 'currency_mismatch' });
    expect(verify({ amount: '1999.00' })).toEqual({ ok: false, reason: 'amount_below_minimum' });
    expect(verify({ amount: '5000001.00' })).toEqual({ ok: false, reason: 'amount_above_maximum' });
    expect(verify({ amount: 'nope' })).toEqual({ ok: false, reason: 'invalid_amount' });
    expect(verify({ charge_id: 'other' })).toEqual({ ok: false, reason: 'charge_id_mismatch' });
    expect(verify({}, 'other-org')).toEqual({ ok: false, reason: 'metadata_org_mismatch' });
    expect(verify({ metadata: { purchase_type: 'credits_topup', org_id: 'org-1' } }))
      .toEqual({ ok: false, reason: 'metadata_purchase_type_mismatch' });
    expect(verify({ product_cart: [{ product_id: 'starter', quantity: 1 }] }))
      .toEqual({ ok: false, reason: 'unexpected_product_cart' });
  });

  it('does not fail when Bachs omits the metadata echo', () => {
    expect(verify({ metadata: {} as Record<string, string> })).toEqual({ ok: true, amountNgn: 15000 });
  });
});
