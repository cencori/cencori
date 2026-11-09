/**
 * Cencori's own plans (Pro) billed as Bachs subscriptions.
 *
 * Each plan and interval is a recurring Bachs product (BACHS_PRODUCT_PRO_*).
 * Before a checkout is opened, the product is read back from Bachs and must
 * match lib/billing/plans.ts exactly: USD, the plan's price, and a billing
 * cycle of one month or one year. A mismatch refuses the checkout, so a
 * stale or one-time product can never charge a customer the wrong amount.
 */

import type { createAdminClient } from "@/lib/supabaseAdmin";
import {
  BACHS_CONFIG,
  createCustomer,
  getProduct,
  type BachsProduct,
} from "@/lib/bachsClient";
import {
  CENCORI_PAID_PLANS,
  type PaidPlanTier,
  type PlanBillingInterval,
} from "@/lib/billing/plans";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Only Pro is sold. Team is kept for existing subscribers and isn't sold. */
export type BachsPlanTier = Extract<PaidPlanTier, "pro">;

export function getBachsPlanProductId(
  tier: BachsPlanTier,
  interval: PlanBillingInterval,
): string | null {
  const products = BACHS_CONFIG.products;
  const id = tier === "pro" ? (interval === "year" ? products.proAnnual : products.proMonthly) : "";
  return id || null;
}

export type PlanProductCheck = { ok: true } | { ok: false; reason: string };

/** Whether a Bachs product is exactly this plan: recurring, USD, the plan's price. */
export function checkPlanProduct(
  product: BachsProduct | null | undefined,
  tier: BachsPlanTier,
  interval: PlanBillingInterval,
): PlanProductCheck {
  if (!product) return { ok: false, reason: "product_missing" };
  if (product.status && product.status !== "active") return { ok: false, reason: "product_inactive" };

  const cycle = product.billing_cycle;
  if (!cycle) return { ok: false, reason: "not_recurring" };
  if (cycle.interval !== interval || cycle.frequency !== 1) {
    return { ok: false, reason: "billing_cycle_mismatch" };
  }

  const price = product.price;
  if (!price || String(price.currency).toUpperCase() !== "USD") {
    return { ok: false, reason: "currency_mismatch" };
  }
  if (price.price_type !== "fixed") return { ok: false, reason: "price_not_fixed" };

  const cents = Math.round(Number(price.amount) * 100);
  if (!Number.isFinite(cents) || cents !== CENCORI_PAID_PLANS[tier].prices[interval]) {
    return { ok: false, reason: "price_mismatch" };
  }
  return { ok: true };
}

const verifiedProducts = new Map<string, number>();
const VERIFIED_FOR_MS = 10 * 60 * 1000;

/**
 * The plan's Bachs product id, once Bachs confirms it matches the plan.
 * Throws with a reason when it doesn't, or when none is configured.
 */
export async function getVerifiedPlanProductId(
  tier: BachsPlanTier,
  interval: PlanBillingInterval,
): Promise<string> {
  const productId = getBachsPlanProductId(tier, interval);
  if (!productId) throw new Error(`No Bachs product is configured for ${tier} (${interval})`);

  const verifiedAt = verifiedProducts.get(productId);
  if (verifiedAt && Date.now() - verifiedAt < VERIFIED_FOR_MS) return productId;

  const check = checkPlanProduct(await getProduct(productId), tier, interval);
  if (!check.ok) {
    verifiedProducts.delete(productId);
    throw new Error(`Bachs product ${productId} doesn't match ${tier} (${interval}): ${check.reason}`);
  }
  verifiedProducts.set(productId, Date.now());
  return productId;
}

export type BachsCustomerOrg = {
  id: string;
  slug: string;
  name: string | null;
  billing_email: string | null;
  bachs_customer_id: string | null;
};

/**
 * The org's Bachs customer, created and saved on first use. One customer per
 * org, so every webhook (subscription, invoice, charge) can be traced back to
 * the org by customer id even when Bachs leaves metadata out.
 */
