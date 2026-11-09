import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import {
  verifyBachsWebhook,
  getCharge,
  getProductTypeFromId,
  getSubscriptionTierFromProductId,
  getBillingInterval,
  getCreditTopupCreditsByProductId,
  getCreditTopupPackConfig,
  getTensorPlanByProductId,
  getBusinessPlanByProductId,
  netCreditsAfterFee,
  computePeriodEnd,
  type BachsCollectionData,
  type BachsInvoiceData,
  type BachsSubscriptionData,
  type BachsWebhookEvent,
} from '@/lib/bachsClient';
import { verifySubscriptionCharge } from '@/lib/billing/bachs-plans';
import {
  applyVerifiedTensorPayment,
  majorAmountToMinor,
} from '@/lib/tensor-billing';
import { applyPaidCreditTopup } from '@/lib/billing/paid-credit-topups';
import { bachsPaymentRow, recordPaymentSafely } from '@/lib/billing/payments-ledger';
import { getBachsTopupVerificationFailure, verifyBachsNgnTopupCharge } from '@/lib/billing/verify-paid-topups';
import { CARD_TOPUP_FEE_PERCENT, CREDIT_NGN_PER_USD, ngnTopupCredits } from '@/lib/billing/credit-pricing';
import {
  NAIRA_PLAN_PASS_PURCHASE_TYPE,
  canBuyNairaPass,
  nairaPassPeriod,
  verifyNairaPassCharge,
} from '@/lib/billing/naira-plan-pass';
import {
  buildOrganizationSubscriptionUpdate,
  type SubscriptionLifecycleEventType,
} from '@/lib/billing/subscription-reconciliation';

export const runtime = 'nodejs';

async function handleNgnCreditsTopup(
  data: BachsCollectionData,
  supabase: ReturnType<typeof createAdminClient>
) {
  // The signed event anchors the org, as for packs.
  const orgId = data.metadata?.org_id;
  if (!orgId) throw new Error('Bachs naira top-up has no organization ID');
  if (!data.charge_id) throw new Error('Bachs naira top-up has no charge ID');

  // Prove the payment with Bachs directly and credit what was actually paid.
  const charge = await getCharge(data.charge_id);
  const verified = verifyBachsNgnTopupCharge({ charge, chargeId: data.charge_id, organizationId: orgId });
  if (!verified.ok) {
    console.error('[Bachs Webhook] Naira top-up charge failed verification', {
      charge_id: data.charge_id,
      reason: verified.reason,
      status: charge?.status ?? null,
      currency: charge?.currency ?? null,
      amount: charge?.amount ?? null,
      requestedNgn: data.metadata?.amount_ngn ?? null,
    });
    throw new Error(`Bachs naira top-up charge did not verify: ${verified.reason}`);
  }

  const requestedNgn = Number(data.metadata?.amount_ngn);
  if (Number.isFinite(requestedNgn) && requestedNgn !== verified.amountNgn) {
    // Not fatal: credit follows the money. Logged so a mismatch is visible.
    console.warn('[Bachs Webhook] Naira top-up paid amount differs from requested', {
      charge_id: data.charge_id,
      requestedNgn,
      paidNgn: verified.amountNgn,
    });
  }

  await applyPaidCreditTopup({
    supabase,
    provider: 'bachs',
    paymentReference: data.charge_id,
    organizationId: orgId,
    amountUsd: ngnTopupCredits(verified.amountNgn),
    metadata: {
      purchase_type: 'credits_topup_ngn',
      charged_ngn: verified.amountNgn,
      ngn_per_usd: CREDIT_NGN_PER_USD,
      fee_percent: CARD_TOPUP_FEE_PERCENT,
    },
  });

  if (data.customer?.id) {
    await supabase
      .from('organizations')
      .update({ bachs_customer_id: data.customer.id })
      .eq('id', orgId);
  }
}

