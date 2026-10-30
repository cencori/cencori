import { getAuthUser } from "@/lib/auth/get-auth-user";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAvailableUpgradePlans, isPaidPlanTier } from "@/lib/billing/plans";
import {
  buildStripeOrganizationSubscriptionUpdate,
  getExpandableId,
  toSubscriptionSnapshot,
} from "@/lib/billing/stripe-subscription-reconciliation";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import {
  getStripeBillingClient,
  getStripePlanFromPriceId,
  getStripePlanPriceId,
} from "@/lib/stripe-billing";

/**
 * Upgrading a paid Stripe plan (Pro → Team) in place. Checkout only starts new
 * subscriptions; a second one would bill twice, so an org that already pays
 * moves its existing subscription to the new price instead. The prorated
 * difference is invoiced and charged to the card on file right away, and the
 * billing interval stays what it was.
 *
 * POST { orgId, tier }                          → preview: amount due now + card
 * POST { orgId, tier, confirm: true, prorationDate } → upgrade
 *
 * The preview's prorationDate is passed back so the charge matches what the
 * customer was shown.
 */

type UpgradeRequestBody = {
  orgId?: unknown;
  tier?: unknown;
  confirm?: unknown;
  prorationDate?: unknown;
};

const UPGRADABLE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing"]);

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function cardOf(paymentMethod: string | Stripe.PaymentMethod | null | undefined) {
  if (!paymentMethod || typeof paymentMethod === "string" || !paymentMethod.card) return null;
  return { brand: paymentMethod.card.brand, last4: paymentMethod.card.last4 };
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await getAuthUser(supabase);
  if (!user?.email) return fail("Unauthorized", 401);

  const body = (await req.json().catch(() => null)) as UpgradeRequestBody | null;
  const orgId = typeof body?.orgId === "string" ? body.orgId : null;
  const tier = body?.tier;
  if (!orgId || !isPaidPlanTier(tier)) return fail("Choose an organization and plan", 400);
  const confirm = body?.confirm === true;
  const prorationDate =
    typeof body?.prorationDate === "number" && Number.isInteger(body.prorationDate)
      ? body.prorationDate
      : Math.floor(Date.now() / 1000);

  const admin = createAdminClient();
  const { data: organization } = await admin
    .from("organizations")
    .select("id, owner_id, subscription_tier, subscription_id, billing_provider, stripe_customer_id")
    .eq("id", orgId)
    .maybeSingle();
  if (!organization) return fail("Organization not found", 404);

  let canManageBilling = organization.owner_id === user.id;
  if (!canManageBilling) {
    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    canManageBilling = membership?.role === "owner" || membership?.role === "admin";
  }
  if (!canManageBilling) return fail("Only organization owners and admins can change the plan", 403);

  const currentTier =
    organization.subscription_tier === "pro" || organization.subscription_tier === "team"
      ? organization.subscription_tier
      : "free";
  if (currentTier === "free" || !getAvailableUpgradePlans(currentTier).includes(tier)) {
    return fail("This plan is not a valid upgrade for the organization", 409);
  }
  if (organization.billing_provider !== "stripe" || !organization.subscription_id) {
    return fail("This subscription can't be changed online. Contact support to switch plans.", 409);
  }

  const stripe = getStripeBillingClient();
  try {
    const subscription = await stripe.subscriptions.retrieve(organization.subscription_id, {
      expand: ["default_payment_method", "customer.invoice_settings.default_payment_method"],
    });
    if (!UPGRADABLE_STATUSES.has(subscription.status)) {
      return fail("Settle the outstanding payment on your current plan before upgrading.", 409);
    }

    const item = subscription.items.data[0];
    const current = item ? getStripePlanFromPriceId(item.price.id) : null;
    if (!item || !current) return fail("This subscription can't be changed online. Contact support to switch plans.", 409);
    const price = getStripePlanPriceId(tier, current.interval);
    const items = [{ id: item.id, price }];

    if (!confirm) {
      const preview = await stripe.invoices.createPreview({
        customer: getExpandableId(subscription.customer)!,
        subscription: subscription.id,
        subscription_details: {
          items,
          proration_behavior: "always_invoice",
          proration_date: prorationDate,
        },
      });
      const customer = typeof subscription.customer === "string" || subscription.customer.deleted
        ? null
        : subscription.customer;
      return NextResponse.json(
        {
          amountDue: preview.amount_due,
          currency: preview.currency,
          interval: current.interval,
          prorationDate,
          card: cardOf(subscription.default_payment_method) ?? cardOf(customer?.invoice_settings?.default_payment_method),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // error_if_incomplete: a declined card fails the request and leaves the
    // subscription on its current plan, instead of upgrading unpaid.
    const updated = await stripe.subscriptions.update(
      subscription.id,
      {
        items,
        proration_behavior: "always_invoice",
        proration_date: prorationDate,
        payment_behavior: "error_if_incomplete",
        metadata: { ...subscription.metadata, tier },
      },
      { idempotencyKey: `cencori-plan-upgrade-${subscription.id}-${tier}-${prorationDate}` },
    );

    // The webhook does the same; doing it now means the plan is on when the page reloads.
    const update = buildStripeOrganizationSubscriptionUpdate(toSubscriptionSnapshot(updated));
    if (update) {
      const { error } = await admin.from("organizations").update(update).eq("id", organization.id);
      if (error) console.error("[Plan upgrade] Org update failed; the webhook will retry:", error.message);
    }
    return NextResponse.json({ ok: true, tier }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeCardError) {
      return fail(error.message || "Your card was declined. Update it in Billing and try again.", 402);
    }
    console.error("[Plan upgrade] Stripe request failed:", error);
    return fail("The upgrade couldn't be completed. Try again in a moment; trying again won't charge you twice.", 502);
  }
}
