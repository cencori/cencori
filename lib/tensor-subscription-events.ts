/**
 * What Bachs's events mean for a Tensor account.
 *
 * A Tensor plan is paid for in one of two ways. A single month (naira, or dollars on a plan with
 * no recurring product yet) arrives as one charge matched to a checkout of ours. A card
 * subscription arrives as a first charge, then the subscription's own events, then an invoice for
 * every month after. In both, the signed webhook only starts the work: the charge fetched back
 * from Bachs is the one thing allowed to grant anything.
 */
import {
  getCharge,
  getTensorPlanBySubscriptionProductId,
  type BachsCollectionData,
  type BachsInvoiceData,
  type BachsSubscriptionData,
} from "@/lib/bachsClient";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import {
  applyTensorSubscriptionPeriod,
  applyVerifiedTensorPayment,
  findTensorSubscriptionAccount,
  isPaidPlan,
  majorAmountToMinor,
  oneMonthAfter,
  type TensorCurrency,
} from "@/lib/tensor-billing";

type Admin = ReturnType<typeof createAdminClient>;

const PAID_STATUSES = ["succeeded", "successful", "paid"];

/** A charge fetched back from Bachs, when it is paid and in a currency Tensor sells in. */
async function verifiedCharge(chargeId: string) {
  const charge = await getCharge(chargeId);
  const amountMinor = majorAmountToMinor(charge?.amount);
  const currency: TensorCurrency | null =
    charge?.currency === "NGN" ? "NGN" : charge?.currency === "USD" ? "USD" : null;
  if (!charge || !PAID_STATUSES.includes(String(charge.status).toLowerCase()) || !currency || !amountMinor) {
    throw new Error("Bachs Tensor charge did not verify");
  }
  return { charge, amountMinor, currency };
}

/** One month bought without a catalog product: the checkout row says which plan it is. */
export async function handleTensorPassCharge(data: BachsCollectionData, admin: Admin): Promise<void> {
  if (!data.charge_id) throw new Error("Bachs Tensor collection is missing a charge ID");
  const { charge, amountMinor, currency } = await verifiedCharge(data.charge_id);
  if (!charge.reference) throw new Error("Bachs Tensor charge has no reference");
  await applyVerifiedTensorPayment(admin, {
    provider: "bachs",
    providerTransactionId: charge.charge_id,
    reference: charge.reference,
    amountMinor,
    currency,
    paymentMethod: charge.payment_method,
    paidAt: null,
    providerPayload: charge as unknown as Record<string, unknown>,
  });
}

/**
 * The first charge of a card subscription. The month it pays for starts now and is taken to be a
 * calendar month long until the invoice for it gives the exact dates.
 */
export async function handleTensorSubscriptionCharge(
  data: BachsCollectionData,
  productId: string,
  admin: Admin,
): Promise<void> {
  const planCode = getTensorPlanBySubscriptionProductId(productId);
  if (!planCode) throw new Error(`Unknown Bachs Tensor subscription product: ${productId}`);
  if (!data.charge_id) throw new Error("Bachs Tensor subscription payment has no charge ID");

  const { charge, amountMinor, currency } = await verifiedCharge(data.charge_id);
  const account = await findTensorSubscriptionAccount(admin, {
    accountId: charge.metadata?.account_id ?? data.metadata?.account_id,
    customerId: data.customer?.id,
  });
  // Thrown so Bachs retries: nothing may be granted to an account that cannot be named.
  if (!account) throw new Error("Bachs Tensor subscription payment names no account");

  // A renewal's charge can be reported here after its invoice has already applied the month's
  // exact dates. Estimating them again would move the month, and with it the week being counted.
  const { data: recorded, error: recordedError } = await admin
    .from("basecode_payments")
    .select("id")
    .eq("provider", "bachs")
    .eq("provider_transaction_id", charge.charge_id)
    .maybeSingle();
  if (recordedError) throw new Error("Could not check for the Tensor payment.");
  if (recorded) return;

  const start = new Date();
  await applyTensorSubscriptionPeriod(admin, {
    accountId: account.id,
    planCode,
    providerSubscriptionId: null,
    providerTransactionId: charge.charge_id,
    reference: charge.reference || charge.charge_id,
    amountMinor,
    currency,
    periodStart: start.toISOString(),
    periodEnd: oneMonthAfter(start).toISOString(),
    providerPayload: charge as unknown as Record<string, unknown>,
  });

  // The page the customer returns to polls this checkout, so it has to read as paid.
  if (charge.reference) {
    const { error } = await admin
      .from("basecode_checkout_sessions")
      .update({ status: "paid", paid_at: start.toISOString() })
      .eq("reference", charge.reference)
      .eq("account_id", account.id)
      .eq("status", "pending");
    if (error) console.error("[Tensor Billing] Could not mark the subscription checkout paid", error);
  }
  if (data.customer?.id) {
    await admin
      .from("basecode_billing_accounts")
      .update({ provider_customer_id: data.customer.id })
      .eq("id", account.id)
      .is("provider_customer_id", null);
  }
}

