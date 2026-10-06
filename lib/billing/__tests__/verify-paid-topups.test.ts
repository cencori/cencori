import { describe, expect, it } from 'vitest';
import type { BachsCharge } from '@/lib/bachsClient';
import type { CoinCircuitWebhookPayload } from '@/lib/coincircuit';
import { getBachsTopupVerificationFailure, isVerifiedBachsTopupCharge, isVerifiedCryptoTopupSession } from '@/lib/billing/verify-paid-topups';

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

  it('trusts the signed event binding when the charge API omits the metadata/cart echo', () => {
    // Regression: Bachs does not reliably echo checkout metadata on the
    // charge object. Absence must not fail a settled payment for the pack
    // minimum — this left every post-Sep-2026 top-up at 500 with no grant.
    const expected = {
      chargeId: 'charge-1',
      organizationId: 'org-1',
      productId: 'starter-product',
      minimumAmountMinor: 1000,
    };
    const noEcho = {
      charge_id: 'charge-1',
      status: 'succeeded',
      currency: 'USD',
      amount: '52.90',
    } as BachsCharge;
    expect(isVerifiedBachsTopupCharge({ ...expected, charge: noEcho })).toBe(true);
    expect(getBachsTopupVerificationFailure({ ...expected, charge: noEcho })).toBeNull();

    // Normalizes provider casing and tolerates fee line items in the cart.
    const casing = { ...bachsCharge, status: 'Successful', currency: 'usd' };
    expect(isVerifiedBachsTopupCharge({
      charge: casing,
      chargeId: 'charge-1',
      organizationId: 'org-1',
      productId: 'starter-product',
      minimumAmountMinor: 1000,
    })).toBe(true);
    const withFeeLine = {
      ...bachsCharge,
      product_cart: [
        { product_id: 'starter-product', quantity: 1 },
        { product_id: 'processing-fee', quantity: 1 },
      ],
    } as BachsCharge;
    expect(isVerifiedBachsTopupCharge({
      charge: withFeeLine,
      chargeId: 'charge-1',
      organizationId: 'org-1',
      productId: 'starter-product',
      minimumAmountMinor: 1000,
    })).toBe(true);
  });

  it('fails on a contradictory charge echo with a diagnosable reason', () => {
    const base = {
      chargeId: 'charge-1',
      organizationId: 'org-1',
      productId: 'starter-product',
      minimumAmountMinor: 1000,
    };
    expect(getBachsTopupVerificationFailure({
      ...base,
      charge: { ...bachsCharge, metadata: { purchase_type: 'credits_topup', org_id: 'other-org' } },
    })).toBe('metadata_org_mismatch');
    expect(getBachsTopupVerificationFailure({
      ...base,
      charge: { ...bachsCharge, amount: '9.99' },
    })).toBe('amount_below_minimum');
    expect(getBachsTopupVerificationFailure({
      ...base,
      charge: { ...bachsCharge, status: 'pending' },
    })).toBe('unsettled_status');
  });

  it('requires a completed USD crypto session at the configured pack amount', () => {
    expect(isVerifiedCryptoTopupSession(cryptoSession, 10)).toBe(true);
    expect(isVerifiedCryptoTopupSession({ ...cryptoSession, currency: 'NGN' }, 10)).toBe(false);
    expect(isVerifiedCryptoTopupSession({ ...cryptoSession, fiatAmountPaid: '9.99' }, 10)).toBe(false);
    expect(isVerifiedCryptoTopupSession({ ...cryptoSession, isRefunded: true }, 10)).toBe(false);
  });
});