export async function ensureBachsCustomer(
  admin: AdminClient,
  org: BachsCustomerOrg,
  fallback: { email: string; name: string },
): Promise<string> {
  if (org.bachs_customer_id) return org.bachs_customer_id;

  const customer = await createCustomer({
    email: org.billing_email || fallback.email,
    name: org.name || fallback.name,
    metadata: { org_id: org.id, org_slug: org.slug },
  });

  // Only claim it if no concurrent request saved one first.
  const { data: saved, error } = await admin
    .from("organizations")
    .update({ bachs_customer_id: customer.customer_id })
    .eq("id", org.id)
    .is("bachs_customer_id", null)
    .select("bachs_customer_id")
    .maybeSingle();
  if (error) throw new Error(`Could not save the Bachs customer: ${error.message}`);
  if (saved?.bachs_customer_id) return saved.bachs_customer_id as string;

  const { data: current, error: readError } = await admin
    .from("organizations")
    .select("bachs_customer_id")
    .eq("id", org.id)
    .maybeSingle();
  if (readError || !current?.bachs_customer_id) {
    throw new Error("Could not save the Bachs customer");
  }
  return current.bachs_customer_id as string;
}

export type CardCheckoutOrg = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  subscription_id?: string | null;
  subscription_current_period_end?: string | null;
  billing_provider?: string | null;
};

const LIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

/**
 * Whether the org may start a Pro subscription by card on Bachs: Free orgs,
 * orgs still on the retired Stripe billing (they move by subscribing here),
 * and naira-pass orgs whose prepaid period has ended. An org with a live
 * Bachs subscription or prepaid time left can't, or it would pay twice.
 */
export function canStartCardSubscription(
  org: CardCheckoutOrg | null | undefined,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: "already_subscribed" | "naira_period_running" | "not_self_serve" } {
  const tier = org?.subscription_tier ?? "free";
  if (tier === "free") return { ok: true };
  if (tier === "enterprise") return { ok: false, reason: "not_self_serve" };
  if (org?.billing_provider === "stripe") return { ok: true };

  if (org?.billing_provider === "bachs") {
    if (org.subscription_id) {
      return LIVE_SUBSCRIPTION_STATUSES.has(org.subscription_status ?? "")
        ? { ok: false, reason: "already_subscribed" }
        : { ok: true };
    }
    const end = org.subscription_current_period_end ? Date.parse(org.subscription_current_period_end) : NaN;
    return Number.isFinite(end) && end > now.getTime()
      ? { ok: false, reason: "naira_period_running" }
      : { ok: true };
  }
  return { ok: false, reason: "already_subscribed" };
}

const PAID_CHARGE_STATUSES = new Set(["succeeded", "successful", "paid"]);

/**
 * Whether a charge fetched back from Bachs pays for this plan subscription:
 * paid, in US dollars, at least the plan's price for the interval.
 */
export function verifySubscriptionCharge(params: {
  charge: { charge_id?: string; status?: string; currency?: string; amount?: string } | null | undefined;
  chargeId: string;
  tier: BachsPlanTier;
  interval: PlanBillingInterval;
}): { ok: true } | { ok: false; reason: string } {
  const { charge, chargeId, tier, interval } = params;
  if (!charge || charge.charge_id !== chargeId) return { ok: false, reason: "charge_id_mismatch" };
  if (!PAID_CHARGE_STATUSES.has(String(charge.status ?? "").toLowerCase())) {
    return { ok: false, reason: "unsettled_status" };
  }
  if (String(charge.currency ?? "").toUpperCase() !== "USD") return { ok: false, reason: "currency_mismatch" };
  const cents = Math.round(Number(String(charge.amount ?? "").replace(/,/g, "")) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return { ok: false, reason: "invalid_amount" };
  if (cents < CENCORI_PAID_PLANS[tier].prices[interval]) return { ok: false, reason: "amount_below_price" };
  return { ok: true };
}