/**
 * A subscription being created, changed or ended. Returns false when the subscription is not one
 * of Tensor's, so the caller can hand it to whoever it does belong to.
 *
 * This records what Bachs says the subscription is; it never grants a month. A cancelled
 * subscription is only marked so: the month already paid for runs to its end by itself.
 */
export async function handleTensorSubscriptionLifecycle(
  data: BachsSubscriptionData,
  eventType: string,
  admin: Admin,
): Promise<boolean> {
  const planCode = getTensorPlanBySubscriptionProductId(data.product_id);
  if (!planCode) return false;

  const account = await findTensorSubscriptionAccount(admin, {
    subscriptionId: data.subscription_id,
    accountId: data.metadata?.account_id,
    customerId: data.customer?.customer_id,
  });
  if (!account) {
    // Thrown so Bachs retries: the account may be found once its customer id is saved.
    throw new Error(`Bachs ${eventType}: no Tensor account for subscription ${data.subscription_id}`);
  }

  // An event about a subscription the account has since replaced must not touch the current one.
  const { data: current, error: currentError } = await admin
    .from("basecode_subscriptions")
    .select("provider_subscription_id")
    .eq("account_id", account.id)
    .maybeSingle();
  if (currentError) throw new Error("Could not load the Tensor subscription.");
  if (
    current &&
    current.provider_subscription_id !== data.subscription_id &&
    eventType !== "customer.subscription.created"
  ) {
    return true;
  }

  const ended = eventType === "customer.subscription.deleted";
  const { error } = await admin.from("basecode_subscriptions").upsert(
    {
      account_id: account.id,
      plan_code: planCode,
      provider: "bachs",
      provider_subscription_id: data.subscription_id,
      status: ended ? "canceled" : data.status,
      currency: data.currency === "NGN" ? "NGN" : "USD",
      current_period_start: data.current_period_start,
      current_period_end: data.current_period_end,
      cancel_at_period_end: ended ? false : data.cancel_at_period_end,
      canceled_at: ended ? (data.canceled_at ?? new Date().toISOString()) : data.canceled_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id" },
  );
  if (error) throw new Error(`Could not record the Tensor subscription: ${error.message}`);

  if (data.customer?.customer_id) {
    await admin
      .from("basecode_billing_accounts")
      .update({ provider_customer_id: data.customer.customer_id })
      .eq("id", account.id)
      .is("provider_customer_id", null);
  }
  return true;
}

/**
 * A month's invoice being paid, or failing. Returns false when the invoice is not for a Tensor
 * subscription.
 *
 * A paid invoice is what moves the account's month forward. A failed one only marks the
 * subscription past due: Bachs retries the card, and the plan lapses to the trial by itself if
 * the month already paid for runs out first.
 */
export async function handleTensorSubscriptionInvoice(
  data: BachsInvoiceData,
  eventType: "invoice.paid" | "invoice.payment_failed",
  admin: Admin,
): Promise<boolean> {
  const subscriptionId = data.subscription?.subscription_id;
  if (!subscriptionId) return false;

  const { data: subscription, error } = await admin
    .from("basecode_subscriptions")
    .select("account_id, plan_code")
    .eq("provider", "bachs")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw new Error("Could not look up the Tensor subscription.");
  if (!subscription) return false;

  if (eventType === "invoice.payment_failed") {
    const { error: failedError } = await admin
      .from("basecode_subscriptions")
      .update({ status: "past_due", updated_at: new Date().toISOString() })
      .eq("provider_subscription_id", subscriptionId);
    if (failedError) throw new Error("Could not mark the Tensor subscription past due.");
    return true;
  }

  if (!isPaidPlan(subscription.plan_code)) {
    throw new Error(`Tensor subscription ${subscriptionId} is on an unknown plan`);
  }
  if (!data.charge) throw new Error(`Bachs invoice ${data.invoice_id} was paid with no charge`);
  if (!data.period_start || !data.period_end) {
    throw new Error(`Bachs invoice ${data.invoice_id} has no period`);
  }
  const { charge, amountMinor, currency } = await verifiedCharge(data.charge);
  await applyTensorSubscriptionPeriod(admin, {
    accountId: subscription.account_id as string,
    planCode: subscription.plan_code,
    providerSubscriptionId: subscriptionId,
    providerTransactionId: charge.charge_id,
    reference: data.invoice_id,
    amountMinor,
    currency,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    providerPayload: { invoice: data, charge } as unknown as Record<string, unknown>,
  });
  return true;
}
