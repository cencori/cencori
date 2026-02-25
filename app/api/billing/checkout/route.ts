import { NextRequest, NextResponse } from 'next/server';
import { polarClient, getProductId } from '@/lib/polarClient';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';

type CheckoutTier = 'pro' | 'team';
type CheckoutCycle = 'monthly' | 'annual';

type CheckoutRequestBody = {
  tier?: CheckoutTier;
  cycle?: CheckoutCycle;
  orgId?: string;
  embedOrigin?: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tier, cycle, orgId, embedOrigin } = await req.json() as CheckoutRequestBody;

    if (!tier || !cycle || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: tier, cycle, orgId' },
        { status: 400 }
      );
    }

    if (tier !== 'pro' && tier !== 'team') {
      return NextResponse.json(
        { error: 'Invalid tier. Must be "pro" or "team"' },
        { status: 400 }
      );
    }

    if (cycle !== 'monthly' && cycle !== 'annual') {
      return NextResponse.json(
        { error: 'Invalid cycle. Must be "monthly" or "annual"' },
        { status: 400 }
      );
    }

    const productId = getProductId(tier, cycle);
    console.log('[Checkout API] Product ID:', productId);

    const supabaseAdmin = createAdminClient();
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug, name, owner_id')
      .eq('id', orgId)
      .maybeSingle();

    if (orgError || !org) {
      console.error('[Checkout API] Org fetch error:', orgError);
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    let hasOrgAccess = org.owner_id === user.id;
    if (!hasOrgAccess) {
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', org.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipError) {
        console.error('[Checkout API] Membership check failed:', membershipError);
        return NextResponse.json(
          { error: 'Failed to verify organization access' },
          { status: 500 }
        );
      }

      hasOrgAccess = !!membership;
    }

    if (!hasOrgAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('[Checkout API] Creating checkout for org:', org.slug);
    const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || req.nextUrl.origin).replace(/\/$/, '');

    const checkoutOptions: Parameters<typeof polarClient.checkouts.create>[0] = {
      products: [productId],
      successUrl: `${appBaseUrl}/dashboard/organizations/${org.slug}/billing?success=true`,
      metadata: {
        org_id: org.id,
        org_slug: org.slug,
      },
    };

    if (typeof embedOrigin === 'string' && embedOrigin.trim().length > 0) {
      checkoutOptions.embedOrigin = embedOrigin.trim();
    }

    const checkout = await polarClient.checkouts.create(checkoutOptions);

    console.log('[Checkout API] Checkout created:', checkout.id);
    console.log('[Checkout API] Checkout URL:', checkout.url);

    if (!checkout.url) {
      throw new Error('Polar did not return a checkout URL');
    }

    return NextResponse.json({
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    });

  } catch (error: unknown) {
    console.error('[Checkout API] Error creating checkout:', error);

    let errorMessage = 'Unknown error';
    let errorStack = undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    }

    console.error('[Checkout API] Error details:', errorMessage, errorStack);

    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
