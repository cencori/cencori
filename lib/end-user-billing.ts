/**
 * End-User Usage-Based Billing
 *
 * Core library for per-end-user quota checks and usage tracking
 * in the Cencori AI gateway. Customers can set per-user limits,
 * markup percentages, and model restrictions.
 */

import { createAdminClient } from "@/lib/supabaseAdmin";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  isNewUser: boolean;
  endUserId?: string;
  ratePlan?: string;
  overageAction?: "block" | "alert_only";
  markupPercentage: number;
  flatRatePerRequest: number | null;
  allowedModels: string[] | null;
  dailyTokensUsed: number;
  dailyTokensLimit: number | null;
  monthlyTokensUsed: number;
  monthlyTokensLimit: number | null;
  dailyRequestsUsed: number;
  dailyRequestsLimit: number | null;
  monthlyRequestsUsed: number;
  monthlyRequestsLimit: number | null;
  requestsPerMinuteUsed: number;
  requestsPerMinuteLimit: number | null;
  retryAfterSeconds: number | null;
  currency: string;
  pricingModel: 'flat' | 'tiered' | 'volume';
  pricingTiers: PricingTier[];
}

export interface UsageRecord {
  projectId: string;
  externalUserId: string;
  environment?: string;
  tokens: { prompt: number; completion: number; total: number };
  cost: { providerUsd: number; cencoriChargeUsd: number };
  customerMarkupPercentage: number;
  flatRatePerRequest: number | null;
  currency: string;
  pricingModel: 'flat' | 'tiered' | 'volume';
  pricingTiers: PricingTier[];
  monthlyTokensUsed: number;
}

// ──────────────────────────────────────────────
// Quota Check
// ──────────────────────────────────────────────

/**
 * Check if an end-user has quota remaining before processing their request.
 * Calls the check_end_user_quota RPC in Supabase.
 * Returns quickly — this is on the hot path.
 */
export async function checkEndUserQuota(
  projectId: string,
  externalUserId: string,
  model?: string,
  environment = "production"
): Promise<QuotaCheckResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("check_end_user_quota", {
    p_project_id: projectId,
    p_external_user_id: externalUserId,
    p_environment: environment,
  });

  if (error || !data) {
    console.error("[EndUserBilling] Quota check failed:", error?.message);
    // Fail closed — block requests if the quota check itself fails to prevent unmetered usage.
    // Exceptions could be made for specific enterprise projects if needed.
    return {
      allowed: false,
      reason: "quota_check_unavailable",
      isNewUser: false,
      markupPercentage: 0,
      flatRatePerRequest: null,
      allowedModels: null,
      dailyTokensUsed: 0,
      dailyTokensLimit: null,
      monthlyTokensUsed: 0,
      monthlyTokensLimit: null,
      dailyRequestsUsed: 0,
      dailyRequestsLimit: null,
      monthlyRequestsUsed: 0,
      monthlyRequestsLimit: null,
      requestsPerMinuteUsed: 0,
      requestsPerMinuteLimit: null,
      retryAfterSeconds: null,
    };
  }

  const result: QuotaCheckResult = {
    allowed: data.allowed,
    reason: data.reason ?? undefined,
    isNewUser: data.is_new_user ?? false,
    endUserId: data.end_user_id ?? undefined,
    ratePlan: data.rate_plan ?? undefined,
    overageAction: data.overage_action ?? undefined,
    markupPercentage: data.markup_percentage ?? 0,
    flatRatePerRequest: data.flat_rate_per_request ?? null,
    allowedModels: data.allowed_models ?? null,
    dailyTokensUsed: data.daily_tokens_used ?? 0,
    dailyTokensLimit: data.daily_tokens_limit ?? null,
    monthlyTokensUsed: data.monthly_tokens_used ?? 0,
    monthlyTokensLimit: data.monthly_tokens_limit ?? null,
    dailyRequestsUsed: data.daily_requests_used ?? 0,
    dailyRequestsLimit: data.daily_requests_limit ?? null,
    monthlyRequestsUsed: data.monthly_requests_used ?? 0,
    monthlyRequestsLimit: data.monthly_requests_limit ?? null,
    requestsPerMinuteUsed: data.requests_per_minute_used ?? 0,
    requestsPerMinuteLimit: data.requests_per_minute_limit ?? null,
    retryAfterSeconds: data.retry_after_seconds ?? null,
    currency: data.currency || 'USD',
    pricingModel: data.pricing_model || 'flat',
    pricingTiers: data.pricing_tiers || [],
  };

  // Model restriction check — done client-side for speed
  if (model && result.allowedModels && result.allowedModels.length > 0) {
    if (!result.allowedModels.includes(model)) {
      result.allowed = false;
      result.reason = `model_not_allowed: ${model}`;
    }
  }

  return result;
}

