import { getAuthUser } from "@/lib/auth/get-auth-user";
import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";

/**
 * What an account is on. `free` is the trial: there is no free plan, but every account starts
 * there with a handful of tasks, and released desktop builds know the code by that name.
 */
export type TensorPlanCode =
  | "free"
  | "starter"
  | "builder"
  | "pro"
  | "max"
  | "ultra"
  | "enterprise";
/**
 * The plans that are for sale. On Starter, Builder and Pro Tensor picks the model and the
 * allowance is tasks a week; on Max and Ultra the customer picks any model and the allowance is
 * what those models cost.
 */
export type TensorPaidPlanCode = "starter" | "builder" | "pro" | "max" | "ultra";
/** What a customer pays in: naira is what Nigeria is shown, dollars everyone else. */
export type TensorCurrency = "NGN" | "USD";
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
  /** The Bachs customer a card subscription is billed to, once there is one. */
  provider_customer_id?: string | null;
};

export type TensorPlanRow = {
  code: TensorPlanCode;
  name: string;
  price_ngn_minor: number | null;
  price_usd_minor: number | null;
  billing_period_days: number;
  /** Tasks in a week of a pass; for the trial, tasks a month. Null is unlimited. */
  task_limit: number | null;
  /** Provider cost one task may reach. */
  task_cost_cap_microusd: number | null;
  /** Provider cost the whole pass may reach, kept below what the pass nets. */
  pass_budget_microusd: number | null;
  model_policy: "auto" | "open_weight" | "frontier" | "custom";
  max_concurrent_turns: number;
  enabled: boolean;
};

export function isPaidPlan(value: unknown): value is TensorPaidPlanCode {
  return (
    value === "starter" ||
    value === "builder" ||
    value === "pro" ||
    value === "max" ||
    value === "ultra"
  );
}

/**
 * The plan being bought, and the currency it is being bought in.
 *
 * A plan is a month. Paid in dollars by card it renews by itself; paid in naira it is one payment
 * for one month, because Bachs cannot yet bill naira on a schedule. A page that names no currency
 * is one from before there was a choice, and opens the way it always did. `pack` is what that
 * page called a plan, and the provider and method it sends are ignored.
 */
export function parseTensorCheckoutInput(
  value: unknown,
): { plan: TensorPaidPlanCode; currency?: TensorCurrency; returnUrl?: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const plan = body.plan ?? body.pack;
  if (!isPaidPlan(plan)) return null;
  const asked = typeof body.currency === "string" ? body.currency.toUpperCase() : null;
  const currency = asked === "NGN" || asked === "USD" ? asked : undefined;
  const returnUrl = tensorCheckoutReturnUrl(body.return_url);
  return { plan, ...(currency ? { currency } : {}), ...(returnUrl ? { returnUrl } : {}) };
}

/** The Tensor website's billing page, where a checkout started there comes back to. */
export const TENSOR_WEB_BILLING_URL = "https://tensorade.app/billing";
/** The same page on www, which is the host Vercel serves the site from. */
export const TENSOR_WEB_WWW_BILLING_URL = "https://www.tensorade.app/billing";

/**
 * Where Bachs sends the customer after paying or cancelling, when the checkout was opened from
 * somewhere other than cencori.com/tensor. Only the Tensor website's billing page, or the same
 * page on a loopback port for local development of that site, is accepted: anything else would
 * make checkout an open redirect. Null falls back to cencori.com/tensor.
 */
export function tensorCheckoutReturnUrl(value: unknown): string | null {
  if (value === TENSOR_WEB_BILLING_URL || value === TENSOR_WEB_WWW_BILLING_URL) return value;
  if (typeof value !== "string" || value.length > 200) return null;
  try {
    const url = new URL(value);
    const port = Number(url.port);
    const loopback =
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      Number.isInteger(port) &&
      port >= 1024 &&
      port <= 65535 &&
      url.pathname === "/billing" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash;
    return loopback ? url.toString() : null;
  } catch {
    return null;
  }
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
    const { data, error } = await getAuthUser(admin, token);
    return error || !data.user ? null : { admin, user: data.user };
  }

  const client = await createServerClient();
  const { data, error } = await getAuthUser(client);
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

const TENSOR_ACCOUNT_COLUMNS =
  "id, user_id, organization_id, plan_code, status, entitlement_starts_at, entitlement_ends_at, created_at, provider_customer_id";

