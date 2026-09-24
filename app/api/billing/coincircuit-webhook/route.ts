import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { applyPaidCreditTopup } from '@/lib/billing/paid-credit-topups';
import { trackEvent } from '@/lib/track-event';
import { writeAuditLog } from '@/lib/audit-log';
import { verifyWebhookSignature, type CoinCircuitWebhookPayload } from '@/lib/coincircuit';
import { CREDIT_TOPUP_PACKS } from '@/lib/bachsClient';
import { CRYPTO_TOPUP_FEE_PERCENT, netTopupCredits } from '@/lib/billing/credit-pricing';
import { isVerifiedCryptoTopupSession } from '@/lib/billing/verify-paid-topups';

const PACK_CREDITS: Record<string, number> = Object.fromEntries(
  CREDIT_TOPUP_PACKS.map((p) => [p.label.toLowerCase(), p.credits])
);

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-coincircuit-signature')
      || req.headers.get('x-signature')
      || req.headers.get('authorization')
      || null;

    if (!process.env.COINCIRCUIT_WEBHOOK_SECRET) {
      console.error('[CoinCircuit Webhook] Missing COINCIRCUIT_WEBHOOK_SECRET env var');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const valid = verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      console.error('[CoinCircuit Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload: CoinCircuitWebhookPayload = JSON.parse(rawBody);
    console.log('[CoinCircuit Webhook] Received event:', payload.event);

    if (payload.event !== 'payment.completed') {
      console.log(`[CoinCircuit Webhook] Ignoring event: ${payload.event}`);
      return NextResponse.json({ received: true });
    }

    const session = payload.data.session;
    const metadata = session.metadata || {};

    if (metadata.purchase_type !== 'credits_topup') {
      console.log('[CoinCircuit Webhook] Payment for non-topup session, ignoring.');
      return NextResponse.json({ received: true });
    }

    const orgId = metadata.org_id;
    if (!orgId) {
      throw new Error('Crypto credits top-up has no organization ID');
    }

    const grossCredits = PACK_CREDITS[metadata.credit_pack as string];
    if (!grossCredits || grossCredits <= 0) {
      throw new Error(`Crypto credits top-up has unknown pack ${String(metadata.credit_pack)}`);
    }

    if (!isVerifiedCryptoTopupSession(session, grossCredits)) {
      throw new Error('Crypto credits top-up payment did not verify');
    }

    const netCredits = netTopupCredits(grossCredits, CRYPTO_TOPUP_FEE_PERCENT);
    const feeCredits = grossCredits - netCredits;

    if (!session.reference) {
      throw new Error('Crypto top-up has no payment reference');
    }

    // Older top-ups predate the atomic grant table but stored this reference
    // in transaction metadata. A retried old webhook must not mint again.
    const admin = createAdminClient();
    const { data: legacyGrant, error: legacyGrantError } = await admin
      .from('credit_transactions')
      .select('id')
      .eq('organization_id', orgId)
      .eq('transaction_type', 'topup')
      .contains('metadata', { coincircuit_reference: session.reference })
      .limit(1)
      .maybeSingle();
    if (legacyGrantError) throw legacyGrantError;
    if (legacyGrant) {
      return NextResponse.json({ received: true, already_applied: true });
    }

    const topup = await applyPaidCreditTopup({
      supabase: admin,
      provider: 'coincircuit',
      paymentReference: session.reference,
      organizationId: orgId,
      amountUsd: netCredits,
      metadata: {
        credit_pack: metadata.credit_pack,
        gross_credits_usd: grossCredits,
        fee_usd: feeCredits,
        fee_percent: CRYPTO_TOPUP_FEE_PERCENT,
      },
    });

    if (!topup.applied) {
      return NextResponse.json({ received: true, already_applied: true });
    }

    trackEvent({
      event_type: 'credits.topup',
      product: 'billing',
      organization_id: orgId,
      metadata: {
        provider: 'coincircuit',
        session_id: session.id,
        gross_credits: grossCredits,
        net_credits: netCredits,
        fee_credits: feeCredits,
      },
    });

    writeAuditLog({
      organizationId: orgId,
      category: 'billing',
      action: 'topup',
      resourceType: 'credits',
      resourceId: session.reference,
      actorType: 'webhook',
      description: `Crypto credits topped up: ${grossCredits.toLocaleString()} credits (${netCredits.toLocaleString()} after ${CRYPTO_TOPUP_FEE_PERCENT.toFixed(1)}% total fee)`,
      metadata: {
        provider: 'coincircuit',
        session_id: session.id,
        gross_credits: grossCredits,
        net_credits: netCredits,
        fee_credits: feeCredits,
      },
    });

    console.log(
      `[CoinCircuit Webhook] Credited org ${orgId} with ${netCredits.toLocaleString()} credits (gross: ${grossCredits.toLocaleString()}) from session ${session.reference}`
    );

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('[CoinCircuit Webhook] Error processing webhook:', error);

    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: 'Webhook processing failed', details: errorMessage },
      { status: 500 }
    );
  }
}
