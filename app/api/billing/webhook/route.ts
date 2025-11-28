import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getLimitForTier, type SubscriptionTier } from '@/lib/polarClient';
import crypto from 'crypto';

// Polar webhook event types (actual events from Polar)
type PolarWebhookEvent = {
    type: string;
    data: {
        id: string;
        customer_id?: string;
        product_id?: string;
        status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
        current_period_start?: string;
        current_period_end?: string;
        metadata?: Record<string, string>;
        // For checkout.created events
        product_price_id?: string;
        products?: string[];
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

// Verify Polar webhook signature
function verifyPolarSignature(
    payload: string,
    signature: string | null,
    secret: string
): boolean {
    if (!signature) {
        console.error('[Polar Webhook] No signature provided');
        return false;
    }

    try {
        // Polar uses HMAC SHA256 for webhook signatures
        const hmac = crypto.createHmac('sha256', secret);
        const digest = hmac.update(payload).digest('hex');

        // Compare signatures (constant-time comparison to prevent timing attacks)
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(digest)
        );
    } catch (error) {
        console.error('[Polar Webhook] Signature verification error:', error);
        return false;
    }
}

export async function POST(req: NextRequest) {
    try {
        // Get raw body for signature verification
        const rawBody = await req.text();
        const signature = req.headers.get('x-polar-signature');
        const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

        // Verify signature if secret is configured
        if (webhookSecret) {
            if (!verifyPolarSignature(rawBody, signature, webhookSecret)) {
                console.error('[Polar Webhook] Invalid signature');
                return NextResponse.json(
                    { error: 'Invalid signature' },
                    { status: 401 }
                );
            }
            console.log('[Polar Webhook] Signature verified ✓');
        } else {
            console.warn('[Polar Webhook] No webhook secret configured - skipping verification');
        }

        const event: PolarWebhookEvent = JSON.parse(rawBody);
        const supabaseAdmin = createAdminClient();

        console.log('[Polar Webhook] Received event:', event.type);
        console.log('[Polar Webhook] Event data:', JSON.stringify(event.data, null, 2));

        // Extract org ID from metadata
        const orgId = event.data.metadata?.org_id;

        // Handle subscription lifecycle events
        switch (event.type) {
            case 'subscription.created':
            case 'subscription.active':
            case 'subscription.updated': {
                if (!orgId) {
                    console.warn('[Polar Webhook] No org_id in subscription event metadata');
                    return NextResponse.json({ received: true, warning: 'No org_id' });
                }

                const productId = event.data.product_id || event.data.products?.[0];
                if (!productId) {
                    console.error('[Polar Webhook] No product_id in subscription event');
                    return NextResponse.json({ received: true, warning: 'No product_id' });
                }

                const tier = getProductIdToTier(productId);
                const limit = getLimitForTier(tier);

                const { error } = await supabaseAdmin
                    .from('organizations')
                    .update({
                        subscription_tier: tier,
                        subscription_status: event.data.status || 'active',
                        subscription_id: event.data.id,
                        polar_customer_id: event.data.customer_id,
                        subscription_current_period_start: event.data.current_period_start,
                        subscription_current_period_end: event.data.current_period_end,
                        monthly_request_limit: limit,
                    })
                    .eq('id', orgId);

                if (error) {
                    console.error('[Polar Webhook] Database update error:', error);
                    throw error;
                }

                console.log(`[Polar Webhook] ✓ Updated org ${orgId} to ${tier} tier`);
                break;
            }

            case 'subscription.canceled':
            case 'subscription.revoked': {
                if (!orgId) {
                    console.warn('[Polar Webhook] No org_id in cancellation event metadata');
                    return NextResponse.json({ received: true, warning: 'No org_id' });
                }

                const { error } = await supabaseAdmin
                    .from('organizations')
                    .update({
                        subscription_tier: 'free',
                        subscription_status: 'canceled',
                        monthly_request_limit: 1000,
                    })
                    .eq('id', orgId);

                if (error) {
                    console.error('[Polar Webhook] Database update error:', error);
                    throw error;
                }

                console.log(`[Polar Webhook] ✓ Reverted org ${orgId} to free tier`);
                break;
            }

            case 'order.paid': {
                // Order paid - subscription should also fire subscription.active
                console.log('[Polar Webhook] Order paid - waiting for subscription.active event');
                break;
            }

            case 'checkout.created':
            case 'checkout.updated':
                // Informational events - no action needed
                console.log(`[Polar Webhook] Checkout event: ${event.type}`);
                break;

            case 'organization.updated':
            case 'customer.created':
            case 'customer.updated':
                // Polar internal events - no action needed
                console.log(`[Polar Webhook] Informational event: ${event.type}`);
                break;

            default:
                console.log(`[Polar Webhook] Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });

    } catch (error: unknown) {
        console.error('[Polar Webhook] Error processing webhook:', error);

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
