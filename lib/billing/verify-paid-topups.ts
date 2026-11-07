import type { BachsCharge } from '@/lib/bachsClient';
import type { CoinCircuitWebhookPayload } from '@/lib/coincircuit';
import { NGN_TOPUP_MAX, NGN_TOPUP_MIN } from '@/lib/billing/credit-pricing';

export function getBachsTopupVerificationFailure(params: {
  charge: BachsCharge;
  chargeId: string;
  organizationId: string;
  productId: string;
  /** Pack price in US cents. */
  minimumAmountMinor: number;
  /** Pack price in kobo, for naira checkouts. Absent = naira not accepted. */
  minimumNgnAmountMinor?: number | null;
}): string | null {
  const { charge, chargeId, organizationId, productId } = params;
  if (!charge || charge.charge_id !== chargeId) return 'charge_id_mismatch';

  const status = String(charge.status ?? '').toLowerCase();
  if (!['succeeded', 'successful', 'paid'].includes(status)) return 'unsettled_status';

  // Bachs lets the buyer pay in naira at the product's NGN price, so each
  // currency is checked against its own configured price.
  const currency = String(charge.currency ?? '').toUpperCase();
  const minimumAmountMinor = currency === 'USD'
    ? params.minimumAmountMinor
    : currency === 'NGN' ? params.minimumNgnAmountMinor : null;
  if (minimumAmountMinor == null) return 'currency_mismatch';

  const amountMajor = Number(String(charge.amount ?? '').replace(/,/g, '').trim());
  const amountMinor = Number.isFinite(amountMajor) ? Math.round(amountMajor * 100) : NaN;
  if (!Number.isSafeInteger(amountMinor) || amountMinor < minimumAmountMinor) {
    return 'amount_below_minimum';
  }

  // The signed webhook event is the binding anchor for org/product. The
  // independently fetched charge proves payment; its metadata/cart echo is
  // defense-in-depth. Fail on contradiction, not on absence: Bachs does not
  // reliably echo checkout metadata on the charge object, and absence must
  // not block a verified payment (this caused all top-ups to 500 with no
  // grant row after the Sep 2026 atomic-topup rollout).
  const metadata = (charge.metadata ?? {}) as Record<string, unknown>;
  const echoedPurchaseType = metadata.purchase_type;
  if (
    echoedPurchaseType != null &&
    String(echoedPurchaseType).trim() !== '' &&
    echoedPurchaseType !== 'credits_topup'
  ) {
    return 'metadata_purchase_type_mismatch';
  }
  const echoedOrgId = metadata.org_id;
  if (
    echoedOrgId != null &&
    String(echoedOrgId).trim() !== '' &&
    echoedOrgId !== organizationId
  ) {
    return 'metadata_org_mismatch';
  }

  const cart = charge.product_cart;
  if (Array.isArray(cart) && cart.length > 0) {
    const line = cart.find((item) => item?.product_id === productId);
    if (!line) return 'product_mismatch';
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || Math.round(quantity) !== 1) {
      return 'quantity_mismatch';
    }
  }

  return null;
}

/**
 * Verifies a naira top-up of any amount (a product-less Bachs checkout).
 * Returns the paid amount in whole naira, or the reason it didn't verify.
 * Credit is computed from this paid amount, so what the browser asked for at
 * checkout never decides the grant.
 */
export function verifyBachsNgnTopupCharge(params: {
  charge: BachsCharge;
  chargeId: string;
  organizationId: string;
}): { ok: true; amountNgn: number } | { ok: false; reason: string } {
  const { charge, chargeId, organizationId } = params;
  if (!charge || charge.charge_id !== chargeId) return { ok: false, reason: 'charge_id_mismatch' };

  const status = String(charge.status ?? '').toLowerCase();
  if (!['succeeded', 'successful', 'paid'].includes(status)) return { ok: false, reason: 'unsettled_status' };

  if (String(charge.currency ?? '').toUpperCase() !== 'NGN') return { ok: false, reason: 'currency_mismatch' };

  const amountMajor = Number(String(charge.amount ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) return { ok: false, reason: 'invalid_amount' };
  // Kobo are dropped: credit is only ever granted on whole naira paid.
  const amountNgn = Math.floor(amountMajor);
  if (amountNgn < NGN_TOPUP_MIN) return { ok: false, reason: 'amount_below_minimum' };
  if (amountNgn > NGN_TOPUP_MAX) return { ok: false, reason: 'amount_above_maximum' };

  // Same rule as packs: fail on a contradicting echo, not on a missing one.
  const metadata = (charge.metadata ?? {}) as Record<string, unknown>;
  const echoedPurchaseType = metadata.purchase_type;
  if (echoedPurchaseType != null && String(echoedPurchaseType).trim() !== ''
      && echoedPurchaseType !== 'credits_topup_ngn') {
    return { ok: false, reason: 'metadata_purchase_type_mismatch' };
  }
  const echoedOrgId = metadata.org_id;
  if (echoedOrgId != null && String(echoedOrgId).trim() !== '' && echoedOrgId !== organizationId) {
    return { ok: false, reason: 'metadata_org_mismatch' };
  }

  // A product-less checkout has no cart. A cart here means this charge was
  // for something else.
  if (Array.isArray(charge.product_cart) && charge.product_cart.length > 0) {
    return { ok: false, reason: 'unexpected_product_cart' };
  }

  return { ok: true, amountNgn };
}

export function isVerifiedBachsTopupCharge(params: {
  charge: BachsCharge;
  chargeId: string;
  organizationId: string;
  productId: string;
  minimumAmountMinor: number;
  minimumNgnAmountMinor?: number | null;
}): boolean {
  return getBachsTopupVerificationFailure(params) === null;
}

export function isVerifiedCryptoTopupSession(
  session: CoinCircuitWebhookPayload['data']['session'],
  expectedAmountUsd: number,
): boolean {
  const paidUsd = session.fiatAmountPaid == null ? null : Number(session.fiatAmountPaid);
  return session.currency === 'USD'
    && session.state === 'closed'
    && !session.isRefunded
    && Number(session.amount) === expectedAmountUsd
    && (paidUsd === null || (Number.isFinite(paidUsd) && paidUsd >= expectedAmountUsd));
}