export async function getOrCreateTensorBillingAccount(
  admin: Admin,
  userId: string,
): Promise<TensorBillingAccount> {
  const { data: existing, error: readError } = await admin
    .from("basecode_billing_accounts")
    .select(TENSOR_ACCOUNT_COLUMNS)
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
    .select(TENSOR_ACCOUNT_COLUMNS)
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
 * The plan code as desktop builds released before the ladder understand it.
 *
 * They accept free, builder, pro and enterprise, reject the whole snapshot for anything else, and
 * decide which models to offer from the code alone. So the code they are given says what the
 * account may use rather than what it bought: `free` hides the model list, `builder` offers the
 * open-weight models and `pro` everything. Newer builds read `tier` and `modelPolicy` instead.
 */
export function legacyTensorPlanCode(
  code: TensorPlanCode,
  modelPolicy: TensorPlanRow["model_policy"],
): "free" | "builder" | "pro" | "enterprise" {
  if (code === "free") return "free";
  if (code === "enterprise" || modelPolicy === "custom") return "enterprise";
  if (modelPolicy === "frontier") return "pro";
  if (modelPolicy === "open_weight") return "builder";
  return "free";
}

/** The period an account's tasks count against, as `basecode_allowance_period` reports it. */
export function readAllowancePeriod(value: unknown): {
  startsAt: string;
  endsAt: string | null;
  taskLimit: number | null;
  passEndsAt: string | null;
  passCostUsedMicrousd: number;
  /** The models the account may use, which a pass bought before the ladder can differ on. */
  modelPolicy: TensorPlanRow["model_policy"] | null;
} | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.starts_at !== "string") return null;
  const limit = row.task_limit === null || row.task_limit === undefined ? null : Number(row.task_limit);
  const cost = Number(row.pass_cost_used_microusd ?? 0);
  return {
    startsAt: row.starts_at,
    endsAt: typeof row.ends_at === "string" ? row.ends_at : null,
    taskLimit: limit !== null && Number.isFinite(limit) ? limit : null,
    passEndsAt: typeof row.pass_ends_at === "string" ? row.pass_ends_at : null,
    // Postgres returns a bigint sum as a string once it is large.
    passCostUsedMicrousd: Number.isFinite(cost) ? cost : 0,
    modelPolicy:
      row.model_policy === "auto" ||
      row.model_policy === "open_weight" ||
      row.model_policy === "frontier" ||
      row.model_policy === "custom"
        ? row.model_policy
        : null,
  };
}

/** The card subscription as the app shows it, or null when the account has none still running. */
export function readTensorSubscription(value: unknown): {
  status: "active" | "past_due" | "canceled";
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  currency: TensorCurrency;
} | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const raw = typeof row.status === "string" ? row.status : "";
  // What Bachs calls a subscription still being collected on, whatever stage it is at.
  const status =
    raw === "active" || raw === "trialing"
      ? "active"
      : raw === "past_due" || raw === "unpaid"
        ? "past_due"
        : raw === "canceled" || raw === "paused"
          ? "canceled"
          : null;
  if (!status) return null;
  return {
    status,
    renewsAt: typeof row.current_period_end === "string" ? row.current_period_end : null,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    currency: row.currency === "NGN" ? "NGN" : "USD",
  };
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

  // Which period the account is in is the database's to say: a week of the pass, counted from the
  // moment it started, or the trial's month counted from the account's creation. The reservation
  // reads the same function, so the meter and the limit cannot disagree on where a week starts.
  const { data: allowanceRow, error: allowanceError } = await admin
    .rpc("basecode_allowance_period", { p_account_id: account.id })
    .single();
  const allowance = readAllowancePeriod(allowanceRow);
  if (allowanceError || !allowance) throw new Error("Could not load the Tensor allowance period.");

  const { data: period, error } = await admin
    .from("basecode_usage_periods")
    .select("ends_at, requests_used, cost_used_microusd")
    .eq("account_id", account.id)
    .eq("plan_code", planCode)
    .eq("starts_at", allowance.startsAt)
    .maybeSingle();
  if (error) throw new Error("Could not load Tensor usage.");

  const tasksUsed = Number(period?.requests_used ?? 0);
  const tasksLimit = allowance.taskLimit;
  // The pass also has a cost ceiling, counted across all its weeks. It is not shown as a figure,
  // but a pass that has reached it is used up until it ends, and the percentage and the reset date
  // have to say so or the app would offer tasks it cannot start.
  const costPercentage = percentageOf(allowance.passCostUsedMicrousd, plan.pass_budget_microusd);
  const percentageUsed = Math.max(percentageOf(tasksUsed, tasksLimit), costPercentage);
  // A plan with no task count is all cost ceiling: nothing comes back until the month turns.
  const resetsAt =
    costPercentage >= 100 || tasksLimit === null ? allowance.passEndsAt : allowance.endsAt;
  const modelPolicy = allowance.modelPolicy ?? plan.model_policy;

  // The card subscription, when there is one. A naira month has none, and says when it ends.
  const { data: subscriptionRow, error: subscriptionError } = await admin
    .from("basecode_subscriptions")
    .select("status, current_period_end, cancel_at_period_end, currency")
    .eq("account_id", account.id)
    .maybeSingle();
  if (subscriptionError) {
    console.error("[Tensor Billing] Subscription lookup failed", subscriptionError);
  }
  const subscription = readTensorSubscription(subscriptionRow);
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
      code: legacyTensorPlanCode(plan.code, modelPolicy),
      tier: onTrial ? ("trial" as const) : plan.code,
      name: plan.name,
      modelPolicy,
      // When the paid month ends. With a subscription that renews this is the next charge; with
      // none it is the day the plan stops unless it is paid for again.
      endsAt: onTrial ? null : account.entitlement_ends_at,
      renews: Boolean(subscription && subscription.status === "active" && !subscription.cancelAtPeriodEnd),
      // When the allowance resets: the pass's next week, or the trial's next month. The name is the
      // one released builds read.
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
    subscription,
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

