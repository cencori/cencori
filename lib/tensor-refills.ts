/**
 * Refills: a paid plan that has used its week buys the week again, for a price above the plan's
 * own weekly share. See database/brimble/3100_tensor_refills.sql.
 *
 * The price is the plan's month, cut to a week (7 of 30 days), times REFILL_PREMIUM. Plans charge
 * about 2,000 naira for each dollar of model cost they allow; a refill charges half as much again,
 * so it earns well above what it lets through, and refilling often costs more than the next plan.
 */
import type { BachsCollectionData } from "@/lib/bachsClient";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import { tensorPlanPriceMinor, type TensorPlanRow } from "@/lib/tensor-billing";

type Admin = ReturnType<typeof createAdminClient>;

export const REFILL_PREMIUM = 1.5;
/** Prices are rounded up to these steps: 50 naira, and 50 cents. */
const STEP_MINOR = { NGN: 5000, USD: 50 } as const;

/** What a refill costs on a plan, in one currency, or null where the plan has no price in it. */
export function refillPriceMinor(
  plan: Pick<TensorPlanRow, "code" | "price_ngn_minor" | "price_usd_minor">,
  currency: "NGN" | "USD",
): number | null {
  if (plan.code === "free") return null;
  const month = tensorPlanPriceMinor(plan, currency);
  if (!month) return null;
  const raw = (month * 7 * REFILL_PREMIUM) / 30;
  const step = STEP_MINOR[currency];
  return Math.ceil(raw / step) * step;
}

/** A refill is offered once the week is used: a paid plan whose week's cost has met its share. */
export function canRefill(planCode: string, allowance: { budgetMicrousd: number | null; costUsedMicrousd: number }): boolean {
  if (planCode === "free" || allowance.budgetMicrousd === null || allowance.budgetMicrousd <= 0) return false;
  return allowance.costUsedMicrousd >= allowance.budgetMicrousd;
}

export function refillReference(id: string): string {
  return `refill-${id.replaceAll("-", "")}`;
}

/** The refill a paid charge is for: by the id we put in its metadata, or by Bachs's checkout id. */
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
 * A refill's payment, verified with Bachs by the caller. Thrown errors make Bachs try again,
 * which is right for anything that may pass later; a payment below the price never will, and is
 * refused the same way so it is seen in the logs.
 */
export async function applyRefillPayment(
  admin: Admin,
  payment: {
    charge: { charge_id: string; reference?: string | null; checkout_id?: string | null; metadata?: Record<string, string> | null };
    amountMinor: number;
    currency: "NGN" | "USD";
  },
  data: Pick<BachsCollectionData, "reference" | "checkout_id" | "metadata">,
): Promise<void> {
  const refill = await findRefill(admin, payment.charge, data);
  if (!refill) throw new Error("Tensor refill not found for this charge.");
  if (refill.status === "paid") return;

  const { data: plan, error: planError } = await admin
    .from("basecode_plans")
    .select("code, price_ngn_minor, price_usd_minor")
    .eq("code", refill.plan_code)
    .single();
  if (planError || !plan) throw new Error("The refill's plan could not be read.");
  const price = refillPriceMinor(plan, payment.currency);
  if (!price) throw new Error("The refill has no price in the payment's currency.");
  if (payment.amountMinor < price) throw new Error("Refill payment is below its price.");

  const { error } = await admin.rpc("tensor_apply_refill", {
    p_refill_id: refill.id,
    p_transaction_id: payment.charge.charge_id,
    p_amount_minor: payment.amountMinor,
    p_currency: payment.currency,
  });
  if (error) throw new Error(`Could not apply the refill: ${error.message}`);
}
