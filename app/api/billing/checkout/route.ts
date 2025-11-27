import { NextRequest, NextResponse } from 'next/server';
import { polarClient, POLAR_CONFIG, getProductId } from '@/lib/polarClient';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { tier, cycle, orgId } = await req.json();

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

    // Get organization details
    const supabaseAdmin = createAdminClient();
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug, name, owner_id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Create Polar checkout session
    const checkout = await polarClient.checkouts.create({
      products: [productId],
      successUrl: `${process.env.NEXT_PUBLIC_URL}/dashboard/organizations/${org.slug}/billing?success=true`,
      metadata: {
        org_id: org.id,
        org_slug: org.slug,
      },
    });

    return NextResponse.json({
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    });

  } catch (error) {
    console.error('[Checkout API] Error creating checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
