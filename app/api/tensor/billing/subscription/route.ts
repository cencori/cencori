import { NextRequest, NextResponse } from "next/server";
import {
  authenticateTensorBillingRequest,
  getOrCreateTensorBillingAccount,
  readTensorSubscription,
} from "@/lib/tensor-billing";
import { noStoreHeaders } from "@/lib/tensor-auth";

/**
 * The card subscription the account renews on, or null. A plan paid for in naira is one month at
 * a time and has none; the billing snapshot says when that month ends.
 */
export async function GET(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "Your Cencori session is invalid." },
      { headers: noStoreHeaders(), status: 401 },
    );
  }
  try {
    const account = await getOrCreateTensorBillingAccount(session.admin, session.user.id);
    const { data, error } = await session.admin
      .from("basecode_subscriptions")
      .select("plan_code, status, current_period_end, cancel_at_period_end, currency")
      .eq("account_id", account.id)
      .maybeSingle();
    if (error) throw new Error("Could not load the Tensor subscription.");
    const subscription = readTensorSubscription(data);
    return NextResponse.json(
      { subscription: subscription ? { ...subscription, plan: data?.plan_code ?? null } : null },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("[Tensor Billing] Subscription lookup failed", error);
    return NextResponse.json(
      { error: "Tensor billing is temporarily unavailable." },
      { headers: noStoreHeaders(), status: 503 },
    );
  }
}
