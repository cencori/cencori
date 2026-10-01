import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";

export type TensorPlanCode = "free" | "builder" | "pro" | "enterprise";
export type TensorPaidPlanCode = Exclude<TensorPlanCode, "free" | "enterprise">;
export type TensorPaymentProvider = "paystack" | "bachs";
export type TensorPaymentMethod = "auto" | "opay" | "banktransfer";

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
};

export type TensorPlanRow = {
  code: TensorPlanCode;
  name: string;
  price_ngn_minor: number | null;
  price_usd_minor: number | null;
  billing_period_days: number;
  weekly_request_limit: number | null;
  weekly_budget_microusd: number | null;
  model_policy: "auto" | "open_weight" | "frontier" | "custom";
  max_concurrent_turns: number;
  enabled: boolean;
};

function isPaidPlan(value: unknown): value is TensorPaidPlanCode {
  return value === "builder" || value === "pro";
}

export function parseTensorCheckoutInput(value: unknown): {
  paymentMethod: TensorPaymentMethod;
  plan: TensorPaidPlanCode;
  provider: TensorPaymentProvider;
  recurring: boolean;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (!isPaidPlan(body.plan)) return null;
  const provider = body.provider === "bachs" ? "bachs" : body.provider === "paystack" ? "paystack" : null;
  if (!provider) return null;
  const paymentMethod =
    body.paymentMethod === "opay" || body.paymentMethod === "banktransfer"
      ? body.paymentMethod
      : "auto";
  if (provider === "bachs" && paymentMethod !== "auto") return null;
  // Auto-renew is a Paystack-plans feature. Bachs monthly products already bill
  // recurringly through Bachs itself, so the flag is meaningless there — and OPay /
  // bank-transfer authorizations cannot be reused, so recurring always pays by card.
  const recurring = body.recurring === true;
  if (recurring && provider !== "paystack") return null;
  return { paymentMethod, plan: body.plan, provider, recurring };
}

/**
 * Paystack plan for an auto-renewing Tensor purchase. Amounts on these plans must
 * match the plans table (Builder ₦5,000 / Pro ₦15,000) — Paystack charges the plan
 * amount, ignoring the initialize amount, when a plan is passed.
 *
 * Test and live Paystack accounts have separate plans, so these hold the test codes
 * locally and the live codes in production — same names, different values.
 */
export function getPaystackPlanCode(plan: TensorPaidPlanCode): string {
  const code =
    plan === "builder"
      ? process.env.PAYSTACK_PLAN_BASECODE_BUILDER
      : process.env.PAYSTACK_PLAN_BASECODE_PRO;
  if (!code) throw new Error(`No Paystack plan configured for ${plan}`);
  return code;
}

export function getTensorPlanByPaystackPlanCode(planCode: string): TensorPaidPlanCode | null {
  if (planCode && planCode === process.env.PAYSTACK_PLAN_BASECODE_BUILDER) return "builder";
  if (planCode && planCode === process.env.PAYSTACK_PLAN_BASECODE_PRO) return "pro";
  return null;
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
    .select("id, user_id, organization_id, plan_code, status, entitlement_starts_at, entitlement_ends_at")
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
    .select("id, user_id, organization_id, plan_code, status, entitlement_starts_at, entitlement_ends_at")
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
      "code, name, price_ngn_minor, price_usd_minor, billing_period_days, weekly_request_limit, weekly_budget_microusd, model_policy, max_concurrent_turns, enabled",
    )
    .eq("code", code)
    .eq("enabled", true)
    .maybeSingle();
  if (error || !data) throw new Error("The selected Tensor plan is unavailable.");
  return data as TensorPlanRow;
}

export async function getTensorBillingSnapshot(admin: Admin, userId: string) {
  const account = await getOrCreateTensorBillingAccount(admin, userId);
  const planCode = effectiveTensorPlan(account);
  const plan = await getTensorPlan(admin, planCode);
  const now = new Date().toISOString();
  const { data: period, error } = await admin
    .from("basecode_usage_periods")
    .select("starts_at, ends_at, request_limit, requests_used, budget_microusd, cost_used_microusd, cost_reserved_microusd")
    .eq("account_id", account.id)
    .eq("plan_code", planCode)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Could not load Tensor usage.");

  const requestLimit = Number(period?.request_limit ?? plan.weekly_request_limit ?? 0);
  const requestsUsed = Number(period?.requests_used ?? 0);
  const budget = Number(period?.budget_microusd ?? plan.weekly_budget_microusd ?? 0);
  const cost = Number(period?.cost_used_microusd ?? 0) + Number(period?.cost_reserved_microusd ?? 0);
  const rawPercentage = requestLimit > 0 ? (requestsUsed / requestLimit) * 100 : budget > 0 ? (cost / budget) * 100 : 0;

  // Token spend across every device on this account. Deliberately separate from the meter above:
  // the plan is billed on requests and provider cost, never on tokens. Left off entirely when the
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
      code: plan.code,
      name: plan.name,
      modelPolicy: plan.model_policy,
      renewsAt: planCode === "free" ? null : account.entitlement_ends_at,
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
      percentageUsed: Math.max(0, Math.min(100, Math.round(rawPercentage))),
      resetsAt: period?.ends_at ?? null,
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

/**
 * Paystack channels for the requested Nigerian method. `undefined` means the full
 * Paystack channel list. OPay rides on the `bank` (Pay with Bank) channel: the customer
 * picks OPay on the Paystack checkout and authorizes in the OPay app or web app.
 * (Requires the Bank channel enabled in the Paystack dashboard preferences.)
 */
export function paystackChannels(method: TensorPaymentMethod): string[] | undefined {
  if (method === "opay") return ["bank"];
  if (method === "banktransfer") return ["bank_transfer"];
  return undefined;
}

export function tensorCheckoutReference(id: string): string {
  // Dash-separated: Paystack references allow only `-`, `.`, `=` and alphanumerics,
  // and Bachs accepts the same shape, so one format serves both providers.
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
  providerCustomerId?: string | null;
  providerPayload: Record<string, unknown>;
  planCode?: TensorPaidPlanCode;
};

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
  if (checkout.currency !== payment.currency) throw new Error("Payment currency mismatch.");
  if (payment.amountMinor < Number(checkout.expected_amount_minor)) {
    throw new Error("Payment amount is below the checkout total.");
  }
  if (checkout.status !== "pending" && checkout.status !== "paid") {
    throw new Error("Tensor checkout is not payable.");
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

  if (payment.providerCustomerId) {
    const { error: customerError } = await admin.from("basecode_billing_customers").upsert(
      {
        account_id: checkout.account_id,
        provider: payment.provider,
        provider_customer_id: payment.providerCustomerId,
      },
      { onConflict: "account_id,provider" },
    );
    if (customerError) {
      console.error("[Tensor Billing] Could not save provider customer", customerError);
    }
  }

  return data as {
    applied: boolean;
    duplicate?: boolean;
    account_id: string;
    plan?: TensorPlanCode;
    period_start?: string;
    period_end?: string;
  };
}
