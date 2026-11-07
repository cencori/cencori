import { getAuthUser } from "@/lib/auth/get-auth-user";
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import {
  createCheckoutSession,
  CREDIT_TOPUP_PACKS,
} from '@/lib/bachsClient';
import { resolvePublicOrigin } from '@/lib/public-origin';
import { NGN_TOPUP_MAX, NGN_TOPUP_MIN, parseNgnTopupAmount } from '@/lib/billing/credit-pricing';
import { resolveConsoleBaseUrl } from '@/lib/auth-redirect';

const PACK_TO_ID: Record<string, string> = {
  starter: CREDIT_TOPUP_PACKS[0].productId,
  growth: CREDIT_TOPUP_PACKS[1].productId,
  scale: CREDIT_TOPUP_PACKS[2].productId,
};

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await getAuthUser(supabase);
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orgId = body.orgId;

  // Two ways to buy: any naira amount (`amountNgn`, a product-less Bachs
  // checkout for exactly that amount), or a fixed dollar pack.
  const isNairaTopup = body.amountNgn !== undefined && body.amountNgn !== null;
  const amountNgn = isNairaTopup ? parseNgnTopupAmount(body.amountNgn) : null;
  const productId = isNairaTopup ? null : body.productId || PACK_TO_ID[body.pack];

  if (!orgId) {
    return NextResponse.json({ error: 'Missing organization' }, { status: 400 });
  }
  if (isNairaTopup && amountNgn === null) {
    return NextResponse.json(
      {
        error: `Enter a whole naira amount from ₦${NGN_TOPUP_MIN.toLocaleString('en-NG')} to ₦${NGN_TOPUP_MAX.toLocaleString('en-NG')}`,
      },
      { status: 400 }
    );
  }
  if (!isNairaTopup && (!productId || !Object.values(PACK_TO_ID).includes(productId))) {
    return NextResponse.json(
      { error: 'Select a configured credit pack' },
      { status: 400 }
    );
  }

  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError) {
    console.error('[Credits Checkout] Membership check error:', memberError);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError || !organization?.slug) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const successUrl = new URL(`/${organization.slug}/~/billing`, resolveConsoleBaseUrl(resolvePublicOrigin(req)));
  const cancelUrl = new URL(successUrl);
  cancelUrl.searchParams.set('checkout', 'cancelled');

  try {
    const session = await createCheckoutSession({
      ...(amountNgn !== null
        ? {
          // The webhook credits from the amount Bachs reports as paid, never
          // from this request, so the client can't inflate the grant.
          pricing: { currency: 'NGN', price_type: 'fixed' as const, amount: `${amountNgn}.00` },
          billing_currency: 'NGN',
        }
        : {
          product_cart: [{ product_id: productId!, quantity: 1 }],
          // Packs are sold in dollars only. Naira buyers use amountNgn above,
          // so a pack's NGN price on Bachs never has to match ours.
          billing_currency: 'USD',
        }),
      customer: {
        email: user.email,
        name: user.user_metadata?.full_name || user.email.split('@')[0] || 'Customer',
      },
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      metadata: amountNgn !== null
        ? { org_id: orgId, purchase_type: 'credits_topup_ngn', amount_ngn: String(amountNgn) }
        : { org_id: orgId, purchase_type: 'credits_topup' },
    });

    return NextResponse.json({ checkoutUrl: session.checkout_url });
  } catch (err) {
    console.error('[Credits Checkout] Bachs API error:', err);
    return NextResponse.json(
      { error: "Couldn't open checkout. Try again in a moment." },
      { status: 502 }
    );
  }
}
