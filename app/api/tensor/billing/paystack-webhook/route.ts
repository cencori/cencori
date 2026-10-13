import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { applyVerifiedTensorPayment } from "@/lib/tensor-billing";
import { verifyPaystackTransaction, verifyPaystackWebhook } from "@/lib/paystackClient";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type PaystackChargeData = {
  reference?: string;
};

type PaystackWebhook = {
  event?: string;
  data?: PaystackChargeData;
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
    console.error("[Tensor Paystack] Could not claim webhook", claimError);
    return { claimed: false as const, status: 500 as const, error: "Webhook persistence failed" };
  }
  return { claimed: true as const };
}

/**
 * A charge buys a pass, and only a charge Tensor opened a checkout for.
 *
 * Passes are one payment each and nothing renews, so a successful charge with no checkout behind
 * it is not Tensor's to act on: it is acknowledged and left alone rather than guessed at.
 */
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
  if (!checkout) {
    await markEvent(eventId, "ignored", "Charge matches no Tensor checkout.");
    return;
  }

  await applyVerifiedTensorPayment(admin, {
    provider: "paystack",
    providerTransactionId: String(transaction.id),
    reference: transaction.reference,
    amountMinor: transaction.amount,
    currency: "NGN",
    paymentMethod: transaction.channel,
    paidAt: transaction.paid_at,
    providerPayload: transaction as unknown as Record<string, unknown>,
  });
  await markEvent(eventId, "processed");
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let signatureValid = false;
  try {
    signatureValid = verifyPaystackWebhook(rawBody, request.headers.get("x-paystack-signature"));
  } catch (error) {
    console.error("[Tensor Paystack] Webhook configuration error", error);
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
  const providerId = event.data?.reference || null;
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
    } else {
      await markEvent(eventId, "ignored");
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    console.error("[Tensor Paystack] Processing failed", error);
    await markEvent(eventId, "failed", message);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
