import { NextRequest, NextResponse } from 'next/server';
import { polarClient, POLAR_CONFIG, getProductId } from '@/lib/polarClient';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { tier, cycle, orgId, embedOrigin } = await req.json();

    // Validate inputs
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

    // Get product ID for this tier/cycle
    const productId = getProductId(tier, cycle);
    console.log('[Checkout API] Product ID:', productId);

    // Get organization details
    const supabaseAdmin = createAdminClient();
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug, name, owner_id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      console.error('[Checkout API] Org fetch error:', orgError);
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    console.log('[Checkout API] Creating checkout for org:', org.slug);

    // Create Polar checkout session - with embed support if embedOrigin provided
    const checkoutOptions: Parameters<typeof polarClient.checkouts.create>[0] = {
      products: [productId],
      successUrl: `${process.env.NEXT_PUBLIC_URL}/dashboard/organizations/${org.slug}/billing?success=true`,
      metadata: {
        org_id: org.id,
        org_slug: org.slug,
      },
    };

    // Add embed origin for embedded checkout iframe communication
    if (embedOrigin) {
      checkoutOptions.embedOrigin = embedOrigin;
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
