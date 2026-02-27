import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';
import { polarClient, getCreditTopupPackConfig, type CreditTopupPack } from '@/lib/polarClient';

type CreditsCheckoutRequestBody = {
  orgId?: string;
  pack?: CreditTopupPack;
  embedOrigin?: string;
};

const CREDIT_PACKS: CreditTopupPack[] = ['starter', 'growth', 'scale'];

function isCreditTopupPack(value: unknown): value is CreditTopupPack {
  return typeof value === 'string' && CREDIT_PACKS.includes(value as CreditTopupPack);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, pack, embedOrigin } = await req.json() as CreditsCheckoutRequestBody;

    if (!orgId || !pack) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, pack' },
        { status: 400 }
      );
    }

    if (!isCreditTopupPack(pack)) {
      return NextResponse.json(
        { error: 'Invalid pack. Must be one of: starter, growth, scale' },
        { status: 400 }
      );
    }

    const packConfig = getCreditTopupPackConfig(pack);
    if (!packConfig) {
      return NextResponse.json(
        { error: `Credit pack "${pack}" is not configured. Set POLAR_PRODUCT_CREDITS_${pack.toUpperCase()} in env.` },
        { status: 500 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug, name, owner_id, billing_email')
      .eq('id', orgId)
      .maybeSingle();

    if (orgError || !org) {
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
        console.error('[Credits Checkout API] Membership check failed:', membershipError);
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

    const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || req.nextUrl.origin).replace(/\/$/, '');

    const checkoutOptions: Parameters<typeof polarClient.checkouts.create>[0] = {
      products: [packConfig.productId],
      successUrl: `${appBaseUrl}/dashboard/organizations/${org.slug}/billing?success=true&topup=true`,
      customerEmail: org.billing_email || undefined,
      customerName: org.name,
      metadata: {
        purchase_type: 'credits_topup',
        credit_pack: pack,
        credits_amount: String(packConfig.credits),
        org_id: org.id,
        org_slug: org.slug,
      },
    };

    if (typeof embedOrigin === 'string' && embedOrigin.trim().length > 0) {
      checkoutOptions.embedOrigin = embedOrigin.trim();
    }

    const checkout = await polarClient.checkouts.create(checkoutOptions);
    if (!checkout.url) {
      throw new Error('Polar did not return a checkout URL');
    }

    return NextResponse.json({
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
      pack,
      credits: packConfig.credits,
    });
  } catch (error: unknown) {
    console.error('[Credits Checkout API] Error creating checkout:', error);

    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        error: 'Failed to create credits checkout session',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
