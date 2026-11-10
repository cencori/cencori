/**
 * Pro paid in naira on Bachs, as a prepaid pass (a month or a year).
 *
 * Bachs can't run NGN subscriptions yet, so a naira Pro is a product-less
 * Bachs checkout for exactly the plan's naira price. A paid charge, fetched
 * back from Bachs and verified, gives the org Pro until the period ends.
 * Paying again before the period ends adds the new period to the end of the
 * current one. When a pass is not renewed, plan-state.ts treats it as a lapse
 * (7 days of grace, then paused), the same as any other Pro.
 */

import type { BachsCharge } from "@/lib/bachsClient";
import {
  CENCORI_PAID_PLANS,
  isPlanBillingInterval,
  type PlanBillingInterval,
} from "@/lib/billing/plans";

export const NAIRA_PLAN_PASS_PURCHASE_TYPE = "plan_pass_ngn";

/** Only Pro is sold. Team is kept for existing subscribers and has no naira price. */
export type NairaPassTier = "pro";

export function isNairaPassTier(value: unknown): value is NairaPassTier {
  return value === "pro";
}

/** The plan's naira price for one period, in whole naira, or null when none is set. */
export function nairaPassPriceNgn(
  tier: NairaPassTier,
  interval: PlanBillingInterval,
): number | null {
  return CENCORI_PAID_PLANS[tier].ngnPrices?.[interval] ?? null;
}

export type NairaPassVerification =
  | { ok: true; tier: NairaPassTier; interval: PlanBillingInterval; amount: number; currency: "NGN" | "USD" }
  | { ok: false; reason: string };

const PAID_STATUSES = new Set(["succeeded", "successful", "paid"]);

/**
 * Whether a charge fetched back from Bachs pays for the pass the signed
 * webhook names. Tier and interval come from the webhook's metadata (signed
 * by Bachs, set by our checkout route); the charge must agree with them where
 * it echoes them, be paid, be in naira and cover the full naira price.
 */
export function verifyNairaPassCharge(params: {
  charge: BachsCharge | null | undefined;
  chargeId: string;
  organizationId: string;
  metadata: Record<string, string> | null | undefined;
}): NairaPassVerification {
  const { charge, chargeId, organizationId } = params;
  const metadata = params.metadata ?? {};

  const tier = metadata.tier;
  const interval = metadata.interval;
  if (!isNairaPassTier(tier)) return { ok: false, reason: "unknown_tier" };
  if (!isPlanBillingInterval(interval)) return { ok: false, reason: "unknown_interval" };
  const priceNgn = nairaPassPriceNgn(tier, interval);
  if (!priceNgn) return { ok: false, reason: "no_naira_price" };

  if (!charge || charge.charge_id !== chargeId) return { ok: false, reason: "charge_id_mismatch" };
  if (!PAID_STATUSES.has(String(charge.status ?? "").toLowerCase())) {
    return { ok: false, reason: "unsettled_status" };
  }
  const amountMajor = Number(String(charge.amount ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) return { ok: false, reason: "invalid_amount" };

  // Bachs's checkout can show a currency switcher even on a naira price. A
  // customer who switched to dollars still paid for the plan if they paid at
  // least its dollar price; anything else is checked in naira.
  const currency = String(charge.currency ?? "").toUpperCase();
  if (currency === "USD") {
    const cents = Math.round(amountMajor * 100);
    if (cents < CENCORI_PAID_PLANS[tier].prices[interval]) return { ok: false, reason: "amount_below_price" };
  } else if (currency === "NGN") {
    if (Math.floor(amountMajor) < priceNgn) return { ok: false, reason: "amount_below_price" };
  } else {
    return { ok: false, reason: "currency_mismatch" };
  }

  // A missing echo is fine (Bachs doesn't always return metadata on the
  // charge); a contradicting one is not.
  const echoed = (charge.metadata ?? {}) as Record<string, unknown>;
  const contradicts = (key: string, expected: string) => {
    const value = echoed[key];
    return value != null && String(value).trim() !== "" && String(value) !== expected;
  };
  if (contradicts("purchase_type", NAIRA_PLAN_PASS_PURCHASE_TYPE)) {
    return { ok: false, reason: "metadata_purchase_type_mismatch" };
  }
  if (contradicts("org_id", organizationId)) return { ok: false, reason: "metadata_org_mismatch" };
  if (contradicts("tier", tier)) return { ok: false, reason: "metadata_tier_mismatch" };
  if (contradicts("interval", interval)) return { ok: false, reason: "metadata_interval_mismatch" };

  // Product-less checkout: a cart means this charge was for something else.
  if (Array.isArray(charge.product_cart) && charge.product_cart.length > 0) {
    return { ok: false, reason: "unexpected_product_cart" };
  }

  return { ok: true, tier, interval, amount: amountMajor, currency: currency as "NGN" | "USD" };
}

export type NairaPassOrg = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
  billing_provider?: string | null;
  subscription_id?: string | null;
};

function addInterval(from: Date, interval: PlanBillingInterval): Date {
  const d = new Date(from);
  if (interval === "year") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/**
 * The paid period a verified pass gives. A naira Pro still running is
 * extended from its current end, so renewing early loses no days; anything
 * else starts now.
 */
export function nairaPassPeriod(
  org: NairaPassOrg | null | undefined,
  interval: PlanBillingInterval,
  now: Date = new Date(),
): { start: string; end: string } {
  const currentEnd = org?.subscription_current_period_end
    ? new Date(org.subscription_current_period_end)
    : null;
  const extending =
    isNairaPassOrg(org) &&
    currentEnd !== null &&
    !Number.isNaN(currentEnd.getTime()) &&
    currentEnd.getTime() > now.getTime();
  const from = extending ? currentEnd! : now;
  return { start: now.toISOString(), end: addInterval(from, interval).toISOString() };
}

/** Naira Pro: Pro on Bachs as a prepaid pass, which has no subscription id. */
export function isNairaPassOrg(org: NairaPassOrg | null | undefined): boolean {
  return org?.subscription_tier === "pro" && org.billing_provider === "bachs" && !org.subscription_id;
}

/**
 * Whether this org can buy a naira pass: a Free org upgrading, or an org
 * already on naira Pro renewing. An org with a card subscription can't, or
 * it would pay twice for the same plan.
 */
export function canBuyNairaPass(org: NairaPassOrg | null | undefined): boolean {
  const tier = org?.subscription_tier ?? "free";
  if (tier === "free") return true;
  return isNairaPassOrg(org);
}