/**
 * Pro paid in naira. Only the charge fetched back from Bachs grants it, and
 * one charge grants it once. See lib/billing/naira-plan-pass.ts.
 */
async function handleNairaPlanPass(
  data: BachsCollectionData,
  supabase: ReturnType<typeof createAdminClient>
) {
  const orgId = data.metadata?.org_id;
  if (!orgId) throw new Error('Bachs naira Pro has no organization ID');
  if (!data.charge_id) throw new Error('Bachs naira Pro has no charge ID');

  const { data: applied, error: appliedError } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('charge_id', data.charge_id)
    .eq('event_type', 'collection.succeeded')
    .limit(1)
    .maybeSingle();
  if (appliedError) throw appliedError;
  if (applied) return;

  const charge = await getCharge(data.charge_id);
  const verified = verifyNairaPassCharge({
    charge,
    chargeId: data.charge_id,
    organizationId: orgId,
    metadata: data.metadata,
  });
  if (!verified.ok) {
    console.error('[Bachs Webhook] Naira Pro charge failed verification', {
      charge_id: data.charge_id,
      reason: verified.reason,
      status: charge?.status ?? null,
      currency: charge?.currency ?? null,
      amount: charge?.amount ?? null,
    });
    throw new Error(`Bachs naira Pro charge did not verify: ${verified.reason}`);
  }

  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('id, account_type, subscription_tier, subscription_status, subscription_current_period_end, subscription_id, billing_provider')
    .eq('id', orgId)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!organization) throw new Error(`Bachs naira Pro: organization ${orgId} not found`);

  if (organization.account_type === 'business' || !canBuyNairaPass(organization)) {
    // Paid, but the org is a business org or already has a card
    // subscription (the checkout route refuses both, so it means a race).
    // Don't overwrite its plan; the payment is in the ledger for a refund.
    console.error('[Bachs Webhook] Naira Pro paid by an org that cannot take it; refund needed', {
      charge_id: data.charge_id,
      org_id: orgId,
      tier: organization.subscription_tier,
      billing_provider: organization.billing_provider,
    });
    return;
  }

  const period = nairaPassPeriod(organization, verified.interval);
  const { error } = await supabase
    .from('organizations')
    .update({
      billing_provider: 'bachs',
      subscription_tier: verified.tier,
      subscription_status: 'active',
      subscription_current_period_start: period.start,
      subscription_current_period_end: period.end,
      // A prepaid pass, not a subscription: no subscription id. That's how
      // naira Pro is told apart from a card subscription on Bachs.
      subscription_id: null,
      ...(data.customer?.id ? { bachs_customer_id: data.customer.id } : {}),
    })
    .eq('id', orgId);
  if (error) throw new Error(`Could not apply naira Pro: ${error.message}`);
}

