import { NextRequest, NextResponse } from "next/server";
import { createPortalSession } from "@/lib/bachsClient";
import {
  authenticateTensorBillingRequest,
  getOrCreateTensorBillingAccount,
} from "@/lib/tensor-billing";
import { noStoreHeaders } from "@/lib/tensor-auth";

/**
 * Where the customer cancels, changes their card or reads their invoices: Bachs's own portal.
 *
 * Cancelling is done there rather than here so that what the customer sees and what Bachs does
 * are the same thing; the subscription's webhook then records it, and the plan runs to the end of
 * the month already paid for. An account with no card subscription has nothing to cancel: a naira
 * month simply ends unless it is paid for again.
 */
export async function POST(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "Your Cencori session is invalid." },
      { headers: noStoreHeaders(), status: 401 },
    );
  }
  try {
    const account = await getOrCreateTensorBillingAccount(session.admin, session.user.id);
    const { data: subscription, error } = await session.admin
      .from("basecode_subscriptions")
      .select("status")
      .eq("account_id", account.id)
      .maybeSingle();
    if (error) throw new Error("Could not load the Tensor subscription.");
    if (!subscription || !account.provider_customer_id) {
      return NextResponse.json(
        { error: "No auto-renewing subscription was found." },
        { headers: noStoreHeaders(), status: 404 },
      );
    }
    const portal = await createPortalSession(account.provider_customer_id);
    return NextResponse.json({ manageUrl: portal.url }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[Tensor Billing] Portal session failed", error);
    return NextResponse.json(
      { error: "Subscription management is temporarily unavailable. Please try again." },
      { headers: noStoreHeaders(), status: 502 },
    );
  }
}
