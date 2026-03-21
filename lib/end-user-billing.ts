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
  overageAction?: "block" | "throttle" | "alert_only";
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
}

export interface UsageRecord {
  projectId: string;
  externalUserId: string;
  tokens: { prompt: number; completion: number; total: number };
  cost: { providerUsd: number; cencoriChargeUsd: number };
  customerMarkupPercentage: number;
  flatRatePerRequest: number | null;
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
  model?: string
): Promise<QuotaCheckResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("check_end_user_quota", {
    p_project_id: projectId,
    p_external_user_id: externalUserId,
  });

  if (error || !data) {
    console.error("[EndUserBilling] Quota check failed:", error?.message);
    // Fail open — don't block requests if the quota check itself fails
    return {
      allowed: true,
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
 * Fire-and-forget — never throws, never blocks the response.
 * Calls increment_end_user_usage RPC.
 */
export function recordEndUserUsage(record: UsageRecord): void {
  try {
    const supabase = createAdminClient();
    const customerChargeUsd = calculateCustomerCharge(
      record.cost.cencoriChargeUsd,
      record.customerMarkupPercentage,
      record.flatRatePerRequest
    );

    Promise.resolve(
      supabase.rpc("increment_end_user_usage", {
        p_project_id: record.projectId,
        p_external_user_id: record.externalUserId,
        p_prompt_tokens: record.tokens.prompt,
        p_completion_tokens: record.tokens.completion,
        p_total_cost_usd: record.cost.cencoriChargeUsd,
        p_provider_cost_usd: record.cost.providerUsd,
        p_customer_charge_usd: customerChargeUsd,
      })
    )
      .then(({ error }) => {
        if (error) {
          console.error(
            "[EndUserBilling] Failed to record usage:",
            error.message
          );
        }
      })
      .catch((err: unknown) => {
        console.error("[EndUserBilling] Unexpected error recording usage:", err);
      });
  } catch (err) {
    console.error("[EndUserBilling] Unexpected error:", err);
  }
}

/**
 * Awaitable version of recordEndUserUsage for critical paths.
 */
export async function recordEndUserUsageAsync(
  record: UsageRecord
): Promise<void> {
  const supabase = createAdminClient();
  const customerChargeUsd = calculateCustomerCharge(
    record.cost.cencoriChargeUsd,
    record.customerMarkupPercentage,
    record.flatRatePerRequest
  );

  const { error } = await supabase.rpc("increment_end_user_usage", {
    p_project_id: record.projectId,
    p_external_user_id: record.externalUserId,
    p_prompt_tokens: record.tokens.prompt,
    p_completion_tokens: record.tokens.completion,
    p_total_cost_usd: record.cost.cencoriChargeUsd,
    p_provider_cost_usd: record.cost.providerUsd,
    p_customer_charge_usd: customerChargeUsd,
  });

  if (error) {
    console.error("[EndUserBilling] Failed to record usage:", error.message);
    throw error;
  }
}

// ──────────────────────────────────────────────
// Charge Calculation
// ──────────────────────────────────────────────

/**
 * Calculate what the customer should charge their end-user.
 * Applies the customer's markup percentage plus any flat per-request fee.
 */
export function calculateCustomerCharge(
  cencoriChargeUsd: number,
  markupPercentage: number,
  flatRatePerRequest: number | null
): number {
  return cencoriChargeUsd * (1 + markupPercentage / 100) + (flatRatePerRequest || 0);
}
