import { NextRequest, NextResponse } from "next/server";
import {
  authenticateBasecodeBillingRequest,
  getOrCreateBasecodeBillingAccount,
} from "@/lib/basecode-billing";
import { noStoreHeaders } from "@/lib/basecode-auth";

/** The account's current auto-renew state, for the plans page manage section. */
export async function GET(request: NextRequest) {
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
      .select("plan_code, provider, status, auto_renews, current_period_end, cancel_at_period_end")
      .eq("account_id", account.id)
      .in("status", ["active", "past_due", "paused"])
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json(
      {
        subscription: subscription
          ? {
              planCode: subscription.plan_code,
              provider: subscription.provider,
              status: subscription.status,
              autoRenews: subscription.auto_renews,
              currentPeriodEnd: subscription.current_period_end,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            }
          : null,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("[Basecode Billing] Subscription status failed", error);
    return NextResponse.json(
      { error: "Subscription status is temporarily unavailable." },
      { headers: noStoreHeaders(), status: 502 },
    );
  }
}
