export type PaidPlanTier = "pro" | "team";
export type PlanBillingInterval = "month" | "year";

export type PaidPlan = {
  id: PaidPlanTier;
  name: string;
  description: string;
  logRetention: string;
  prices: Record<PlanBillingInterval, number>;
  features: readonly string[];
};

export const CENCORI_PAID_PLANS: Record<PaidPlanTier, PaidPlan> = {
  pro: {
    id: "pro",
    name: "Pro",
    description: "For developers shipping production AI workloads.",
    logRetention: "30-day log retention",
    // $20/mo since 2026-11-07 (was $29). Model usage is pay as you go on
    // every plan; the plan covers agents, memory and security.
    prices: {
      month: 2_000,
      year: 20_000,
    },
    features: [
      "Unlimited projects",
      "More agents running at once",
      "50,000 memories per project",
      "Full security pipeline",
      "Team seats",
      "Priority support",
    ],
  },
  // No longer sold (2026-11-07). Kept so existing Team subscribers keep
  // their plan; getAvailableUpgradePlans never offers it.
  team: {
    id: "team",
    name: "Team",
    description: "For teams operating AI systems at scale.",
    logRetention: "90-day log retention",
    prices: {
      month: 9_900,
      year: 99_000,
    },
    features: [
      "Everything in Pro",
      "Team seats and collaboration",
      "90-day log retention",
      "Higher production limits",
      "24/7 priority support",
    ],
  },
};

export function isPaidPlanTier(value: unknown): value is PaidPlanTier {
  return value === "pro" || value === "team";
}

export function isPlanBillingInterval(value: unknown): value is PlanBillingInterval {
  return value === "month" || value === "year";
}

export function getAvailableUpgradePlans(
  currentTier: "free" | PaidPlanTier = "free",
): PaidPlanTier[] {
  // Free → Pro is the only self-serve upgrade; above Pro is Enterprise
  // (contact sales). Team is no longer sold.
  if (currentTier !== "free") return [];
  return ["pro"];
}

export function getMonthlyEquivalentCents(
  tier: PaidPlanTier,
  interval: PlanBillingInterval,
): number {
  const total = CENCORI_PAID_PLANS[tier].prices[interval];
  return interval === "year" ? total / 12 : total;
}
