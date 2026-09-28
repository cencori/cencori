import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateBasecodeBillingRequest,
  basecodeCheckoutReference,
  getPaystackPlanCode,
  paystackChannels,
  getBasecodePlan,
  getOrCreateBasecodeBillingAccount,
  parseBasecodeCheckoutInput,
  resolveBasecodeCheckoutOrigin,
} from "@/lib/basecode-billing";
import { createCheckoutSession, getBasecodeProductId } from "@/lib/bachsClient";
import { initializePaystackTransaction } from "@/lib/paystackClient";
import { noStoreHeaders } from "@/lib/basecode-auth";
import { resolvePublicOrigin } from "@/lib/public-origin";

function appBaseUrl(request: NextRequest): string {
  return resolveBasecodeCheckoutOrigin(resolvePublicOrigin(request));
}

export async function POST(request: NextRequest) {
  const session = await authenticateBasecodeBillingRequest(request);
  if (!session || !session.user.email) {
    return NextResponse.json(
      { error: "Your Cencori session is invalid." },
      { headers: noStoreHeaders(), status: 401 },
    );
  }

  let input: ReturnType<typeof parseBasecodeCheckoutInput>;
  try {
    input = parseBasecodeCheckoutInput(await request.json());
  } catch {
    input = null;
  }
  if (!input) {
    return NextResponse.json(
      { error: "Choose Builder or Pro and a supported payment method." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }

  const checkoutId = randomUUID();
  const reference = basecodeCheckoutReference(checkoutId);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  let accountId: string | null = null;

  try {
    const [account, plan] = await Promise.all([
      getOrCreateBasecodeBillingAccount(session.admin, session.user.id),
      getBasecodePlan(session.admin, input.plan),
    ]);
    accountId = account.id;
    const currency = input.provider === "paystack" ? "NGN" : "USD";
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

    if (input.provider === "paystack") {
      // Recurring always pays by card: only card authorizations can be reused for
      // subscriptions — OPay and bank-transfer payments are one-off by nature.
      const result = await initializePaystackTransaction({
        email: session.user.email,
        // Paystack takes the NGN minor unit (kobo) directly — the same units the
        // plans table stores, so no major/minor conversion happens here. Ignored
        // when `plan` is passed: the plan amount is charged instead.
        amountMinor: expectedAmountMinor,
        reference,
        callbackUrl: `${baseUrl}/basecode?billing_return=${encodeURIComponent(checkoutId)}`,
        currency: "NGN",
        channels: input.recurring ? ["card"] : paystackChannels(input.paymentMethod),
        ...(input.recurring ? { plan: getPaystackPlanCode(input.plan) } : {}),
        metadata: {
          purchase_type: "basecode_subscription",
          checkout_id: checkoutId,
          account_id: account.id,
          user_id: session.user.id,
          plan_code: plan.code,
          ...(input.recurring ? { recurring: "true" } : {}),
        },
      });
      providerCheckoutId = result.data.access_code;
      checkoutUrl = result.data.authorization_url;
    } else {
      const result = await createCheckoutSession({
        product_cart: [{ product_id: getBasecodeProductId(input.plan), quantity: 1 }],
        customer: {
          email: session.user.email,
          name:
            (session.user.user_metadata?.full_name as string | undefined) ||
            session.user.email.split("@")[0],
        },
        success_url: `${baseUrl}/basecode?billing_return=${encodeURIComponent(checkoutId)}`,
        cancel_url: `${baseUrl}/basecode?billing_cancelled=1`,
        reference,
        expires_in_minutes: 30,
        metadata: {
          purchase_type: "basecode_subscription",
          checkout_id: checkoutId,
          account_id: account.id,
          user_id: session.user.id,
          plan_code: plan.code,
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
    console.error("[Basecode Billing] Checkout failed", error);
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
