import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateTensorBillingRequest,
  tensorCheckoutReference,
  getTensorPlan,
  getOrCreateTensorBillingAccount,
  parseTensorCheckoutInput,
  resolveTensorCheckoutOrigin,
} from "@/lib/tensor-billing";
import {
  createCheckoutSession,
  createCustomer,
  getTensorPassProductId,
  getTensorSubscriptionProductId,
  type CreateCheckoutSessionInput,
} from "@/lib/bachsClient";
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
      { error: "Choose a Tensor plan." },
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
    const plan = await getTensorPlan(session.admin, input.plan);
    // Naira is one payment for one month; dollars renew by card where the plan has a recurring
    // product. A page that names no currency is one from before there was a choice.
    const currency = input.currency ?? "USD";
    const expectedAmountMinor = currency === "NGN" ? plan.price_ngn_minor : plan.price_usd_minor;
    if (!expectedAmountMinor || expectedAmountMinor <= 0) {
      throw new Error("The selected plan does not have a configured price.");
    }
    const subscriptionProductId =
      currency === "USD" ? getTensorSubscriptionProductId(input.plan) : null;

    if (subscriptionProductId) {
      // One subscription an account: a second would bill twice for one plan.
      const { data: running, error: runningError } = await session.admin
        .from("basecode_subscriptions")
        .select("status, cancel_at_period_end")
        .eq("account_id", account.id)
        .maybeSingle();
      if (runningError) throw new Error("Could not check for a running subscription.");
      if (
        running &&
        (running.status === "active" || running.status === "trialing" || running.status === "past_due") &&
        !running.cancel_at_period_end
      ) {
        return NextResponse.json(
          {
            error:
              "You already have a Tensor subscription. Change or cancel it from Manage subscription first.",
          },
          { headers: noStoreHeaders(), status: 409 },
        );
      }
    }

    const { error: insertError } = await session.admin.from("basecode_checkout_sessions").insert({
      id: checkoutId,
      account_id: account.id,
      plan_code: plan.code,
      provider: "bachs",
      reference,
      expected_amount_minor: expectedAmountMinor,
      currency,
      expires_at: expiresAt.toISOString(),
    });
    if (insertError) throw new Error("Could not create the checkout record.");

    // Back to the page the checkout was opened from: the Tensor website's billing page when it
    // asked (validated in parseTensorCheckoutInput), otherwise cencori.com/tensor.
    const returnPage = input.returnUrl ?? `${appBaseUrl(request)}/tensor`;
    const name =
      (session.user.user_metadata?.full_name as string | undefined) ||
      session.user.email.split("@")[0];
    const metadata = {
      checkout_id: checkoutId,
      account_id: account.id,
      user_id: session.user.id,
      plan_code: plan.code,
    };
    const shared = {
      success_url: `${returnPage}?billing_return=${encodeURIComponent(checkoutId)}`,
      cancel_url: `${returnPage}?billing_cancelled=1`,
      reference,
      expires_in_minutes: 30,
    };

    let checkout: CreateCheckoutSessionInput;
    if (subscriptionProductId) {
      // A recurring product is billed to a saved customer, so the account gets one first.
      let customerId = account.provider_customer_id ?? null;
      if (!customerId) {
        const customer = await createCustomer({
          email: session.user.email,
          name,
          metadata: { tensor_account_id: account.id, user_id: session.user.id },
        });
        customerId = customer.customer_id;
        const { error: customerError } = await session.admin
          .from("basecode_billing_accounts")
          .update({ provider_customer_id: customerId })
          .eq("id", account.id);
        if (customerError) throw new Error("Could not save the Bachs customer.");
      }
      checkout = {
        ...shared,
        product_cart: [{ product_id: subscriptionProductId, quantity: 1 }],
        customer: { customer_id: customerId },
        // Copied onto the subscription by Bachs, which is how its events find the account.
        metadata: { ...metadata, purchase_type: "tensor_subscription" },
      };
    } else {
      // One month, for exactly the plan's price in the currency chosen. The checkout row above
      // is what a verified payment is matched to, and what decides the plan it grants; a catalog
      // product is sent only where one exists, for Bachs's own records.
      const passProductId = currency === "USD" ? getTensorPassProductId(input.plan) : null;
      checkout = {
        ...shared,
        ...(passProductId
          ? { product_cart: [{ product_id: passProductId, quantity: 1 }] }
          : {
              pricing: {
                currency,
                price_type: "fixed" as const,
                amount: (expectedAmountMinor / 100).toFixed(2),
              },
              billing_currency: currency,
            }),
        customer: { email: session.user.email, name },
        metadata: {
          ...metadata,
          purchase_type: passProductId ? "basecode_subscription" : "tensor_pass",
        },
      };
    }
    const result = await createCheckoutSession(checkout);
    const providerCheckoutId = result.checkout_id;
    const checkoutUrl = result.checkout_url;

    const { error: updateError } = await session.admin
      .from("basecode_checkout_sessions")
      .update({ provider_checkout_id: providerCheckoutId, checkout_url: checkoutUrl })
      .eq("id", checkoutId)
      .eq("account_id", account.id);
    if (updateError) throw new Error("Could not save the provider checkout.");

    return NextResponse.json(
      {
        checkoutId,
        checkoutUrl,
        expiresAt: expiresAt.toISOString(),
        currency,
        renews: Boolean(subscriptionProductId),
      },
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
