/**
 * POST /api/billing/checkout  { orgId, tier, interval }
 *
 * Pro by card, as a Bachs subscription in US dollars. Returns the Bachs
 * checkout URL, which the upgrade dialog opens in the Bachs overlay (or
 * redirects to). The webhook gives Pro when Bachs reports the subscription;
 * see app/api/billing/webhook/route.ts.
 */

import { getAuthUser } from "@/lib/auth/get-auth-user";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getCheckoutReturnUrls, parseCheckoutSelection } from "@/lib/billing/checkout-contract";
import { resolveConsoleBaseUrl } from "@/lib/auth-redirect";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { createCheckoutSession } from "@/lib/bachsClient";
import {
  canStartCardSubscription,
  ensureBachsCustomer,
  getVerifiedPlanProductId,
} from "@/lib/billing/bachs-plans";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await getAuthUser(supabase);
  if (userError || !user?.email) return fail("Unauthorized", 401);

  const body = (await req.json().catch(() => null)) as
    | { orgId?: unknown; tier?: unknown; interval?: unknown }
    | null;
  const orgId = typeof body?.orgId === "string" ? body.orgId : null;
  const selection = body ? parseCheckoutSelection(body) : null;
  if (!orgId || !selection) return fail("Choose a valid organization, plan, and billing interval");
  if (selection.tier !== "pro") return fail("Only Pro can be bought here. Contact sales for more.", 409);

  const admin = createAdminClient();
  const { data: organization, error: orgError } = await admin
    .from("organizations")
    .select(
      "id, slug, name, owner_id, billing_email, account_type, subscription_tier, subscription_status, subscription_id, subscription_current_period_end, billing_provider, bachs_customer_id",
    )
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
      console.error("[Checkout] Billing permission lookup failed:", membershipError);
      return fail("Could not verify billing permissions", 500);
    }
    canManageBilling = membership?.role === "owner" || membership?.role === "admin";
  }
  if (!canManageBilling) return fail("Only organization owners and admins can change the plan", 403);

  if (organization.account_type === "business") {
    return fail("Business organizations are billed on business plans", 409);
  }
  const eligible = canStartCardSubscription(organization);
  if (!eligible.ok) {
    return fail(
      eligible.reason === "naira_period_running"
        ? "This organization's naira Pro is still running. Renew it in naira from Billing, or subscribe by card after it ends."
        : eligible.reason === "not_self_serve"
          ? "This organization's plan is managed by Cencori. Contact support to change it."
          : "This organization already has a Pro subscription. Manage it from Billing.",
      409,
    );
  }

  let productId: string;
  try {
    productId = await getVerifiedPlanProductId(selection.tier, selection.interval);
  } catch (error) {
    // Never open a checkout for a product that doesn't match the plan.
    console.error("[Checkout] Plan product failed verification:", error);
    return fail("Checkout is temporarily unavailable. Please try again later.", 503);
  }

  try {
    const customerId = await ensureBachsCustomer(admin, organization, {
      email: user.email,
      name: user.user_metadata?.full_name || user.email.split("@")[0],
    });

    const reference = `sub_${orgId.replace(/-/g, "").slice(0, 16)}_${selection.interval}_${randomBytes(6).toString("hex")}`;
    const { successUrl, cancelUrl } = getCheckoutReturnUrls(
      resolveConsoleBaseUrl(resolvePublicOrigin(req)),
      organization.slug,
      reference,
    );

    const session = await createCheckoutSession({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { customer_id: customerId },
      success_url: successUrl,
      cancel_url: cancelUrl,
      reference,
      // Copied onto the subscription by Bachs; the webhook also finds the
      // org by customer id when it isn't.
      metadata: {
        org_id: organization.id,
        org_slug: organization.slug,
        tier: selection.tier,
        interval: selection.interval,
        purchase_type: "subscription",
      },
    });

    return NextResponse.json(
      { url: session.checkout_url, checkoutId: reference },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Checkout] Bachs checkout failed:", error);
    return fail("Checkout is temporarily unavailable. Please try again.", 502);
  }
}
