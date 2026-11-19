import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateTensorBillingRequest,
  effectiveTensorPlan,
  getOrCreateTensorBillingAccount,
  getTensorPlan,
  tensorCheckoutReturnUrl,
} from "@/lib/tensor-billing";
import { refillAmountAllowed, refillCreditMicrousd, refillReference } from "@/lib/tensor-refills";
import { createCheckoutSession } from "@/lib/bachsClient";
import { noStoreHeaders } from "@/lib/tensor-auth";

/**
 * A Bachs checkout for a refill: an amount of the customer's choosing, within limits, on a paid
 * plan, at that plan's refill rate (lib/tensor-refills.ts). The payment is applied by the webhook
 * (purchase_type "tensor_refill"), which works the usage out again from what was paid.
 */
export async function POST(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session || !session.user.email) {
    return NextResponse.json({ error: "Your Cencori session is invalid." }, { headers: noStoreHeaders(), status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { currency?: unknown; return_url?: unknown; amount_minor?: unknown } | null;
  const currency = body?.currency === "USD" ? "USD" : "NGN";
  const amountMinor = body?.amount_minor;
  if (!refillAmountAllowed(amountMinor, currency)) {
    return NextResponse.json({ error: "Choose an amount within the limits shown." }, { headers: noStoreHeaders(), status: 400 });
  }
  const returnUrl = tensorCheckoutReturnUrl(body?.return_url);
  if (!returnUrl) {
    return NextResponse.json({ error: "Open the refill from Tensor's billing page." }, { headers: noStoreHeaders(), status: 400 });
  }

  const refillId = randomUUID();
  try {
    const account = await getOrCreateTensorBillingAccount(session.admin, session.user.id);
    const plan = await getTensorPlan(session.admin, effectiveTensorPlan(account));
    const credit = refillCreditMicrousd(plan, amountMinor, currency);
    if (!credit) {
      return NextResponse.json(
        { error: "Refills come with a paid plan. Choose one to keep going." },
        { headers: noStoreHeaders(), status: 409 },
      );
    }

    const reference = refillReference(refillId);
    const { error: insertError } = await session.admin.from("tensor_refills").insert({
      id: refillId,
      account_id: account.id,
      plan_code: plan.code,
      reference,
      expected_amount_minor: amountMinor,
      currency,
      credit_microusd: credit,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    if (insertError) throw new Error("Could not create the refill record.");

    const name = (session.user.user_metadata?.full_name as string | undefined) || session.user.email.split("@")[0];
    const checkout = await createCheckoutSession({
      success_url: `${returnUrl}?billing_return=refill`,
      cancel_url: `${returnUrl}?billing_cancelled=1`,
      reference,
      expires_in_minutes: 30,
      pricing: { currency, price_type: "fixed", amount: (amountMinor / 100).toFixed(2) },
      billing_currency: currency,
      customer: { email: session.user.email, name },
      metadata: {
        purchase_type: "tensor_refill",
        refill_id: refillId,
        account_id: account.id,
        user_id: session.user.id,
        plan_code: plan.code,
      },
    });
    const { error: updateError } = await session.admin
      .from("tensor_refills")
      .update({ provider_checkout_id: checkout.checkout_id })
      .eq("id", refillId);
    if (updateError) throw new Error("Could not save the provider checkout.");

    return NextResponse.json(
      { refillId, checkoutUrl: checkout.checkout_url, amountMinor, currency },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("[Tensor Billing] Refill checkout failed", error);
    await session.admin.from("tensor_refills").update({ status: "failed" }).eq("id", refillId).eq("status", "pending");
    return NextResponse.json(
      { error: "Checkout is temporarily unavailable. Please try again." },
      { headers: noStoreHeaders(), status: 502 },
    );
  }
}
