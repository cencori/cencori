import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  applyVerifiedBasecodePayment,
  getBasecodePlan,
  getBasecodePlanByPaystackPlanCode,
  type BasecodePaidPlanCode,
} from "@/lib/basecode-billing";
import {
  listPaystackSubscriptions,
  verifyPaystackTransaction,
  verifyPaystackWebhook,
  type PaystackSubscription,
} from "@/lib/paystackClient";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type PaystackChargeData = {
  reference?: string;
};

type PaystackSubscriptionData = {
  subscription_code?: string;
  email_token?: string;
  status?: string;
  plan?: { plan_code?: string };
  customer?: { id?: number; customer_code?: string; email?: string };
};

type PaystackWebhook = {
  event?: string;
  data?: PaystackChargeData & PaystackSubscriptionData;
};

type Admin = ReturnType<typeof createAdminClient>;

async function markEvent(
  eventId: string,
  status: "processed" | "ignored" | "failed",
  error?: string,
) {
  const admin = createAdminClient();
  await admin
    .from("basecode_webhook_events")
    .update({ status, error: error?.slice(0, 500) ?? null, processed_at: new Date().toISOString() })
    .eq("provider", "paystack")
    .eq("provider_event_id", eventId);
}

async function claimEvent(eventId: string, eventType: string, payloadSha256: string) {
  const admin = createAdminClient();
  const { error: claimError } = await admin.from("basecode_webhook_events").insert({
    provider: "paystack",
    provider_event_id: eventId,
    event_type: eventType,
    payload_sha256: payloadSha256,
    status: "processing",
  });
  if (claimError?.code === "23505") {
    const { data: previous, error: previousError } = await admin
      .from("basecode_webhook_events")
      .select("status, payload_sha256")
      .eq("provider", "paystack")
      .eq("provider_event_id", eventId)
      .maybeSingle();
    if (previousError || !previous) {
      return { claimed: false as const, status: 500 as const, error: "Webhook persistence failed" };
    }
    if (previous.payload_sha256 !== payloadSha256) {
      return { claimed: false as const, status: 409 as const, error: "Webhook event mismatch" };
    }
    if (previous.status !== "failed") return { claimed: false as const, status: 200 as const };
    const { data: retry, error: retryError } = await admin
      .from("basecode_webhook_events")
      .update({ status: "processing", error: null, processed_at: null })
      .eq("provider", "paystack")
      .eq("provider_event_id", eventId)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (retryError) {
      return { claimed: false as const, status: 500 as const, error: "Webhook persistence failed" };
    }
    if (!retry) return { claimed: false as const, status: 200 as const };
  } else if (claimError) {
    console.error("[Basecode Paystack] Could not claim webhook", claimError);
    return { claimed: false as const, status: 500 as const, error: "Webhook persistence failed" };
  }
  return { claimed: true as const };
}

/** Resolves a billing account from a Paystack customer code saved at first payment. */
async function findAccountByCustomerCode(
  admin: Admin,
  customerCode: string,
): Promise<string | null> {
  const { data } = await admin
    .from("basecode_billing_customers")
    .select("account_id")
    .eq("provider", "paystack")
    .eq("provider_customer_id", customerCode)
    .maybeSingle();
  return (data?.account_id as string | undefined) ?? null;
}

async function attachSubscription(
  admin: Admin,
  accountId: string,
  plan: BasecodePaidPlanCode,
  subscriptionCode: string,
  emailToken: string | null,
): Promise<void> {
  const { data: existing } = await admin
    .from("basecode_subscriptions")
    .select("id")
    .eq("account_id", accountId)
    .eq("plan_code", plan)
    .in("status", ["active", "past_due", "paused"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    const { error } = await admin
      .from("basecode_subscriptions")
      .update({
        provider_subscription_id: subscriptionCode,
        ...(emailToken ? { provider_subscription_token: emailToken } : {}),
        auto_renews: true,
        cancel_at_period_end: false,
      })
      .eq("id", existing.id);
    if (error) throw new Error("Could not link the subscription.");
    return;
  }
  // The subscription webhook beat the first-payment webhook: record the row now and
  // let the payment attach its period when it lands.
  const planRow = await getBasecodePlan(admin, plan);
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + planRow.billing_period_days * 86_400_000);
  const { error } = await admin.from("basecode_subscriptions").insert({
    account_id: accountId,
    plan_code: plan,
    provider: "paystack",
    provider_subscription_id: subscriptionCode,
    ...(emailToken ? { provider_subscription_token: emailToken } : {}),
    status: "active",
    current_period_start: startsAt.toISOString(),
    current_period_end: endsAt.toISOString(),
    auto_renews: true,
  });
  if (error) throw new Error("Could not record the subscription.");
}