async function handleCollectionSucceeded(
  data: BachsCollectionData,
  supabase: ReturnType<typeof createAdminClient>
) {
  // Naira top-up of any amount: a product-less checkout, so no cart.
  if (data.metadata?.purchase_type === 'credits_topup_ngn') {
    await handleNgnCreditsTopup(data, supabase);
    return;
  }

  // Pro paid in naira (a prepaid month or year): product-less too.
  if (data.metadata?.purchase_type === NAIRA_PLAN_PASS_PURCHASE_TYPE) {
    await handleNairaPlanPass(data, supabase);
    return;
  }

  const productId = data.product_cart?.[0]?.product_id;
  if (!productId) {
    if (data.metadata?.purchase_type === 'credits_topup') {
      throw new Error('Bachs credits top-up has no product ID');
    }
    console.warn('[Bachs Webhook] No product_id in product_cart', data.charge_id);
    return;
  }

  const productType =
    data.metadata?.purchase_type || getProductTypeFromId(productId);

  switch (productType) {
    case 'subscription': {
      let orgId: string | undefined = data.metadata?.org_id;

      if (!orgId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('bachs_customer_id', data.customer.id)
          .maybeSingle();
        if (!org) {
          console.warn(
            '[Bachs Webhook] Could not resolve org for subscription',
            data.charge_id
          );
          return;
        }
        orgId = org.id;
      }

      const tier = getSubscriptionTierFromProductId(productId);
      const interval = getBillingInterval(productId);
      if (tier !== 'pro' || !interval) {
        console.warn('[Bachs Webhook] Unknown subscription product', productId);
        return;
      }
      if (!data.charge_id) throw new Error('Bachs subscription payment has no charge ID');

      // Only the charge fetched back from Bachs grants the plan, and one
      // charge grants it once.
      const { data: applied, error: appliedError } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('charge_id', data.charge_id)
        .eq('event_type', 'collection.succeeded')
        .limit(1)
        .maybeSingle();
      if (appliedError) throw appliedError;
      if (applied) return;

      const charge = await getCharge(data.charge_id);
      const verified = verifySubscriptionCharge({ charge, chargeId: data.charge_id, tier, interval });
      if (!verified.ok) {
        console.error('[Bachs Webhook] Subscription charge failed verification', {
          charge_id: data.charge_id,
          reason: verified.reason,
          status: charge?.status ?? null,
          currency: charge?.currency ?? null,
          amount: charge?.amount ?? null,
        });
        throw new Error(`Bachs subscription charge did not verify: ${verified.reason}`);
      }

      // The subscription's own dates arrive with customer.subscription.*
      // and invoice.paid; until then, one interval from now.
      const now = new Date();
      const { error } = await supabase
        .from('organizations')
        .update({
          billing_provider: 'bachs',
          subscription_tier: tier,
          subscription_status: 'active',
          subscription_current_period_start: now.toISOString(),
          subscription_current_period_end: computePeriodEnd(interval, now).toISOString(),
          ...(data.customer?.id ? { bachs_customer_id: data.customer.id } : {}),
        })
        .eq('id', orgId);

      if (error) throw new Error(`Could not apply the subscription: ${error.message}`);
      break;
    }

    case 'business_pass': {
      // A 30-day business plan, paid in naira. Only the independently fetched
      // charge grants it, and one charge grants it once.
      const orgId = data.metadata?.org_id;
      const plan = getBusinessPlanByProductId(productId);
      if (!orgId || !plan) throw new Error('Bachs business pass has no organization or plan');
      if (!data.charge_id) throw new Error('Bachs business pass has no charge ID');
      const { BUSINESS_PLANS, applyBusinessPass } = await import('@/lib/business/plans');
      const charge = await getCharge(data.charge_id);
      const paidNgn = Number(charge?.amount ?? 0);
      const verified = ['succeeded', 'successful', 'paid'].includes(charge?.status)
        && charge.currency === 'NGN'
        && paidNgn >= BUSINESS_PLANS[plan].priceNgn
        && charge.metadata?.org_id === orgId
        && Array.isArray(charge.product_cart) && charge.product_cart.some((item) => item?.product_id === productId);
      if (!verified) {
        console.error('[Bachs Webhook] Business pass charge failed verification', { charge_id: data.charge_id, status: charge?.status ?? null, currency: charge?.currency ?? null, amount: charge?.amount ?? null });
        throw new Error('Bachs business pass charge did not verify');
      }
      const { data: applied, error: appliedError } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('charge_id', data.charge_id)
        .eq('event_type', 'collection.succeeded')
        .limit(1)
        .maybeSingle();
      if (appliedError) throw appliedError;
      if (applied) return;
      await applyBusinessPass(supabase as never, orgId, plan);
      await supabase.from('organizations').update({ bachs_customer_id: data.customer.id }).eq('id', orgId);
      break;
    }

    case 'credits_topup': {
      const orgId = data.metadata?.org_id;
      if (!orgId) {
        throw new Error('Bachs credits top-up has no organization ID');
      }

      const grossCredits = getCreditTopupCreditsByProductId(productId);
      if (!grossCredits) {
        throw new Error(`Bachs credits top-up has unknown product ${productId}`);
      }

      if (!data.charge_id) {
        throw new Error('Bachs credits top-up has no charge ID');
      }

      const pack = getCreditTopupPackConfig(productId);
      const charge = await getCharge(data.charge_id);
      const verificationFailure = !pack
        ? 'unknown_pack'
        : getBachsTopupVerificationFailure({
          charge,
          chargeId: data.charge_id,
          organizationId: orgId,
          productId,
          minimumAmountMinor: pack.price,
          minimumNgnAmountMinor: pack.ngnPrice,
        });
      if (verificationFailure) {
        console.error('[Bachs Webhook] Credits top-up charge failed verification', {
          charge_id: data.charge_id,
          reason: verificationFailure,
          status: charge?.status ?? null,
          currency: charge?.currency ?? null,
          amount: charge?.amount ?? null,
          minimumAmountMinor: pack?.price ?? null,
          minimumNgnAmountMinor: pack?.ngnPrice ?? null,
          metadataPurchaseTypeEcho: charge?.metadata?.purchase_type ?? null,
          metadataOrgEchoMatches: charge?.metadata?.org_id === orgId,
          chargeProductIds: Array.isArray(charge?.product_cart)
            ? charge.product_cart.map((item) => item?.product_id ?? null)
            : null,
          eventProductId: productId,
        });
        throw new Error(
          `Bachs credits top-up charge did not verify: ${verificationFailure}`
        );
      }

      // The new grant ledger starts empty at rollout. Do not mint a second,
      // smaller grant if an old webhook for this charge is delivered again.
      const { data: legacyEvent, error: legacyEventError } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('charge_id', data.charge_id)
        .eq('event_type', 'collection.succeeded')
        .limit(1)
        .maybeSingle();
      if (legacyEventError) throw legacyEventError;
      if (legacyEvent) return;

      await applyPaidCreditTopup({
        supabase,
        provider: 'bachs',
        paymentReference: data.charge_id,
        organizationId: orgId,
        amountUsd: netCreditsAfterFee(grossCredits),
        // charged_usd is the card total with Bachs's fee; invoices show it.
        metadata: {
          product_id: productId,
          gross_credits_usd: grossCredits,
          ...(charge.currency === 'USD' ? { charged_usd: Number(charge.amount) } : {}),
          ...(charge.currency === 'NGN' ? { charged_ngn: Number(charge.amount) } : {}),
        },
      });

      await supabase
        .from('organizations')
        .update({ bachs_customer_id: data.customer.id })
        .eq('id', orgId);
      break;
    }

    case 'scan_subscription': {
      // Deprecated: standalone Scan is removed from the product offering.
      // No new grants. Existing rows are left untouched (grandfathered read
      // path removed in lib/scan/entitlements.ts); cancel/refund via dashboard.
      console.warn('[Bachs Webhook] Ignoring deprecated scan_subscription event', {
        charge_id: data.charge_id,
        product_id: productId,
      });
      break;
    }

    case 'basecode_subscription':
    case 'basecode_prepaid': {
      if (!data.charge_id) {
        throw new Error('Bachs Tensor collection is missing a charge ID');
      }
      const planCode = getTensorPlanByProductId(productId);
      if (!planCode) {
        throw new Error(`Unknown Bachs Tensor product: ${productId}`);
      }

      // The signed webhook starts the workflow; the independently retrieved
      // charge is the only object allowed to grant value.
      const charge = await getCharge(data.charge_id);
      const amountMinor = majorAmountToMinor(charge.amount);
      if (
        !['succeeded', 'successful', 'paid'].includes(charge.status) ||
        !charge.reference ||
        (charge.currency !== 'USD' && charge.currency !== 'NGN') ||
        !amountMinor
      ) {
        throw new Error('Bachs Tensor charge did not verify');
      }

      // The checkout row decides which pass this buys; the product only has to agree with it.
      await applyVerifiedTensorPayment(supabase, {
        provider: 'bachs',
        providerTransactionId: charge.charge_id,
        reference: charge.reference,
        amountMinor,
        // Naira or dollars, whichever the customer chose on Bachs's checkout.
        currency: charge.currency === 'NGN' ? 'NGN' : 'USD',
        paymentMethod: charge.payment_method,
        paidAt: charge.created_at,
        providerPayload: charge as unknown as Record<string, unknown>,
        planCode,
      });
      break;
    }

    default:
      console.warn('[Bachs Webhook] Unhandled purchase type', {
        productType,
        productId,
      });
  }
}

