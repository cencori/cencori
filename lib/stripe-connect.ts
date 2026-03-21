import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabaseAdmin';

// Lazy-initialize Stripe so the module can be imported even when
// STRIPE_SECRET_KEY is not yet available (e.g. during build or tests).
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
    if (!_stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error(
                'Missing STRIPE_SECRET_KEY environment variable. ' +
                'Set it before calling any Stripe Connect function.'
            );
        }
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2026-02-25.clover',
        });
    }
    return _stripe;
}

export interface ConnectAccountStatus {
    id: string;
    stripeAccountId: string;
    status: 'pending' | 'active' | 'restricted' | 'disabled';
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    onboardingCompleted: boolean;
}

/**
 * Create a Stripe Connect Standard account for an organization
 * and return the onboarding URL.
 */
export async function createConnectAccount(
    organizationId: string,
    returnUrl: string,
    refreshUrl: string,
): Promise<{ accountId: string; onboardingUrl: string }> {
    const stripe = getStripe();
    const supabase = createAdminClient();

    // Check if account already exists
    const { data: existing } = await supabase
        .from('stripe_connect_accounts')
        .select('stripe_account_id, status')
        .eq('organization_id', organizationId)
        .single();

    let stripeAccountId: string;

    if (existing?.stripe_account_id) {
        stripeAccountId = existing.stripe_account_id;
    } else {
        // Create new Stripe Connect account
        const account = await stripe.accounts.create({
            type: 'standard',
        });
        stripeAccountId = account.id;

        // Store in DB
        const { error: insertError } = await supabase.from('stripe_connect_accounts').insert({
            organization_id: organizationId,
            stripe_account_id: stripeAccountId,
            status: 'pending',
        });

        if (insertError) {
            console.error('[StripeConnect] Failed to save account to DB:', insertError);
            throw new Error(`Failed to save Stripe Connect account: ${insertError.message}`);
        }
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
    });

    return {
        accountId: stripeAccountId,
        onboardingUrl: accountLink.url,
    };
}

/**
 * Get the current status of a Connect account.
 */
export async function getConnectAccountStatus(
    organizationId: string
): Promise<ConnectAccountStatus | null> {
    const supabase = createAdminClient();

    const { data } = await supabase
        .from('stripe_connect_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

    if (!data) return null;

    return {
        id: data.id,
        stripeAccountId: data.stripe_account_id,
        status: data.status,
        chargesEnabled: data.charges_enabled,
        payoutsEnabled: data.payouts_enabled,
        onboardingCompleted: data.onboarding_completed,
    };
}

/**
 * Sync Stripe account status from Stripe API to our DB.
 * Called from webhook or on-demand.
 */
export async function syncConnectAccountStatus(
    stripeAccountId: string
): Promise<void> {
    const stripe = getStripe();
    const supabase = createAdminClient();
    const account = await stripe.accounts.retrieve(stripeAccountId);

    const status = account.charges_enabled && account.payouts_enabled
        ? 'active'
        : account.requirements?.disabled_reason
            ? 'disabled'
            : account.requirements?.currently_due?.length
                ? 'restricted'
                : 'pending';

    await supabase
        .from('stripe_connect_accounts')
        .update({
            status,
            charges_enabled: account.charges_enabled ?? false,
            payouts_enabled: account.payouts_enabled ?? false,
            onboarding_completed: account.details_submitted ?? false,
            updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', stripeAccountId);
}

/**
 * Create an invoice on behalf of a connected account for an end-user's usage.
 * Uses Stripe Connect with application_fee_amount.
 */
export async function createEndUserInvoice(params: {
    stripeAccountId: string;
    endUserEmail: string;
    endUserName?: string;
    lineItems: Array<{
        description: string;
        amount: number; // in cents
        quantity?: number;
    }>;
    applicationFeePercent?: number;
}): Promise<{ invoiceId: string; hostedInvoiceUrl: string | null }> {
    const stripe = getStripe();
    const { stripeAccountId, endUserEmail, endUserName, lineItems, applicationFeePercent = 3 } = params;

    // Create or retrieve customer on the connected account
    const customers = await stripe.customers.list(
        { email: endUserEmail, limit: 1 },
        { stripeAccount: stripeAccountId }
    );

    let customerId: string;
    if (customers.data.length > 0) {
        customerId = customers.data[0].id;
    } else {
        const customer = await stripe.customers.create(
            { email: endUserEmail, name: endUserName },
            { stripeAccount: stripeAccountId }
        );
        customerId = customer.id;
    }

    // Create invoice
    const invoice = await stripe.invoices.create(
        {
            customer: customerId,
            collection_method: 'send_invoice',
            days_until_due: 30,
            application_fee_amount: Math.round(
                lineItems.reduce((sum, li) => sum + li.amount * (li.quantity || 1), 0) * (applicationFeePercent / 100)
            ),
        },
        { stripeAccount: stripeAccountId }
    );

    // Add line items
    for (const item of lineItems) {
        await stripe.invoiceItems.create(
            {
                customer: customerId,
                invoice: invoice.id,
                description: item.description,
                amount: item.amount,
                quantity: item.quantity || 1,
                currency: 'usd',
            },
            { stripeAccount: stripeAccountId }
        );
    }

    // Finalize the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
        invoice.id,
        {},
        { stripeAccount: stripeAccountId }
    );

    return {
        invoiceId: finalizedInvoice.id,
        hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url ?? null,
    };
}

/** Get a Stripe instance for webhook signature verification etc. */
export { getStripe };