/**
 * Extends access for a provider-generated renewal charge, which carries no checkout
 * reference of its own. The subscription is resolved through the customer's active
 * Paystack subscriptions rather than trusted from the payload alone.
 */
async function applyRenewal(
  admin: Admin,
  transaction: {
    id: number;
    amount: number;
    currency: string;
    channel?: string;
    paid_at?: string;
    customer?: { id?: number; customer_code?: string };
    [key: string]: unknown;
  },
): Promise<void> {
  const customerCode = transaction.customer?.customer_code;
  const customerId = transaction.customer?.id;
  if (!customerCode || !customerId) throw new Error("Renewal charge has no customer.");
  const accountId = await findAccountByCustomerCode(admin, customerCode);
  if (!accountId) throw new Error("Renewal charge matches no billing account.");

  const subscriptions = await listPaystackSubscriptions(customerId);
  const match = subscriptions.find(
    (sub) =>
      sub.plan?.plan_code && getBasecodePlanByPaystackPlanCode(sub.plan.plan_code) !== null,
  );
  if (!match?.plan?.plan_code) throw new Error("Renewal matches no Basecode plan.");
  const plan = getBasecodePlanByPaystackPlanCode(match.plan.plan_code);
  if (!plan) throw new Error("Renewal matches no Basecode plan.");
  const planRow = await getBasecodePlan(admin, plan);
  if (transaction.amount < (planRow.price_ngn_minor ?? 0)) {
    throw new Error("Renewal amount is below the plan price.");
  }

  const { data, error } = await admin.rpc("basecode_apply_subscription_renewal", {
    p_account_id: accountId,
    p_plan_code: plan,
    p_provider: "paystack",
    p_provider_subscription_id: match.subscription_code,
    p_provider_transaction_id: String(transaction.id),
    p_amount_minor: transaction.amount,
    p_currency: transaction.currency,
    p_payment_method: transaction.channel ?? null,
    p_paid_at: transaction.paid_at ?? new Date().toISOString(),
    p_provider_payload: transaction as unknown as Record<string, unknown>,
  });
  if (error) throw new Error(`Could not apply the renewal: ${error.message}`);
  if (data && typeof data === "object" && (data as { duplicate?: boolean }).duplicate) return;

  // Backfill the disable token so opt-out keeps working even when the
  // subscription.create webhook arrived before the customer row existed.
  if (match.email_token) {
    await admin
      .from("basecode_subscriptions")
      .update({ provider_subscription_token: match.email_token })
      .eq("account_id", accountId)
      .eq("plan_code", plan)
      .eq("provider", "paystack")
      .eq("provider_subscription_id", match.subscription_code);
  }
}

async function handleChargeSuccess(admin: Admin, eventId: string, reference: string) {
  const transaction = await verifyPaystackTransaction(reference);
  if (
    transaction.status !== "success" ||
    transaction.reference !== reference ||
    !Number.isSafeInteger(transaction.amount) ||
    transaction.amount <= 0 ||
    transaction.currency !== "NGN"
  ) {
    await markEvent(eventId, "ignored", "Transaction did not verify as a successful NGN payment.");
    return;
  }

  const { data: checkout } = await admin
    .from("basecode_checkout_sessions")
    .select("id")
    .eq("reference", transaction.reference)
    .maybeSingle();

  if (checkout) {
    await applyVerifiedBasecodePayment(admin, {
      provider: "paystack",
      providerTransactionId: String(transaction.id),
      reference: transaction.reference,
      amountMinor: transaction.amount,
      currency: "NGN",
      paymentMethod: transaction.channel,
      paidAt: transaction.paid_at,
      providerCustomerId: transaction.customer?.customer_code ?? null,
      providerPayload: transaction as unknown as Record<string, unknown>,
    });
  } else {
    // A provider-generated reference: a subscription renewal, not a checkout.
    await applyRenewal(admin, {
      ...transaction,
      channel: transaction.channel,
      paid_at: transaction.paid_at,
      customer: transaction.customer,
    });
  }
  await markEvent(eventId, "processed");
}

