import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { addCredits } from '@/lib/credits';
import {
    getCreditTopupCreditsByProductId,
    getLimitForTier,
    getScanTierByProductId,
    type ScanSubscriptionTier,
    type SubscriptionTier,
} from '@/lib/polarClient';
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

type PolarMetadata = Record<string, string | number | boolean | null>;

type OrderPaidPayload = {
    id: string;
    customerId?: string | null;
    productId?: string | null;
    metadata?: PolarMetadata;
    checkout?: {
        metadata?: PolarMetadata;
    };
};

function getProductIdToTier(productId: string | null | undefined): SubscriptionTier | null {
    if (!productId) {
        return null;
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
    return null;
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

async function resolveScanSubscriptionUserId(
    supabaseAdmin: ReturnType<typeof createAdminClient>,
    payload: SubscriptionPayload
) {
    const metadataUserId = payload.metadata?.user_id;
    if (typeof metadataUserId === 'string' && metadataUserId.length > 0) {
        return metadataUserId;
    }

    const { data: bySubscription, error: subscriptionLookupError } = await supabaseAdmin
        .from('scan_subscriptions')
        .select('user_id')
        .eq('subscription_id', payload.id)
        .maybeSingle();

    if (subscriptionLookupError) {
        console.error('[Polar Webhook] Failed to resolve scan user by subscription_id:', subscriptionLookupError);
    }

    if (bySubscription?.user_id) {
        return bySubscription.user_id;
    }

    if (!payload.customerId) {
        return null;
    }

    const { data: byCustomer, error: customerLookupError } = await supabaseAdmin
        .from('scan_subscriptions')
        .select('user_id')
        .eq('polar_customer_id', payload.customerId)
        .maybeSingle();

    if (customerLookupError) {
        console.error('[Polar Webhook] Failed to resolve scan user by polar_customer_id:', customerLookupError);
    }

    return byCustomer?.user_id ?? null;
}

async function upsertScanSubscription(
    supabaseAdmin: ReturnType<typeof createAdminClient>,
    payload: SubscriptionPayload,
    userId: string,
    scanTier: ScanSubscriptionTier | null,
    fallbackStatus: 'active' | 'canceled' = 'active'
) {
    let resolvedScanTier = scanTier;
    if (!resolvedScanTier) {
        const { data: existingRow, error: existingLookupError } = await supabaseAdmin
            .from('scan_subscriptions')
            .select('scan_tier')
            .eq('user_id', userId)
            .maybeSingle();

        if (existingLookupError) {
            console.error('[Polar Webhook] Failed to resolve existing scan tier:', existingLookupError);
            throw existingLookupError;
        }

        if (!existingRow?.scan_tier) {
            throw new Error(`Unable to resolve scan tier for scan subscription ${payload.id}`);
        }

        resolvedScanTier = existingRow.scan_tier as ScanSubscriptionTier;
    }

    const updates: {
        user_id: string;
        scan_tier: ScanSubscriptionTier;
        status: string;
        subscription_id: string;
        polar_customer_id: string;
        current_period_start: string | null;
        current_period_end: string | null;
    } = {
        user_id: userId,
        scan_tier: resolvedScanTier,
        status: payload.status || fallbackStatus,
        subscription_id: payload.id,
        polar_customer_id: payload.customerId,
        current_period_start: toNullableISOString(payload.currentPeriodStart),
        current_period_end: toNullableISOString(payload.currentPeriodEnd),
    };

    const { error } = await supabaseAdmin
        .from('scan_subscriptions')
        .upsert(updates, { onConflict: 'user_id' });

    if (error) {
        console.error('[Polar Webhook] Scan subscription upsert error:', error);
        throw error;
    }
}

function parsePositiveNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return null;
}

function extractOrderMetadata(payload: OrderPaidPayload): PolarMetadata {
    if (payload.metadata && typeof payload.metadata === 'object') {
        return payload.metadata;
    }

    if (payload.checkout?.metadata && typeof payload.checkout.metadata === 'object') {
        return payload.checkout.metadata;
    }

    return {};
}

async function resolveOrganizationIdForOrder(
    supabaseAdmin: ReturnType<typeof createAdminClient>,
    payload: OrderPaidPayload,
    metadata: PolarMetadata
) {
    const metadataOrgId = metadata.org_id;
    if (typeof metadataOrgId === 'string' && metadataOrgId.length > 0) {
        return metadataOrgId;
    }

    if (!payload.customerId) {
        return null;
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

async function hasExistingTopupForOrder(
    supabaseAdmin: ReturnType<typeof createAdminClient>,
    organizationId: string,
    orderId: string
) {
    const description = `Polar top-up order ${orderId}`;
    const { data, error } = await supabaseAdmin
        .from('credit_transactions')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('transaction_type', 'topup')
        .eq('description', description)
        .maybeSingle();

    if (error) {
        console.error('[Polar Webhook] Failed checking existing top-up transaction:', error);
        return false;
    }

    return !!data?.id;
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
                const scanTier = getScanTierByProductId(payload.productId);
                const scanUserId = await resolveScanSubscriptionUserId(supabaseAdmin, payload);

                if (scanTier || scanUserId) {
                    if (!scanUserId) {
                        console.warn('[Polar Webhook] Unable to resolve user for scan subscription update:', payload.id);
                        return NextResponse.json({ received: true, warning: 'scan_user_not_resolved' });
                    }

                    await upsertScanSubscription(supabaseAdmin, payload, scanUserId, scanTier, 'active');
                    console.log(`[Polar Webhook] ✓ Updated scan subscription for user ${scanUserId} (${scanTier || 'existing_tier'})`);
                    break;
                }

                const orgId = await resolveOrganizationId(supabaseAdmin, payload);

                if (!orgId) {
                    console.warn('[Polar Webhook] Unable to resolve organization for subscription update:', payload.id);
                    return NextResponse.json({ received: true, warning: 'org_not_resolved' });
                }

                const tier = getProductIdToTier(payload.productId);
                if (!tier) {
                    console.warn('[Polar Webhook] Subscription update with unmapped product, ignoring:', payload.productId);
                    break;
                }
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
                const scanTier = getScanTierByProductId(payload.productId);
                const scanUserId = await resolveScanSubscriptionUserId(supabaseAdmin, payload);

                if (scanTier || scanUserId) {
                    if (!scanUserId) {
                        console.warn('[Polar Webhook] Unable to resolve user for scan subscription cancellation:', payload.id);
                        return NextResponse.json({ received: true, warning: 'scan_user_not_resolved' });
                    }

                    await upsertScanSubscription(supabaseAdmin, payload, scanUserId, scanTier, 'canceled');
                    console.log(`[Polar Webhook] ✓ Marked scan subscription canceled for user ${scanUserId}`);
                    break;
                }

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
                const payload: OrderPaidPayload = event.data as OrderPaidPayload;
                const metadata = extractOrderMetadata(payload);

                if (metadata.purchase_type !== 'credits_topup') {
                    console.log('[Polar Webhook] Order paid for non-topup product, ignoring.');
                    break;
                }

                if (!payload.id) {
                    console.warn('[Polar Webhook] Missing order id for top-up order');
                    break;
                }

                const orgId = await resolveOrganizationIdForOrder(supabaseAdmin, payload, metadata);
                if (!orgId) {
                    console.warn('[Polar Webhook] Unable to resolve organization for top-up order:', payload.id);
                    return NextResponse.json({ received: true, warning: 'org_not_resolved' });
                }

                const existingTopup = await hasExistingTopupForOrder(supabaseAdmin, orgId, payload.id);
                if (existingTopup) {
                    console.log(`[Polar Webhook] Top-up already applied for order ${payload.id}, skipping duplicate event`);
                    break;
                }

                const creditsFromMetadata = parsePositiveNumber(metadata.credits_amount);
                const creditsFromProduct = getCreditTopupCreditsByProductId(payload.productId);
                const creditsToAdd = creditsFromMetadata ?? creditsFromProduct;

                if (!creditsToAdd || creditsToAdd <= 0) {
                    console.warn('[Polar Webhook] Unable to determine credits amount for top-up order:', payload.id);
                    break;
                }

                const credited = await addCredits(
                    orgId,
                    creditsToAdd,
                    'topup',
                    `Polar top-up order ${payload.id}`,
                    {
                        polar_order_id: payload.id,
                        polar_customer_id: payload.customerId ?? null,
                        credits_amount: creditsToAdd,
                        credit_pack: typeof metadata.credit_pack === 'string' ? metadata.credit_pack : null,
                    }
                );

                if (!credited) {
                    throw new Error(`Failed to apply credits for order ${payload.id}`);
                }

                if (payload.customerId) {
                    await supabaseAdmin
                        .from('organizations')
                        .update({ polar_customer_id: payload.customerId })
                        .eq('id', orgId);
                }

                console.log(`[Polar Webhook] ✓ Credited org ${orgId} with $${creditsToAdd.toFixed(2)} from order ${payload.id}`);
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