/**
 * Add a succeeded collection to the revenue ledger (public.payments). Reads
 * the charge back from Bachs so the amount is what was actually paid. Never
 * throws: the purchase has been granted by now.
 */
async function recordCollectionPayment(
  data: BachsCollectionData,
  supabase: ReturnType<typeof createAdminClient>
) {
  if (!data.charge_id) return;
  try {
    const charge = await getCharge(data.charge_id);
    const row = bachsPaymentRow(charge);
    if (row && !row.organization_id && data.customer?.id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('bachs_customer_id', data.customer.id)
        .maybeSingle();
      row.organization_id = org?.id ?? null;
    }
    await recordPaymentSafely(supabase, row, 'Bachs webhook');
  } catch (error) {
    console.error('[Bachs Webhook] Could not record payment', { charge_id: data.charge_id, error });
  }
}

async function handleCollectionFailed(data: BachsCollectionData) {
  // A failed one-off charge (a declined top-up, an abandoned checkout) says
  // nothing about the plan, so it never marks the org past due. Failed
  // renewals arrive as invoice.payment_failed.
  console.warn('[Bachs Webhook] Collection failed', {
    charge_id: data.charge_id,
    customer_id: data.customer?.id ?? null,
    purchase_type: data.metadata?.purchase_type ?? null,
    reason: data.reason ?? null,
  });
}

