import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getLimitForTier, type SubscriptionTier } from '@/lib/polarClient';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';

type SubscriptionPayload = {
    id: string;
    customerId: string;
    productId: string;
    status: string;
    currentPeriodStart: Date | string;
    currentPeriodEnd: Date | string | null;
    metadata?: Record<string, string | number | boolean>;
};

function getProductIdToTier(productId: string | null | undefined): SubscriptionTier {
    if (!productId) {
        return 'free';
    }

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

function toNullableISOString(value: Date | string | null | undefined): string | null {
    if (!value) {
        return null;
    }

    try {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return date.toISOString();
    } catch (error) {
        console.error('[Polar Webhook] Failed to normalize date:', error);
        return null;
    }
}

async function resolveOrganizationId(
    supabaseAdmin: ReturnType<typeof createAdminClient>,
    payload: SubscriptionPayload
) {
    const metadataOrgId = payload.metadata?.org_id;
    if (typeof metadataOrgId === 'string' && metadataOrgId.length > 0) {
        return metadataOrgId;
    }

    const { data: bySubscription, error: subscriptionLookupError } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('subscription_id', payload.id)
        .maybeSingle();

    if (subscriptionLookupError) {
        console.error('[Polar Webhook] Failed to resolve org by subscription_id:', subscriptionLookupError);
    }

    if (bySubscription?.id) {
        return bySubscription.id;
    }

    const { data: byCustomer, error: customerLookupError } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('polar_customer_id', payload.customerId)
        .maybeSingle();

    if (customerLookupError) {
        console.error('[Polar Webhook] Failed to resolve org by polar_customer_id:', customerLookupError);
    }

    return byCustomer?.id ?? null;
}

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('[Polar Webhook] Missing POLAR_WEBHOOK_SECRET');
            return NextResponse.json(
                { error: 'Missing webhook secret configuration' },
                { status: 500 }
            );
        }

        let event: ReturnType<typeof validateEvent>;
        try {
            event = validateEvent(rawBody, Object.fromEntries(req.headers.entries()), webhookSecret);
        } catch (error) {
            if (error instanceof WebhookVerificationError) {
                console.error('[Polar Webhook] Invalid signature');
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }
            throw error;
        }

        const supabaseAdmin = createAdminClient();

        console.log('[Polar Webhook] Received event:', event.type);

        switch (event.type) {
            case 'subscription.created':
            case 'subscription.active':
            case 'subscription.uncanceled':
            case 'subscription.updated': {
                const payload: SubscriptionPayload = event.data;
                const orgId = await resolveOrganizationId(supabaseAdmin, payload);

                if (!orgId) {
                    console.warn('[Polar Webhook] Unable to resolve organization for subscription update:', payload.id);
                    return NextResponse.json({ received: true, warning: 'org_not_resolved' });
                }

                const tier = getProductIdToTier(payload.productId);
                const limit = getLimitForTier(tier);

                const { error } = await supabaseAdmin
                    .from('organizations')
                    .update({
                        subscription_tier: tier,
                        subscription_status: payload.status || 'active',
                        subscription_id: payload.id,
                        polar_customer_id: payload.customerId,
                        subscription_current_period_start: toNullableISOString(payload.currentPeriodStart),
                        subscription_current_period_end: toNullableISOString(payload.currentPeriodEnd),
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
                const payload: SubscriptionPayload = event.data;
                const orgId = await resolveOrganizationId(supabaseAdmin, payload);

                if (!orgId) {
                    console.warn('[Polar Webhook] Unable to resolve organization for subscription cancellation:', payload.id);
                    return NextResponse.json({ received: true, warning: 'org_not_resolved' });
                }

                const { error } = await supabaseAdmin
                    .from('organizations')
                    .update({
                        subscription_tier: 'free',
                        subscription_status: payload.status || 'canceled',
                        subscription_id: payload.id,
                        polar_customer_id: payload.customerId,
                        subscription_current_period_end: toNullableISOString(payload.currentPeriodEnd),
                        monthly_request_limit: getLimitForTier('free'),
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
                console.log('[Polar Webhook] Order paid - waiting for subscription.active event');
                break;
            }

            case 'checkout.created':
            case 'checkout.updated':
                console.log(`[Polar Webhook] Checkout event: ${event.type}`);
                break;

            case 'organization.updated':
            case 'customer.created':
            case 'customer.updated':
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
