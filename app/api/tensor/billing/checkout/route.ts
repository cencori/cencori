import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateTensorBillingRequest,
  tensorCheckoutReference,
  paystackChannels,
  getTensorPlan,
  getOrCreateTensorBillingAccount,
  parseTensorCheckoutInput,
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

  const input = parseTensorCheckoutInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json(
      { error: "Choose Starter, Builder or Pro and a supported payment method." },
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
    const plan = await getTensorPlan(session.admin, input.plan);
    const expectedAmountMinor =
      input.provider === "paystack" ? plan.price_ngn_minor : plan.price_usd_minor;
    if (!expectedAmountMinor || expectedAmountMinor <= 0) {
      throw new Error("The selected plan does not have a configured price.");
    }

    const { error: insertError } = await session.admin.from("basecode_checkout_sessions").insert({
      id: checkoutId,
      account_id: account.id,
      plan_code: plan.code,
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

    // The provider is told what is being bought only for its own records: the checkout row above
    // is what a verified payment is matched to, and what decides the pass it grants.
    const metadata = {
      purchase_type: "basecode_subscription",
      checkout_id: checkoutId,
      account_id: account.id,
      user_id: session.user.id,
      plan_code: plan.code,
    };
    if (input.provider === "paystack") {
      const result = await initializePaystackTransaction({
        email: session.user.email,
        // Paystack takes the NGN minor unit (kobo) directly — the same units the plans table
        // stores, so no major/minor conversion happens here.
        amountMinor: expectedAmountMinor,
        reference,
        callbackUrl: `${baseUrl}/tensor?billing_return=${encodeURIComponent(checkoutId)}`,
        currency: "NGN",
        channels: paystackChannels(input.paymentMethod),
        metadata,
      });
      providerCheckoutId = result.data.access_code;
      checkoutUrl = result.data.authorization_url;
    } else {
      const result = await createCheckoutSession({
        product_cart: [{ product_id: getTensorProductId(input.plan), quantity: 1 }],
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
        metadata,
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
