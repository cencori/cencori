import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { getScanProductId, polarClient, type ScanSubscriptionTier } from '@/lib/polarClient';

type ScanCheckoutRequestBody = {
    tier?: ScanSubscriptionTier;
    embedOrigin?: string;
};

function isScanTier(value: unknown): value is ScanSubscriptionTier {
    return value === 'scan' || value === 'scan_team';
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { tier, embedOrigin } = await req.json() as ScanCheckoutRequestBody;
        if (!isScanTier(tier)) {
            return NextResponse.json(
                { error: 'Invalid tier. Must be "scan" or "scan_team"' },
                { status: 400 }
            );
        }

        const productId = getScanProductId(tier);
        if (!productId) {
            return NextResponse.json(
                { error: `Scan tier "${tier}" is not configured in Polar products.` },
                { status: 500 }
            );
        }

        const scanBaseUrl = (process.env.NEXT_PUBLIC_SCAN_APP_URL || 'https://scan.cencori.com').replace(/\/$/, '');
        const checkoutOptions: Parameters<typeof polarClient.checkouts.create>[0] = {
            products: [productId],
            successUrl: `${scanBaseUrl}/?success=true&scanUpgrade=true`,
            customerEmail: user.email || undefined,
            customerName: (
                (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
                (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
                undefined
            ),
            metadata: {
                purchase_type: 'scan_subscription',
                user_id: user.id,
                scan_tier: tier,
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
            tier,
        });
    } catch (error: unknown) {
        console.error('[Scan Checkout API] Error creating checkout:', error);
        const details = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            {
                error: 'Failed to create scan checkout session',
                details,
            },
            { status: 500 }
        );
    }
}