/** One month a card subscription has paid for, as the provider reports it. */
export type TensorSubscriptionPeriod = {
  accountId: string;
  planCode: TensorPaidPlanCode;
  /** Null on a first charge that arrives before the provider has named the subscription. */
  providerSubscriptionId: string | null;
  /** The charge that paid for the month, or null when only its dates are being corrected. */
  providerTransactionId: string | null;
  reference: string | null;
  amountMinor: number;
  currency: TensorCurrency;
  periodStart: string;
  periodEnd: string;
  providerPayload: Record<string, unknown>;
};

/**
 * Puts a paid subscription month on the account. The payment is recorded once however many times
 * the provider reports it; the month's dates are applied every time, so the invoice's exact dates
 * replace the estimate made from the first charge.
 */
export async function applyTensorSubscriptionPeriod(admin: Admin, period: TensorSubscriptionPeriod) {
  const { data, error } = await admin.rpc("basecode_apply_subscription_period", {
    p_account_id: period.accountId,
    p_plan_code: period.planCode,
    p_provider_subscription_id: period.providerSubscriptionId,
    p_provider_transaction_id: period.providerTransactionId,
    p_reference: period.reference,
    p_amount_minor: period.amountMinor,
    p_currency: period.currency,
    p_period_start: period.periodStart,
    p_period_end: period.periodEnd,
    p_provider_payload: period.providerPayload,
  });
  if (error) throw new Error(`Could not apply the Tensor subscription month: ${error.message}`);
  return data as { applied: boolean; payment_recorded: boolean; account_id: string };
}

/** One calendar month on from a date, which is what a first charge pays for until its invoice says. */
export function oneMonthAfter(start: Date): Date {
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  // The 31st plus a month lands in the month after next; the last day of next month is meant.
  if (end.getUTCDate() !== start.getUTCDate()) end.setUTCDate(0);
  return end;
}

/**
 * The account a subscription event is about: the one the checkout named, or failing that the one
 * billed as this Bachs customer. Null when neither is known yet, which the caller retries.
 */
export async function findTensorSubscriptionAccount(
  admin: Admin,
  ids: { accountId?: string | null; customerId?: string | null; subscriptionId?: string | null },
): Promise<{ id: string } | null> {
  if (ids.subscriptionId) {
    const { data, error } = await admin
      .from("basecode_subscriptions")
      .select("account_id")
      .eq("provider", "bachs")
      .eq("provider_subscription_id", ids.subscriptionId)
      .maybeSingle();
    if (error) throw new Error("Could not look up the Tensor subscription.");
    if (data?.account_id) return { id: data.account_id as string };
  }
  for (const [column, value] of [
    ["id", ids.accountId],
    ["provider_customer_id", ids.customerId],
  ] as const) {
    if (!value) continue;
    const { data, error } = await admin
      .from("basecode_billing_accounts")
      .select("id")
      .eq(column, value)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Could not look up the Tensor billing account.");
    if (data?.id) return { id: data.id as string };
  }
  return null;
}