async function handleSubscriptionCreated(admin: Admin, eventId: string, data: PaystackSubscriptionData) {
  const plan = data.plan?.plan_code ? getBasecodePlanByPaystackPlanCode(data.plan.plan_code) : null;
  const customerCode = data.customer?.customer_code;
  if (!plan || !data.subscription_code || !customerCode) {
    await markEvent(eventId, "ignored", "Subscription event is not a Basecode subscription.");
    return;
  }
  const accountId = await findAccountByCustomerCode(admin, customerCode);
  if (!accountId) {
    // The first-payment webhook likely has not processed yet — fail so Paystack
    // redelivers after the customer row exists.
    throw new Error("Subscription matches no billing account yet.");
  }
  await attachSubscription(admin, accountId, plan, data.subscription_code, data.email_token ?? null);
  await markEvent(eventId, "processed");
}

async function handleSubscriptionEnded(admin: Admin, eventId: string, data: PaystackSubscriptionData) {
  if (!data.subscription_code) {
    await markEvent(eventId, "ignored");
    return;
  }
  const { data: row } = await admin
    .from("basecode_subscriptions")
    .select("id")
    .eq("provider", "paystack")
    .eq("provider_subscription_id", data.subscription_code)
    .maybeSingle();
  if (!row) {
    await markEvent(eventId, "ignored", "Subscription matches no Basecode account.");
    return;
  }
  await admin
    .from("basecode_subscriptions")
    .update({ auto_renews: false, cancel_at_period_end: true })
    .eq("id", row.id);
  await markEvent(eventId, "processed");
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let signatureValid = false;
  try {
    signatureValid = verifyPaystackWebhook(rawBody, request.headers.get("x-paystack-signature"));
  } catch (error) {
    console.error("[Basecode Paystack] Webhook configuration error", error);
    return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
  }
  if (!signatureValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaystackWebhook;
  try {
    event = JSON.parse(rawBody) as PaystackWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventType = event.event || "unknown";
  // The claim id scopes to event + provider id so Paystack retries dedupe without one
  // event type swallowing another for the same payment.
  const providerId =
    event.data?.reference || event.data?.subscription_code || null;
  const eventId =
    providerId && providerId.length <= 200 ? `${eventType}:${providerId}` : null;
  if (!eventId) {
    return NextResponse.json({ error: "Missing event reference" }, { status: 400 });
  }

  const admin = createAdminClient();
  const payloadSha256 = createHash("sha256").update(rawBody).digest("hex");
  const claim = await claimEvent(eventId, eventType, payloadSha256);
  if (!claim.claimed) {
    return claim.status === 200
      ? NextResponse.json({ received: true })
      : NextResponse.json({ error: claim.error }, { status: claim.status });
  }

  try {
    if (eventType === "charge.success" && event.data?.reference) {
      await handleChargeSuccess(admin, eventId, event.data.reference);
    } else if (eventType === "subscription.create" && event.data) {
      await handleSubscriptionCreated(admin, eventId, event.data);
    } else if (
      (eventType === "subscription.not_renew" || eventType === "subscription.disable") &&
      event.data
    ) {
      await handleSubscriptionEnded(admin, eventId, event.data);
    } else {
      await markEvent(eventId, "ignored");
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    console.error("[Basecode Paystack] Processing failed", error);
    await markEvent(eventId, "failed", message);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

export type { PaystackSubscription };