type AdminClient = ReturnType<typeof createAdminClient>;

type SubscriptionOrg = {
  id: string;
  subscription_id: string | null;
  billing_provider: string | null;
};

async function findSubscriptionOrg(
  supabase: AdminClient,
  ids: { orgId?: string | null; subscriptionId?: string | null; customerId?: string | null },
): Promise<SubscriptionOrg | null> {
  const columns = 'id, subscription_id, billing_provider';
  const lookups: Array<[string, string | null | undefined]> = [
    ['subscription_id', ids.subscriptionId],
    ['id', ids.orgId],
    ['bachs_customer_id', ids.customerId],
  ];
  for (const [column, value] of lookups) {
    if (!value) continue;
    const { data, error } = await supabase
      .from('organizations')
      .select(columns)
      .eq(column, value)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as SubscriptionOrg;
  }
  return null;
}

async function handleSubscriptionLifecycle(
  data: BachsSubscriptionData,
  eventType: SubscriptionLifecycleEventType,
  supabase: AdminClient
) {
  // Standalone Scan is retired: its product ids resolve to null and are ignored.
  if (getProductTypeFromId(data.product_id) !== 'subscription') return;

  const org = await findSubscriptionOrg(supabase, {
    subscriptionId: data.subscription_id,
    orgId: data.metadata?.org_id,
    customerId: data.customer?.customer_id,
  });
  if (!org) {
    // Thrown so Bachs retries: the org may be found once its customer id is saved.
    throw new Error(`Bachs ${eventType}: no organization for subscription ${data.subscription_id}`);
  }

  // An update or cancellation of a subscription the org has since replaced
  // must not touch the current one (e.g. the old one ending after a re-subscribe).
  if (
    eventType !== 'customer.subscription.created'
    && org.billing_provider === 'bachs'
    && org.subscription_id
    && org.subscription_id !== data.subscription_id
  ) {
    console.warn('[Bachs Webhook] Ignoring event for a replaced subscription', {
      orgId: org.id,
      current: org.subscription_id,
      event: data.subscription_id,
      eventType,
    });
    return;
  }

  const tier = getSubscriptionTierFromProductId(data.product_id);
  const update = buildOrganizationSubscriptionUpdate(data, eventType, tier);
  if (!update) {
    console.warn('[Bachs Webhook] Unknown subscription product', data.product_id);
    return;
  }

  const { error } = await supabase.from('organizations').update(update).eq('id', org.id);
  if (error) throw new Error(`Could not reconcile the subscription: ${error.message}`);
}

