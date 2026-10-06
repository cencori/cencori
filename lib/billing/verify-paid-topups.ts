import type { BachsCharge } from '@/lib/bachsClient';
import type { CoinCircuitWebhookPayload } from '@/lib/coincircuit';

export function getBachsTopupVerificationFailure(params: {
  charge: BachsCharge;
  chargeId: string;
  organizationId: string;
  productId: string;
  minimumAmountMinor: number;
}): string | null {
  const { charge, chargeId, organizationId, productId, minimumAmountMinor } = params;
  if (!charge || charge.charge_id !== chargeId) return 'charge_id_mismatch';

  const status = String(charge.status ?? '').toLowerCase();
  if (!['succeeded', 'successful', 'paid'].includes(status)) return 'unsettled_status';

  const currency = String(charge.currency ?? '').toUpperCase();
  if (currency !== 'USD') return 'currency_mismatch';

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

export function isVerifiedBachsTopupCharge(params: {
  charge: BachsCharge;
  chargeId: string;
  organizationId: string;
  productId: string;
  minimumAmountMinor: number;
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
