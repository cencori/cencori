import type Stripe from "stripe";
import { isPaidPlanTier, type PaidPlanTier } from "@/lib/billing/plans";
import { getStripePlanFromPriceId } from "@/lib/stripe-billing";

export type StripeSubscriptionSnapshot = {
  subscriptionId: string;
  customerId: string;
  status:
    | "active"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "past_due"
    | "paused"
    | "trialing"
    | "unpaid";
  tier: PaidPlanTier | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

const ENTITLED_STATUSES = new Set<StripeSubscriptionSnapshot["status"]>([
  "active",
  "past_due",
  "trialing",
]);

export function normalizeStripeSubscriptionStatus(
  status: StripeSubscriptionSnapshot["status"],
): "active" | "cancelled" | "incomplete" | "past_due" | "paused" | "trialing" | "unpaid" {
  if (status === "canceled" || status === "incomplete_expired") {
    return "cancelled";
  }
  return status;
}

export function buildStripeOrganizationSubscriptionUpdate(
  snapshot: StripeSubscriptionSnapshot,
) {
  const retainsEntitlement = ENTITLED_STATUSES.has(snapshot.status);
  if (retainsEntitlement && !snapshot.tier) return null;

  const tier = retainsEntitlement ? snapshot.tier! : "free";

  return {
    billing_provider: "stripe" as const,
    stripe_customer_id: snapshot.customerId,
    subscription_id: snapshot.subscriptionId,
    subscription_tier: tier,
    subscription_status: normalizeStripeSubscriptionStatus(snapshot.status),
    subscription_current_period_start: snapshot.currentPeriodStart,
    subscription_current_period_end: snapshot.currentPeriodEnd,
  };
}

export function getExpandableId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const firstItem = subscription.items.data[0];
  return {
    start: firstItem?.current_period_start
      ? new Date(firstItem.current_period_start * 1_000).toISOString()
      : null,
    end: firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1_000).toISOString()
      : null,
  };
}

function getSubscriptionTier(subscription: Stripe.Subscription): PaidPlanTier | null {
  const priceId = subscription.items.data[0]?.price.id;
  const configuredPlan = priceId ? getStripePlanFromPriceId(priceId) : null;
  if (configuredPlan) return configuredPlan.tier;

  return isPaidPlanTier(subscription.metadata.tier)
    ? subscription.metadata.tier
    : null;
}

export function toSubscriptionSnapshot(
  subscription: Stripe.Subscription,
): StripeSubscriptionSnapshot {
  const customerId = getExpandableId(subscription.customer);
  if (!customerId) {
    throw new Error(`Subscription ${subscription.id} has no Stripe customer`);
  }

  const period = getSubscriptionPeriod(subscription);
  return {
    subscriptionId: subscription.id,
    customerId,
    status: subscription.status,
    tier: getSubscriptionTier(subscription),
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
  };
}
