export const CARD_TOPUP_FEE_PERCENT = 5.5;
export const CRYPTO_TOPUP_FEE_PERCENT = 6.5;

export function netTopupCredits(grossUsd: number, feePercent: number): number {
  return Math.round((grossUsd * (1 - feePercent / 100) + Number.EPSILON) * 100) / 100;
}
