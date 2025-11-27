import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getLimitForTier, type SubscriptionTier } from '@/lib/polarClient';

// Polar webhook event types
type PolarWebhookEvent = {
    type: 'subscription.created' | 'subscription.updated' | 'subscription.cancelled' | 'subscription.revoked';
    data: {
        id: string;
        customer_id: string;
        product_id: string;
        status: 'active' | 'cancelled' | 'past_due' | 'trialing';
        current_period_start: string;
        current_period_end: string;
        metadata?: {
            org_id?: string;
            org_slug?: string;
        };
    };
};

// Helper to map product ID to tier
function getProductIdToTier(productId: string): SubscriptionTier {
    const proMonthly = process.env.POLAR_PRODUCT_PRO_MONTHLY;
    const proAnnual = process.env.POLAR_PRODUCT_PRO_ANNUAL;
    const teamMonthly = process.env.POLAR_PRODUCT_TEAM_MONTHLY;
    const teamAnnual = process.env.POLAR_PRODUCT_TEAM_ANNUAL;

    if (productId === proMonthly || productId === proAnnual) {
        return 'pro';
    }
    if (productId === teamMonthly || productId === teamAnnual) {
        return 'team';
    }
    return 'free';
}

export async function POST(req: NextRequest) {
    try {
        // TODO: Verify webhook signature with Polar secret
        // For now, we'll trust the webhook (add signature verification in production)

        const event: PolarWebhookEvent = await req.json();
        const supabaseAdmin = createAdminClient();

        console.log('[Polar Webhook] Received event:', event.type, event.data.id);

        // Get org ID from metadata or customer ID
        const orgId = event.data.metadata?.org_id;

        if (!orgId) {
            console.error('[Polar Webhook] No org_id in metadata');
            return NextResponse.json({ error: 'Missing org_id' }, { status: 400 });
        }

        switch (event.type) {
            case 'subscription.created':
            case 'subscription.updated': {
                const tier = getProductIdToTier(event.data.product_id);
                const limit = getLimitForTier(tier);

                await supabaseAdmin
                    .from('organizations')
                    .update({
                        subscription_tier: tier,
                        subscription_status: event.data.status,
                        subscription_id: event.data.id,
                        polar_customer_id: event.data.customer_id,
                        subscription_current_period_start: event.data.current_period_start,
                        subscription_current_period_end: event.data.current_period_end,
                        monthly_request_limit: limit,
                    })
                    .eq('id', orgId);

                console.log(`[Polar Webhook] Updated org ${orgId} to ${tier} tier`);
                break;
            }

            case 'subscription.cancelled':
            case 'subscription.revoked': {
                // Revert to free tier
                await supabaseAdmin
                    .from('organizations')
                    .update({
                        subscription_tier: 'free',
                        subscription_status: 'cancelled',
                        monthly_request_limit: 1000,
                    })
                    .eq('id', orgId);

                console.log(`[Polar Webhook] Reverted org ${orgId} to free tier`);
                break;
            }

            default:
                console.log(`[Polar Webhook] Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('[Polar Webhook] Error processing webhook:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 }
        );
    }
}
