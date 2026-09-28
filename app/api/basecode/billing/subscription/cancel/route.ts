import { NextRequest, NextResponse } from "next/server";
import {
  authenticateBasecodeBillingRequest,
  getOrCreateBasecodeBillingAccount,
} from "@/lib/basecode-billing";
import { disablePaystackSubscription } from "@/lib/paystackClient";
import { noStoreHeaders } from "@/lib/basecode-auth";

/**
 * Opts out of auto-renew. Paystack stops future charges; the current 30-day
 * period runs to its end and the plan itself is untouched.
 */
export async function POST(request: NextRequest) {
  const session = await authenticateBasecodeBillingRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "Your Cencori session is invalid." },
      { headers: noStoreHeaders(), status: 401 },
    );
  }
  try {
    const account = await getOrCreateBasecodeBillingAccount(session.admin, session.user.id);
    const { data: subscription } = await session.admin
      .from("basecode_subscriptions")
      .select("id, provider, provider_subscription_id, provider_subscription_token, auto_renews")
      .eq("account_id", account.id)
      .eq("provider", "paystack")
      .eq("auto_renews", true)
      .in("status", ["active", "past_due", "paused"])
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!subscription?.provider_subscription_id || !subscription.provider_subscription_token) {
      return NextResponse.json(
        { error: "No auto-renewing subscription was found." },
        { headers: noStoreHeaders(), status: 404 },
      );
    }
    await disablePaystackSubscription(
      subscription.provider_subscription_id,
      subscription.provider_subscription_token,
    );
    await session.admin
      .from("basecode_subscriptions")
      .update({ auto_renews: false, cancel_at_period_end: true })
      .eq("id", subscription.id);
    return NextResponse.json({ cancelled: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[Basecode Billing] Subscription cancel failed", error);
    return NextResponse.json(
      { error: "Auto-renew could not be turned off. Please try again." },
      { headers: noStoreHeaders(), status: 502 },
    );
  }
}
