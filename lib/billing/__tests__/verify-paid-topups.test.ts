import { describe, expect, it } from 'vitest';
import type { BachsCharge } from '@/lib/bachsClient';
import type { CoinCircuitWebhookPayload } from '@/lib/coincircuit';
import { isVerifiedBachsTopupCharge, isVerifiedCryptoTopupSession } from '@/lib/billing/verify-paid-topups';

const bachsCharge = {
  charge_id: 'charge-1',
  status: 'succeeded',
  currency: 'USD',
  amount: '10.90',
  metadata: { purchase_type: 'credits_topup', org_id: 'org-1' },
  product_cart: [{ product_id: 'starter-product', quantity: 1 }],
} as BachsCharge;

const cryptoSession = {
  reference: 'session-1',
  state: 'closed',
  currency: 'USD',
  amount: '10.00',
  fiatAmountPaid: '10.00',
  isRefunded: false,
} as CoinCircuitWebhookPayload['data']['session'];

describe('paid top-up verification', () => {
  it('requires a settled Bachs charge for the expected organization, product, and amount', () => {
    const expected = {
      charge: bachsCharge,
      chargeId: 'charge-1',
      organizationId: 'org-1',
      productId: 'starter-product',
      minimumAmountMinor: 1000,
    };
    expect(isVerifiedBachsTopupCharge(expected)).toBe(true);
    expect(isVerifiedBachsTopupCharge({ ...expected, organizationId: 'other-org' })).toBe(false);
    expect(isVerifiedBachsTopupCharge({ ...expected, charge: { ...bachsCharge, amount: '9.99' } })).toBe(false);
    expect(isVerifiedBachsTopupCharge({ ...expected, charge: { ...bachsCharge, status: 'pending' } })).toBe(false);
    expect(isVerifiedBachsTopupCharge({ ...expected, charge: { ...bachsCharge, product_cart: [{ product_id: 'other', quantity: 1 }] } })).toBe(false);
  });

  it('requires a completed USD crypto session at the configured pack amount', () => {
    expect(isVerifiedCryptoTopupSession(cryptoSession, 10)).toBe(true);
    expect(isVerifiedCryptoTopupSession({ ...cryptoSession, currency: 'NGN' }, 10)).toBe(false);
    expect(isVerifiedCryptoTopupSession({ ...cryptoSession, fiatAmountPaid: '9.99' }, 10)).toBe(false);
    expect(isVerifiedCryptoTopupSession({ ...cryptoSession, isRefunded: true }, 10)).toBe(false);
  });
});
