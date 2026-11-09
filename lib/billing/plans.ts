export type PaidPlanTier = "pro" | "team";
export type PlanBillingInterval = "month" | "year";

export type PaidPlan = {
  id: PaidPlanTier;
  name: string;
  description: string;
  logRetention: string;
  prices: Record<PlanBillingInterval, number>;
  /**
   * The price shown in naira, in whole naira: a set price, not a conversion
   * of the dollar price. Plans are still charged in dollars.
   */
  ngnPrices?: Record<PlanBillingInterval, number>;
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
    ngnPrices: {
      month: 20_000,
      year: 200_000,
    },
    // The pricing page and the upgrade dialog both list these.
    features: [
      "10 agents, 10 running at once",
      "100 knowledge bases",
      "100 customers",
      "50,000 memories per project",
      "Unlimited projects",
      "30 days of usage, logs and traces",
      "PII masking, jailbreak detection & audit trails",
      "Invite your team",
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

/**
 * Why the upgrade dialog opened: the Pro feature the user just reached for,
 * shown first in the dialog. Each names a line of the Pro features above.
 */
export const UPGRADE_REASONS = {
  history: "30 days of usage, logs and traces",
  agents: "10 agents, 10 running at once",
  knowledge: "100 knowledge bases",
  memory: "50,000 memories per project",
  projects: "Unlimited projects",
  security: "PII masking, jailbreak detection & audit trails",
  team: "Invite your team",
} as const;

export type UpgradeReason = keyof typeof UPGRADE_REASONS;

export function isUpgradeReason(value: unknown): value is UpgradeReason {
  return typeof value === "string" && value in UPGRADE_REASONS;
}
