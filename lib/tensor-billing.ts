import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";

/**
 * What an account is on. `free` is the trial: there is no free plan, but every account starts
 * there with a handful of tasks, and released desktop builds know the code by that name.
 */
export type TensorPlanCode = "free" | "starter" | "builder" | "pro" | "enterprise";
/** The passes that are for sale. */
export type TensorPaidPlanCode = "starter" | "builder" | "pro";
/** Every Tensor payment is taken by Bachs, in whichever currency the customer chooses there. */
export type TensorPaymentProvider = "bachs";

const TENSOR_PRODUCTION_ORIGIN = "https://cencori.com";

type Admin = ReturnType<typeof createAdminClient>;

export function resolveTensorCheckoutOrigin(
  requestOrigin: string,
  vercelEnvironment: string | undefined = process.env.VERCEL_ENV,
): string {
  if (vercelEnvironment === "production") return TENSOR_PRODUCTION_ORIGIN;
  try {
    return new URL(requestOrigin).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export type TensorBillingSession = {
  admin: Admin;
  user: User;
};

export type TensorBillingAccount = {
  id: string;
  user_id: string;
  organization_id: string | null;
  plan_code: TensorPlanCode;
  status: "active" | "past_due" | "cancelled" | "suspended";
  entitlement_starts_at: string | null;
  entitlement_ends_at: string | null;
  created_at: string;
};

export type TensorPlanRow = {
  code: TensorPlanCode;
  name: string;
  price_ngn_minor: number | null;
  price_usd_minor: number | null;
  billing_period_days: number;
  /** Tasks in a pass; for the trial, tasks a month. Null is unlimited. */
  task_limit: number | null;
  /** Provider cost one task may reach. */
  task_cost_cap_microusd: number | null;
  /** Provider cost the whole pass may reach, kept below what the pass nets. */
  pass_budget_microusd: number | null;
  model_policy: "auto" | "open_weight" | "frontier" | "custom";
  max_concurrent_turns: number;
  enabled: boolean;
};

function isPaidPlan(value: unknown): value is TensorPaidPlanCode {
  return value === "starter" || value === "builder" || value === "pro";
}

/**
 * The pass being bought.
 *
 * Every purchase is one payment for one 30-day pass, taken by Bachs. How it is paid — card, bank
 * transfer, naira or dollars — is chosen on Bachs's own checkout, so nothing about it is asked
 * for here; a plans page still open from before sends a provider and a method, and they are
 * ignored. `pack` is what that page called the same thing before passes.
 */
export function parseTensorCheckoutInput(value: unknown): { plan: TensorPaidPlanCode } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const plan = body.plan ?? body.pack;
  return isPaidPlan(plan) ? { plan } : null;
}

export function majorAmountToMinor(value: unknown): number | null {
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) ? minor : null;
}

export function effectiveTensorPlan(
  account: Pick<TensorBillingAccount, "plan_code" | "status" | "entitlement_ends_at">,
  now = new Date(),
): TensorPlanCode {
  // A pass that has ended, or an account that never bought one, is on the trial.
  if (account.plan_code === "free") return "free";
  const endsAt = account.entitlement_ends_at ? new Date(account.entitlement_ends_at) : null;
  return account.status === "active" && endsAt && endsAt.getTime() > now.getTime()
    ? account.plan_code
    : "free";
}

export async function authenticateTensorBillingRequest(
  request: NextRequest,
): Promise<TensorBillingSession | null> {
  const authorization = request.headers.get("authorization");
  const admin = createAdminClient();
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (!token || token.length > 4096) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : { admin, user: data.user };
  }

  const client = await createServerClient();
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : { admin, user: data.user };
}

async function findUserOrganizationId(admin: Admin, userId: string): Promise<string | null> {
  const { data: owned } = await admin
    .from("organizations")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (owned?.id) return owned.id as string;

  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (membership?.organization_id as string | undefined) ?? null;
}

