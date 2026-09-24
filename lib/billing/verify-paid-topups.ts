import type { BachsCharge } from '@/lib/bachsClient';
import type { CoinCircuitWebhookPayload } from '@/lib/coincircuit';

export function isVerifiedBachsTopupCharge(params: {
  charge: BachsCharge;
  chargeId: string;
  organizationId: string;
  productId: string;
  minimumAmountMinor: number;
}): boolean {
  const { charge, chargeId, organizationId, productId, minimumAmountMinor } = params;
  const amountMajor = Number(charge.amount);
  const amountMinor = Number.isFinite(amountMajor) ? Math.round(amountMajor * 100) : NaN;
  return charge.charge_id === chargeId
    && ['succeeded', 'successful', 'paid'].includes(charge.status)
    && charge.currency === 'USD'
    && Number.isSafeInteger(amountMinor)
    && amountMinor >= minimumAmountMinor
    && charge.metadata?.purchase_type === 'credits_topup'
    && charge.metadata?.org_id === organizationId
    && charge.product_cart?.length === 1
    && charge.product_cart[0]?.product_id === productId
    && charge.product_cart[0]?.quantity === 1;
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