/**
 * Renewals: Bachs bills each new period as an invoice. invoice.paid moves the
 * paid period forward and records the payment; invoice.payment_failed marks
 * the org past due (plan-state then gives 7 days of grace from the end of
 * the last paid period).
 */
async function handleSubscriptionInvoice(
  data: BachsInvoiceData,
  eventType: 'invoice.paid' | 'invoice.payment_failed',
  supabase: AdminClient
) {
  const subscriptionId = data.subscription?.subscription_id;
  if (!subscriptionId) return; // Not a subscription invoice.

  const org = await findSubscriptionOrg(supabase, { subscriptionId });
  if (!org) {
    // The first invoice can arrive before customer.subscription.created has
    // saved the subscription id; Bachs retries.
    throw new Error(`Bachs ${eventType}: no organization for subscription ${subscriptionId}`);
  }

  if (eventType === 'invoice.payment_failed') {
    const { error } = await supabase
      .from('organizations')
      .update({ subscription_status: 'past_due' })
      .eq('id', org.id);
    if (error) throw new Error(`Could not mark the subscription past due: ${error.message}`);
    return;
  }

  const update: Record<string, string> = { subscription_status: 'active' };
  if (data.period_start) update.subscription_current_period_start = data.period_start;
  if (data.period_end) update.subscription_current_period_end = data.period_end;
  const { error } = await supabase.from('organizations').update(update).eq('id', org.id);
  if (error) throw new Error(`Could not apply the renewal: ${error.message}`);

  if (data.charge) {
    try {
      const row = bachsPaymentRow(await getCharge(data.charge));
      if (row) {
        row.organization_id = row.organization_id ?? org.id;
        if (row.product_type === 'other') row.product_type = 'subscription';
      }
      await recordPaymentSafely(supabase, row, 'Bachs invoice.paid');
    } catch (recordError) {
      console.error('[Bachs Webhook] Could not record renewal payment', { charge: data.charge, recordError });
    }
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let event: BachsWebhookEvent;
  try {
    event = verifyBachsWebhook(
      rawBody,
      req.headers.get('X-Bachs-Timestamp') || '',
      req.headers.get('X-Bachs-Signature') || ''
    );
  } catch (err) {
    console.error('[Bachs Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case 'collection.succeeded':
        await handleCollectionSucceeded(event.data, supabase);
        await recordCollectionPayment(event.data, supabase);
        break;
      case 'collection.failed':
        await handleCollectionFailed(event.data);
        break;
      case 'collection.abandoned':
      case 'collection.underpaid':
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionLifecycle(event.data, event.type, supabase);
        break;
      case 'invoice.paid':
      case 'invoice.payment_failed':
        await handleSubscriptionInvoice(event.data, event.type, supabase);
        break;
      case 'invoice.created':
        break;
    }

    const chargeId = 'charge_id' in event.data ? event.data.charge_id : null;
    const checkoutId = 'checkout_id' in event.data ? event.data.checkout_id : null;

    await supabase.from('webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      charge_id: chargeId,
      checkout_id: checkoutId,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Bachs Webhook] Processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
