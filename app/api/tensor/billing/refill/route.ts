import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateTensorBillingRequest,
  effectiveTensorPlan,
  getOrCreateTensorBillingAccount,
  getTensorPlan,
  readAllowancePeriod,
  tensorCheckoutReturnUrl,
} from "@/lib/tensor-billing";
import { canRefill, refillPriceMinor, refillReference } from "@/lib/tensor-refills";
import { createCheckoutSession } from "@/lib/bachsClient";
import { noStoreHeaders } from "@/lib/tensor-auth";

/**
 * A Bachs checkout for a refill of this week's allowance: offered only to a paid plan whose week
 * is used up, at the refill's price for that plan (lib/tensor-refills.ts). The payment is applied
 * by the webhook (purchase_type "tensor_refill").
 */
export async function POST(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session || !session.user.email) {
    return NextResponse.json({ error: "Your Cencori session is invalid." }, { headers: noStoreHeaders(), status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { currency?: unknown; return_url?: unknown } | null;
  const currency = body?.currency === "USD" ? "USD" : "NGN";
  const returnUrl = tensorCheckoutReturnUrl(body?.return_url);
  if (!returnUrl) {
    return NextResponse.json({ error: "Open the refill from Tensor's billing page." }, { headers: noStoreHeaders(), status: 400 });
  }

  const refillId = randomUUID();
  try {
    const account = await getOrCreateTensorBillingAccount(session.admin, session.user.id);
    const plan = await getTensorPlan(session.admin, effectiveTensorPlan(account));
    const { data: allowanceRow, error: allowanceError } = await session.admin
      .rpc("basecode_allowance_period", { p_account_id: account.id })
      .single();
    const allowance = readAllowancePeriod(allowanceRow);
    if (allowanceError || !allowance) throw new Error("Could not load the Tensor allowance period.");
    if (!canRefill(plan.code, allowance)) {
      return NextResponse.json(
        { error: plan.code === "free" ? "Refills come with a plan. Choose one to keep going." : "This week still has usage left." },
        { headers: noStoreHeaders(), status: 409 },
      );
    }
    const price = refillPriceMinor(plan, currency);
    if (!price) throw new Error("The plan has no refill price in this currency.");

    const reference = refillReference(refillId);
    const { error: insertError } = await session.admin.from("tensor_refills").insert({
      id: refillId,
      account_id: account.id,
      plan_code: plan.code,
      reference,
      expected_amount_minor: price,
      currency,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    if (insertError) throw new Error("Could not create the refill record.");

    const name = (session.user.user_metadata?.full_name as string | undefined) || session.user.email.split("@")[0];
    const checkout = await createCheckoutSession({
      success_url: `${returnUrl}?billing_return=refill`,
      cancel_url: `${returnUrl}?billing_cancelled=1`,
      reference,
      expires_in_minutes: 30,
      pricing: { currency, price_type: "fixed", amount: (price / 100).toFixed(2) },
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
      { refillId, checkoutUrl: checkout.checkout_url, priceMinor: price, currency },
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