// ──────────────────────────────────────────────
// Usage Recording
// ──────────────────────────────────────────────

/**
 * Record usage after a successful AI request.
 * Enqueues the record into a persistent Redis queue for reliable background processing.
 * Never throws, never blocks the response.
 */
export function recordEndUserUsage(record: UsageRecord): void {
  try {
    const { enqueueUsageRecord } = require('./queue');
    
    const task = {
      ...record,
      timestamp: Date.now(),
      environment: record.environment === "test" ? "test" : "production",
    };

    // Enqueue for background processing (persistent & crash-proof)
    enqueueUsageRecord(task).catch((err: any) => {
      console.error("[EndUserBilling] Failed to enqueue usage:", err);
    });
  } catch (err) {
    console.error("[EndUserBilling] Unexpected error enqueuing usage:", err);
  }
}

/**
 * Awaitable version of recordEndUserUsage for critical paths.
 */
export async function recordEndUserUsageAsync(
  record: UsageRecord
): Promise<void> {
  const supabase = createAdminClient();
  const environment = record.environment === "test" ? "test" : "production";
  const customerChargeUsd = calculateCustomerCharge(
    record.cost.cencoriChargeUsd,
    record.customerMarkupPercentage,
    record.flatRatePerRequest,
    record.pricingModel,
    record.pricingTiers,
    record.tokens.total,
    record.monthlyTokensUsed
  );

  const { error } = await supabase.rpc("increment_end_user_usage", {
    p_project_id: record.projectId,
    p_external_user_id: record.externalUserId,
    p_prompt_tokens: record.tokens.prompt,
    p_completion_tokens: record.tokens.completion,
    p_total_cost_usd: record.cost.cencoriChargeUsd,
    p_provider_cost_usd: record.cost.providerUsd,
    p_customer_charge_usd: customerChargeUsd,
    p_currency: record.currency || 'USD',
    p_environment: environment,
  });

  if (error) {
    console.error("[EndUserBilling] Failed to record usage:", error.message);
    throw error;
  }
}

// ──────────────────────────────────────────────
// Charge Calculation
// ──────────────────────────────────────────────

export interface PricingTier {
  up_to: number | null; // null means infinity
  unit_amount: number;
}

/**
 * Calculate what the customer should charge their end-user.
 * Supports Flat, Tiered, and Volume pricing models.
 */
export function calculateCustomerCharge(
  cencoriChargeUsd: number,
  markupPercentage: number,
  pricingModel: 'flat' | 'tiered' | 'volume' = 'flat',
  pricingTiers: PricingTier[] = [],
  requestUnits: number = 0,
  totalMonthlyUsage: number = 0
): number {
  // 1. Base Charge (Markup based)
  let charge = cencoriChargeUsd * (1 + markupPercentage / 100) + (flatRatePerRequest || 0);

  // 2. Override with Tiered/Volume models if applicable
  if (pricingTiers.length > 0 && (pricingModel === 'tiered' || pricingModel === 'volume')) {
    // Determine the current tier based on total monthly usage
    const tier = pricingTiers.find(t => t.up_to === null || totalMonthlyUsage <= t.up_to) || pricingTiers[pricingTiers.length - 1];
    
    // The charge for THIS request is based on the current tier's unit price
    charge = requestUnits * tier.unit_amount;
  }

  return charge;
}
