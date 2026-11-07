/**
 * Naira per US dollar of credit, for packs paid in naira: market rate plus a
 * margin for FX moves and VAT. Credits stay in dollars; this sets the naira
 * checkout price and the rate the dashboard shows naira at, so a balance
 * reads in the same naira the customer paid. Set 2026-11-07 when the market
 * was about ₦1,348. Changing it means changing the Bachs NGN prices too (see
 * CREDIT_TOPUP_PACKS in lib/bachsClient.ts).
 */
export const CREDIT_NGN_PER_USD = 1_500;

export const CARD_TOPUP_FEE_PERCENT = 5.5;
export const CRYPTO_TOPUP_FEE_PERCENT = 6.5;

export function netTopupCredits(grossUsd: number, feePercent: number): number {
  return Math.round((grossUsd * (1 - feePercent / 100) + Number.EPSILON) * 100) / 100;
}

/** Naira top-ups take any whole-naira amount in this range. */
export const NGN_TOPUP_MIN = 2_000;
export const NGN_TOPUP_MAX = 5_000_000;

/** A naira top-up amount from user input, or null if it isn't a whole number of naira in range. */
export function parseNgnTopupAmount(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : NaN;
  if (!Number.isSafeInteger(amount)) return null;
  if (amount < NGN_TOPUP_MIN || amount > NGN_TOPUP_MAX) return null;
  return amount;
}

/** Dollar credit a naira payment buys: at CREDIT_NGN_PER_USD, less the card top-up fee. */
export function ngnTopupCredits(amountNgn: number): number {
  return netTopupCredits(amountNgn / CREDIT_NGN_PER_USD, CARD_TOPUP_FEE_PERCENT);
}
