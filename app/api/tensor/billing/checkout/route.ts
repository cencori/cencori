import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateTensorBillingRequest,
  tensorCheckoutReference,
  getPaystackPlanCode,
  paystackChannels,
  getTensorPlan,
  getTensorPack,
  getOrCreateTensorBillingAccount,
  parseTensorCheckoutInput,
  parseTensorPackCheckoutInput,
  resolveTensorCheckoutOrigin,
} from "@/lib/tensor-billing";
import { createCheckoutSession, getTensorProductId } from "@/lib/bachsClient";
import { initializePaystackTransaction } from "@/lib/paystackClient";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { resolvePublicOrigin } from "@/lib/public-origin";

function appBaseUrl(request: NextRequest): string {
  return resolveTensorCheckoutOrigin(resolvePublicOrigin(request));
}

export async function POST(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session || !session.user.email) {
    return NextResponse.json(
      { error: "Your Cencori session is invalid." },
      { headers: noStoreHeaders(), status: 401 },
    );
  }

  const rawBody = await request.json().catch(() => null);
  // Prepaid packs are the default path (cash first, no subscription promise).
  // Legacy plan subscriptions still parse for backwards-compatible webhooks,
  // but the client only sends packs.
  const packInput = parseTensorPackCheckoutInput(rawBody);
  const planInput = packInput ? null : parseTensorCheckoutInput(rawBody);
  const input = packInput ?? planInput;
  if (!input) {
    return NextResponse.json(
      { error: "Choose a Starter, Builder or Pro pack and a supported payment method." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }

  const checkoutId = randomUUID();
  const reference = tensorCheckoutReference(checkoutId);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  let accountId: string | null = null;

  try {
    const account = await getOrCreateTensorBillingAccount(session.admin, session.user.id);
    accountId = account.id;
    const currency = input.provider === "paystack" ? "NGN" : "USD";
    let expectedAmountMinor: number | null = null;
    let planCode: string;
    let packCode: string | null = null;
    let purchaseKind: "subscription" | "prepaid" = "prepaid";
    if (packInput) {
      const pack = await getTensorPack(session.admin, packInput.pack);
      expectedAmountMinor =
        input.provider === "paystack" ? pack.price_ngn_minor : pack.price_usd_minor;
      planCode = pack.grants_plan;
      packCode = pack.code;
    } else {
      const plan = await getTensorPlan(session.admin, (input as { plan: "builder" | "pro" }).plan);
      expectedAmountMinor =
        input.provider === "paystack" ? plan.price_ngn_minor : plan.price_usd_minor;
      planCode = plan.code;
      purchaseKind = "subscription";
    }
    if (!expectedAmountMinor || expectedAmountMinor <= 0) {
      throw new Error("The selected pack does not have a configured price.");
    }

    const { error: insertError } = await session.admin.from("basecode_checkout_sessions").insert({
      id: checkoutId,
      account_id: account.id,
      plan_code: planCode,
      pack_code: packCode,
      purchase_kind: purchaseKind,
      provider: input.provider,
      reference,
      expected_amount_minor: expectedAmountMinor,
      currency,
      expires_at: expiresAt.toISOString(),
    });
    if (insertError) throw new Error("Could not create the checkout record.");

    const baseUrl = appBaseUrl(request);
    let providerCheckoutId: string | null = null;
    let checkoutUrl: string;

    if (input.provider === "paystack") {
      // Prepaid packs are always one-off: OPay, transfer and card all work
      // because nothing is reused. Legacy subscriptions keep the recurring path.
      const recurring = !packInput && (input as { recurring?: boolean }).recurring === true;
      const result = await initializePaystackTransaction({
        email: session.user.email,
        // Paystack takes the NGN minor unit (kobo) directly — the same units the
        // packs/plans tables store, so no major/minor conversion happens here.
        amountMinor: expectedAmountMinor,
        reference,
        callbackUrl: `${baseUrl}/tensor?billing_return=${encodeURIComponent(checkoutId)}`,
        currency: "NGN",
        channels: recurring ? ["card"] : paystackChannels(input.paymentMethod),
        ...(recurring && !packInput
          ? { plan: getPaystackPlanCode((input as { plan: "builder" | "pro" }).plan) }
          : {}),
        metadata: {
          purchase_type: packInput ? "basecode_prepaid" : "basecode_subscription",
          checkout_id: checkoutId,
          account_id: account.id,
          user_id: session.user.id,
          plan_code: planCode,
          ...(packCode ? { pack_code: packCode } : {}),
          ...(recurring ? { recurring: "true" } : {}),
        },
      });
      providerCheckoutId = result.data.access_code;
      checkoutUrl = result.data.authorization_url;
    } else {
      // Bachs prepaid uses the same plan products for now; the webhook credits
      // the wallet instead of granting a subscription period when the checkout
      // is marked prepaid. Pack-specific Bachs products can replace these IDs.
      const bachsPlan = packInput
        ? packInput.pack === "starter"
          ? ("builder" as const)
          : packInput.pack
        : (input as { plan: "builder" | "pro" }).plan;
      const result = await createCheckoutSession({
        product_cart: [{ product_id: getTensorProductId(bachsPlan), quantity: 1 }],
        customer: {
          email: session.user.email,
          name:
            (session.user.user_metadata?.full_name as string | undefined) ||
            session.user.email.split("@")[0],
        },
        success_url: `${baseUrl}/tensor?billing_return=${encodeURIComponent(checkoutId)}`,
        cancel_url: `${baseUrl}/tensor?billing_cancelled=1`,
        reference,
        expires_in_minutes: 30,
        metadata: {
          purchase_type: packInput ? "basecode_prepaid" : "basecode_subscription",
          checkout_id: checkoutId,
          account_id: account.id,
          user_id: session.user.id,
          plan_code: planCode,
          ...(packCode ? { pack_code: packCode } : {}),
        },
      });
      providerCheckoutId = result.checkout_id;
      checkoutUrl = result.checkout_url;
    }

    const { error: updateError } = await session.admin
      .from("basecode_checkout_sessions")
      .update({ provider_checkout_id: providerCheckoutId, checkout_url: checkoutUrl })
      .eq("id", checkoutId)
      .eq("account_id", account.id);
    if (updateError) throw new Error("Could not save the provider checkout.");

    return NextResponse.json(
      { checkoutId, checkoutUrl, expiresAt: expiresAt.toISOString() },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("[Tensor Billing] Checkout failed", error);
    if (accountId) {
      await session.admin
        .from("basecode_checkout_sessions")
        .update({ status: "failed" })
        .eq("id", checkoutId)
        .eq("account_id", accountId)
        .eq("status", "pending");
    }
    return NextResponse.json(
      { error: "Checkout is temporarily unavailable. Please try again." },
      { headers: noStoreHeaders(), status: 502 },
    );
  }
}
