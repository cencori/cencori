import {
  isPaidPlanTier,
  isPlanBillingInterval,
  type PaidPlanTier,
  type PlanBillingInterval,
} from "@/lib/billing/plans";

export type CheckoutSelection = {
  tier: PaidPlanTier;
  interval: PlanBillingInterval;
};

export function parseCheckoutSelection(input: {
  tier?: unknown;
  interval?: unknown;
}): CheckoutSelection | null {
  if (!isPaidPlanTier(input.tier) || !isPlanBillingInterval(input.interval)) {
    return null;
  }

  return { tier: input.tier, interval: input.interval };
}

/**
 * Where a hosted Bachs checkout returns to: the org's billing page, which
 * reads checkout_id to show "activating" until the webhook has given the plan.
 */
export function getCheckoutReturnUrls(baseUrl: string, orgSlug: string, reference: string) {
  const billingUrl = new URL(`/${orgSlug}/~/billing`, baseUrl);
  const success = new URL(billingUrl);
  success.searchParams.set("checkout_id", reference);
  const cancel = new URL(billingUrl);
  cancel.searchParams.set("checkout", "cancelled");
  return { successUrl: success.toString(), cancelUrl: cancel.toString() };
}
