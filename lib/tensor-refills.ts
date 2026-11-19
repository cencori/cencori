/**
 * Refills: usage bought on top of a paid plan, in any amount within limits. See
 * database/brimble/3100_tensor_refills.sql for how it is spent (after each week's own share,
 * until the paid month ends).
 *
 * The rate is the plan's own, made dearer by REFILL_PREMIUM: a plan sells its month's model
 * ceiling for its price, so a refill sells the same usage for half as much again. Every naira of
 * a refill therefore buys less usage than a naira of the plan, which keeps every refill earning
 * above what it lets through, and makes refilling often dearer than the next plan up.
 */
import type { BachsCollectionData } from "@/lib/bachsClient";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import { tensorPlanPriceMinor, type TensorPlanRow } from "@/lib/tensor-billing";

type Admin = ReturnType<typeof createAdminClient>;
type Currency = "NGN" | "USD";
type PlanForRefill = Pick<TensorPlanRow, "code" | "price_ngn_minor" | "price_usd_minor" | "pass_budget_microusd" | "billing_period_days">;

export const REFILL_PREMIUM = 1.5;
/** The least and most one refill may be: enough to be worth a payment's fees, and no more than a month's worth. */
export const REFILL_LIMITS_MINOR = { NGN: { min: 50_000, max: 10_000_000 }, USD: { min: 100, max: 10_000 } } as const;
/** Suggested amounts are rounded up to these: 50 naira, and 50 cents. */
const STEP_MINOR = { NGN: 5000, USD: 50 } as const;

/** The usage an amount buys on a plan, in microdollars of model cost; null where it cannot be refilled. */
export function refillCreditMicrousd(plan: PlanForRefill, amountMinor: number, currency: Currency): number | null {
  if (plan.code === "free" || !plan.pass_budget_microusd || plan.pass_budget_microusd <= 0) return null;
  const month = tensorPlanPriceMinor(plan, currency);
  if (!month || amountMinor <= 0) return null;
  return Math.floor((amountMinor * plan.pass_budget_microusd) / (month * REFILL_PREMIUM));
}

/** What a week of the plan's usage costs as a refill, rounded up: the unit the page suggests amounts in. */
export function refillWeekMinor(plan: PlanForRefill, currency: Currency): number | null {
  if (plan.code === "free" || !plan.pass_budget_microusd) return null;
  const month = tensorPlanPriceMinor(plan, currency);
  if (!month) return null;
  const raw = (month * 7 * REFILL_PREMIUM) / (plan.billing_period_days || 30);
  return Math.ceil(raw / STEP_MINOR[currency]) * STEP_MINOR[currency];
}

/** Whether an amount may be bought: whole naira (or cents), within the limits. */
export function refillAmountAllowed(amountMinor: unknown, currency: Currency): amountMinor is number {
  if (typeof amountMinor !== "number" || !Number.isInteger(amountMinor)) return false;
  if (currency === "NGN" && amountMinor % 100 !== 0) return false;
  const { min, max } = REFILL_LIMITS_MINOR[currency];
  return amountMinor >= min && amountMinor <= max;
}

/** What the billing page is told: a week's price and the limits, per currency, for a paid plan. */
export function refillOffer(plan: PlanForRefill) {
  const ngn = refillWeekMinor(plan, "NGN");
  const usd = refillWeekMinor(plan, "USD");
  if (ngn === null && usd === null) return null;
  return {
    ngn: ngn === null ? null : { weekMinor: ngn, ...REFILL_LIMITS_MINOR.NGN },
    usd: usd === null ? null : { weekMinor: usd, ...REFILL_LIMITS_MINOR.USD },
  };
}

export function refillReference(id: string): string {
  return `refill-${id.replaceAll("-", "")}`;
}

/** The refill a paid charge is for: by the id we put in its metadata, its reference, or Bachs's checkout id. */
async function findRefill(
  admin: Admin,
  charge: { reference?: string | null; checkout_id?: string | null; metadata?: Record<string, string> | null },
  data: Pick<BachsCollectionData, "reference" | "checkout_id" | "metadata">,
) {
  const columns = "id, account_id, plan_code, expected_amount_minor, currency, status";
  const ours = charge.metadata?.refill_id ?? data.metadata?.refill_id;
  if (ours) {
    const { data: row } = await admin.from("tensor_refills").select(columns).eq("id", ours).maybeSingle();
    if (row) return row;
  }
  const reference = charge.reference || data.reference;
  if (reference) {
    const { data: row } = await admin.from("tensor_refills").select(columns).eq("reference", reference).maybeSingle();
    if (row) return row;
  }
  const theirs = charge.checkout_id ?? data.checkout_id;
  if (theirs) {
    const { data: row } = await admin.from("tensor_refills").select(columns).eq("provider_checkout_id", theirs).maybeSingle();
    if (row) return row;
  }
  return null;
}

/**
 * A refill's payment, verified with Bachs by the caller. The usage it buys is worked out again
 * from what was actually paid, at the plan's refill rate, so nothing on the page decides it.
 * Thrown errors make Bachs try again.
 */
export async function applyRefillPayment(
  admin: Admin,
  payment: {
    charge: { charge_id: string; reference?: string | null; checkout_id?: string | null; metadata?: Record<string, string> | null };
    amountMinor: number;
    currency: Currency;
  },
  data: Pick<BachsCollectionData, "reference" | "checkout_id" | "metadata">,
): Promise<void> {
  const refill = await findRefill(admin, payment.charge, data);
  if (!refill) throw new Error("Tensor refill not found for this charge.");
  if (refill.status === "paid") return;
  if (payment.currency === refill.currency && payment.amountMinor < Number(refill.expected_amount_minor)) {
    throw new Error("Refill payment is below its amount.");
  }

  const { data: plan, error: planError } = await admin
    .from("basecode_plans")
    .select("code, price_ngn_minor, price_usd_minor, pass_budget_microusd, billing_period_days")
    .eq("code", refill.plan_code)
    .single();
  if (planError || !plan) throw new Error("The refill's plan could not be read.");
  const credit = refillCreditMicrousd(plan as PlanForRefill, payment.amountMinor, payment.currency);
  if (!credit) throw new Error("The refill has no rate in the payment's currency.");

  const { error } = await admin.rpc("tensor_apply_refill", {
    p_refill_id: refill.id,
    p_transaction_id: payment.charge.charge_id,
    p_amount_minor: payment.amountMinor,
    p_currency: payment.currency,
    p_credit_microusd: credit,
  });
  if (error) throw new Error(`Could not apply the refill: ${error.message}`);
}