export async function getOrCreateTensorBillingAccount(
  admin: Admin,
  userId: string,
): Promise<TensorBillingAccount> {
  const { data: existing, error: readError } = await admin
    .from("basecode_billing_accounts")
    .select("id, user_id, organization_id, plan_code, status, entitlement_starts_at, entitlement_ends_at, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error("Could not load the Tensor billing account.");
  if (existing) return existing as TensorBillingAccount;

  const organizationId = await findUserOrganizationId(admin, userId);
  const { data, error } = await admin
    .from("basecode_billing_accounts")
    .upsert(
      { user_id: userId, organization_id: organizationId, plan_code: "free", status: "active" },
      { onConflict: "user_id" },
    )
    .select("id, user_id, organization_id, plan_code, status, entitlement_starts_at, entitlement_ends_at, created_at")
    .single();
  if (error || !data) throw new Error("Could not create the Tensor billing account.");
  return data as TensorBillingAccount;
}

export async function getTensorPlan(
  admin: Admin,
  code: TensorPlanCode,
): Promise<TensorPlanRow> {
  const { data, error } = await admin
    .from("basecode_plans")
    .select(
      "code, name, price_ngn_minor, price_usd_minor, billing_period_days, task_limit, task_cost_cap_microusd, pass_budget_microusd, model_policy, max_concurrent_turns, enabled",
    )
    .eq("code", code)
    .eq("enabled", true)
    .maybeSingle();
  if (error || !data) throw new Error("The selected Tensor plan is unavailable.");
  return data as TensorPlanRow;
}

/**
 * The plan code as desktop builds released before passes understand it.
 *
 * They accept free, builder, pro and enterprise and reject the whole snapshot for anything else,
 * which would blank the usage screen for everyone on Starter. Starter has the trial's models, so
 * it reads to them as `free` with the name "Starter"; newer builds read `tier` instead.
 */
export function legacyTensorPlanCode(code: TensorPlanCode): Exclude<TensorPlanCode, "starter"> {
  return code === "starter" ? "free" : code;
}

/** How much of an allowance is gone, as a whole percentage. */
function percentageOf(used: number, limit: number | null): number {
  if (!limit || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

export async function getTensorBillingSnapshot(admin: Admin, userId: string) {
  const account = await getOrCreateTensorBillingAccount(admin, userId);
  const planCode = effectiveTensorPlan(account);
  const plan = await getTensorPlan(admin, planCode);
  const onTrial = planCode === "free";

  // An allowance belongs to a pass, so its period starts exactly when the pass did; the trial's is
  // the current month counted from the account's creation, worked out by the same function the
  // reservation uses so the two cannot disagree on where a month starts. Matching the start
  // rather than "whichever period covers today" is what keeps a period from the weekly model that
  // came before from being read as the current one.
  let periodStart = account.entitlement_starts_at ?? account.created_at;
  let resetsAt = account.entitlement_ends_at;
  if (onTrial) {
    const { data: trialPeriod, error: trialError } = await admin
      .rpc("basecode_trial_period", { p_created_at: account.created_at })
      .single();
    const window = trialPeriod as { starts_at?: unknown; ends_at?: unknown } | null;
    if (trialError || typeof window?.starts_at !== "string" || typeof window.ends_at !== "string") {
      throw new Error("Could not load the Tensor trial period.");
    }
    periodStart = window.starts_at;
    resetsAt = window.ends_at;
  }
  const { data: period, error } = await admin
    .from("basecode_usage_periods")
    .select("ends_at, requests_used, cost_used_microusd")
    .eq("account_id", account.id)
    .eq("plan_code", planCode)
    .eq("starts_at", periodStart)
    .maybeSingle();
  if (error) throw new Error("Could not load Tensor usage.");

  const tasksUsed = Number(period?.requests_used ?? 0);
  const tasksLimit = plan.task_limit;
  // The pass also has a cost ceiling. It is not shown as a figure, but a pass that has reached it
  // is used up, and the percentage has to say so or the app would offer tasks it cannot start.
  const percentageUsed = Math.max(
    percentageOf(tasksUsed, tasksLimit),
    percentageOf(Number(period?.cost_used_microusd ?? 0), plan.pass_budget_microusd),
  );
  // Token spend across every device on this account. Deliberately separate from the meter above:
  // the plan is counted in tasks and provider cost, never in tokens. Left off entirely when the
  // account has no rows yet, because absent has to read as unknown rather than as zero.
  const { data: tokenTotals, error: tokenError } = await admin.rpc("basecode_account_token_usage", {
    p_user_id: userId,
  });
  if (tokenError) {
    console.error("[Tensor Billing] Account token usage failed", tokenError);
  }
  const tokens = readAccountTokens(tokenTotals);

  return {
    plan: {
      code: legacyTensorPlanCode(plan.code),
      tier: onTrial ? ("trial" as const) : plan.code,
      name: plan.name,
      modelPolicy: plan.model_policy,
      // When the allowance resets: the pass's end, or the trial's next month. The name is the one
      // released builds read.
      renewsAt: resetsAt,
      // Both currencies, because nothing here knows which one a given account pays in -- checkout
      // decides that from the payment provider, not from the account. The client picks; a plan
      // priced in neither (enterprise) reports null rather than zero, which would read as free.
      price:
        plan.price_ngn_minor === null && plan.price_usd_minor === null
          ? null
          : {
              ngnMinor: plan.price_ngn_minor,
              periodDays: plan.billing_period_days,
              usdMinor: plan.price_usd_minor,
            },
    },
    usage: {
      percentageUsed,
      resetsAt,
      tasksUsed,
      tasksLimit,
      ...(tokens ? { tokens } : {}),
    },
  };
}

/**
 * The summed figure, only when every field is a real count. Postgres returns bigint sums as
 * strings once they are large, which is exactly the case this has to survive.
 */
function readAccountTokens(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const fields = [
    "totalTokens",
    "inputTokens",
    "cachedInputTokens",
    "cacheWriteInputTokens",
    "outputTokens",
    "reasoningOutputTokens",
  ] as const;
  const tokens = {} as Record<(typeof fields)[number], number>;
  for (const field of fields) {
    const count = Number(source[field]);
    if (!Number.isFinite(count) || count < 0) return null;
    tokens[field] = count;
  }
  return tokens;
}

export function tensorCheckoutReference(id: string): string {
  // Dash-separated and alphanumeric, which is a shape every payment provider accepts.
  return `tensor-${id.replaceAll("-", "")}`;
}

export type VerifiedTensorPayment = {
  provider: TensorPaymentProvider;
  providerTransactionId: string;
  reference: string;
  amountMinor: number;
  currency: "NGN" | "USD";
  paymentMethod?: string | null;
  paidAt?: string | null;
  providerPayload: Record<string, unknown>;
  planCode?: TensorPaidPlanCode;
};

/** What a plan costs in the currency a payment arrived in. */
export function tensorPlanPriceMinor(
  plan: Pick<TensorPlanRow, "price_ngn_minor" | "price_usd_minor">,
  currency: "NGN" | "USD",
): number | null {
  const price = currency === "NGN" ? plan.price_ngn_minor : plan.price_usd_minor;
  return typeof price === "number" && price > 0 ? price : null;
}

export async function applyVerifiedTensorPayment(
  admin: Admin,
  payment: VerifiedTensorPayment,
) {
  const { data: checkout, error: checkoutError } = await admin
    .from("basecode_checkout_sessions")
    .select("id, account_id, plan_code, provider, reference, expected_amount_minor, currency, status, expires_at")
    .eq("reference", payment.reference)
    .maybeSingle();
  if (checkoutError || !checkout) throw new Error("Tensor checkout not found.");
  if (checkout.provider !== payment.provider) throw new Error("Payment provider mismatch.");
  if (payment.planCode && checkout.plan_code !== payment.planCode) {
    throw new Error("Payment plan mismatch.");
  }
  if (checkout.status !== "pending" && checkout.status !== "paid") {
    throw new Error("Tensor checkout is not payable.");
  }

  // The customer picks naira or dollars on Bachs's checkout, after this one was opened, so the
  // payment is measured against the plan's own price in the currency it actually arrived in. The
  // checkout is then made to say what was really charged, which is what the database verifies.
  const plan = await getTensorPlan(admin, checkout.plan_code as TensorPlanCode);
  const price = tensorPlanPriceMinor(plan, payment.currency);
  if (!price) throw new Error("The plan has no price in the payment's currency.");
  if (payment.amountMinor < price) {
    throw new Error("Payment amount is below the plan price.");
  }
  if (
    checkout.status === "pending" &&
    (checkout.currency !== payment.currency || Number(checkout.expected_amount_minor) !== price)
  ) {
    const { error: repriceError } = await admin
      .from("basecode_checkout_sessions")
      .update({ currency: payment.currency, expected_amount_minor: price })
      .eq("id", checkout.id)
      .eq("status", "pending");
    if (repriceError) throw new Error("Could not record the payment's currency.");
  }

  const { data, error } = await admin.rpc("basecode_apply_verified_payment", {
    p_checkout_session_id: checkout.id,
    p_provider_transaction_id: payment.providerTransactionId,
    p_amount_minor: payment.amountMinor,
    p_currency: payment.currency,
    p_payment_method: payment.paymentMethod ?? null,
    p_paid_at: payment.paidAt ?? new Date().toISOString(),
    p_provider_payload: payment.providerPayload,
  });
  if (error) throw new Error(`Could not apply the Tensor payment: ${error.message}`);

  return data as {
    applied: boolean;
    duplicate?: boolean;
    account_id: string;
    plan?: TensorPlanCode;
    period_start?: string;
    period_end?: string;
  };
}
