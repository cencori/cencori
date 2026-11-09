/**
 * POST /api/billing/checkout/naira  { orgId, interval }
 *
 * Pro paid in naira: a Bachs checkout for exactly the plan's naira price
 * (₦20,000 a month, ₦200,000 a year), by card or bank transfer. The Bachs
 * webhook gives Pro once the charge verifies. See lib/billing/naira-plan-pass.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { resolveConsoleBaseUrl } from "@/lib/auth-redirect";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { createCheckoutSession } from "@/lib/bachsClient";
import { isPlanBillingInterval } from "@/lib/billing/plans";
import {
  NAIRA_PLAN_PASS_PURCHASE_TYPE,
  canBuyNairaPass,
  nairaPassPriceNgn,
} from "@/lib/billing/naira-plan-pass";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await getAuthUser(supabase);
  if (userError || !user?.email) return fail("Unauthorized", 401);

  const body = (await req.json().catch(() => null)) as { orgId?: unknown; interval?: unknown } | null;
  const orgId = typeof body?.orgId === "string" ? body.orgId : null;
  const interval = isPlanBillingInterval(body?.interval) ? body.interval : null;
  if (!orgId || !interval) return fail("Choose a valid organization and billing interval");

  const priceNgn = nairaPassPriceNgn("pro", interval);
  if (!priceNgn) return fail("Naira pricing isn't available for this plan", 409);

  const admin = createAdminClient();
  const { data: organization, error: orgError } = await admin
    .from("organizations")
    .select("id, slug, name, owner_id, billing_email, subscription_tier, subscription_status, subscription_current_period_end, billing_provider, account_type")
    .eq("id", orgId)
    .maybeSingle();
  if (orgError || !organization) return fail("Organization not found", 404);

  let canManageBilling = organization.owner_id === user.id;
  if (!canManageBilling) {
    const { data: membership, error: membershipError } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError) {
      console.error("[Naira Checkout] Billing permission lookup failed:", membershipError);
      return fail("Could not verify billing permissions", 500);
    }
    canManageBilling = membership?.role === "owner" || membership?.role === "admin";
  }
  if (!canManageBilling) return fail("Only organization owners and admins can change the plan", 403);

  if (organization.account_type === "business") {
    return fail("Business organizations are billed on business plans", 409);
  }
  if (!canBuyNairaPass(organization)) {
    return fail("This organization already pays for its plan by card. Manage it from Billing.", 409);
  }

  // The billing page reads checkout_id to show "activating" and poll until
  // the webhook has given Pro.
  const reference = `pro_${orgId.replace(/-/g, "").slice(0, 16)}_${interval}_${randomBytes(6).toString("hex")}`;
  const billingUrl = new URL(`/${organization.slug}/~/billing`, resolveConsoleBaseUrl(resolvePublicOrigin(req)));
  const successUrl = new URL(billingUrl);
  successUrl.searchParams.set("checkout_id", reference);
  const cancelUrl = new URL(billingUrl);
  cancelUrl.searchParams.set("checkout", "cancelled");

  try {
    const session = await createCheckoutSession({
      // The webhook checks the amount Bachs reports as paid against the
      // plan's price, never this request.
      pricing: { currency: "NGN", price_type: "fixed", amount: `${priceNgn}.00` },
      billing_currency: "NGN",
      customer: {
        email: (organization.billing_email as string | null) || user.email,
        name: (organization.name as string | null) || user.user_metadata?.full_name || user.email.split("@")[0],
      },
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      reference,
      metadata: {
        org_id: organization.id,
        purchase_type: NAIRA_PLAN_PASS_PURCHASE_TYPE,
        tier: "pro",
        interval,
        amount_ngn: String(priceNgn),
      },
    });
    return NextResponse.json(
      { url: session.checkout_url, checkoutId: reference },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Naira Checkout] Bachs checkout failed:", error);
    return fail("Couldn't open naira checkout. Try again in a moment.", 502);
  }
}
