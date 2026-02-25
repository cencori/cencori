'use server'

import { createServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { Polar } from "@polar-sh/sdk";
import { getProductId } from "@/lib/polarClient";

// Initialize Polar
const polar = new Polar({
    accessToken: process.env.POLAR_API_KEY,
    server: "production", // Switch to production as we are using live keys
});

type OrgBillingDetails = {
    id: string;
    slug: string;
    name: string;
    owner_id: string;
    billing_email: string | null;
    polar_customer_id: string | null;
    subscription_id: string | null;
    subscription_tier: 'free' | 'pro' | 'team' | 'enterprise';
};

export type BillingInvoice = {
    id: string;
    orderId: string;
    date: string;
    amount: number;
    status: 'paid' | 'pending' | 'refunded';
    pdfUrl: string | null;
};

export type BillingPaymentMethod = {
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
};

function getAppBaseUrl() {
    return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function getAuthorizedOrgBillingDetails(orgSlug: string): Promise<{ org: OrgBillingDetails } | { error: string }> {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: 'Unauthorized' };
    }

    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, slug, name, owner_id, billing_email, polar_customer_id, subscription_id, subscription_tier')
        .eq('slug', orgSlug)
        .maybeSingle();

    if (orgError || !org) {
        return { error: 'Organization not found' };
    }

    let hasAccess = org.owner_id === user.id;
    if (!hasAccess) {
        const { data: membership, error: membershipError } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', org.id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (membershipError) {
            console.error('[Billing Actions] Membership check failed:', membershipError);
            return { error: 'Failed to verify organization access' };
        }

        hasAccess = !!membership;
    }

    if (!hasAccess) {
        return { error: 'Forbidden' };
    }

    return {
        org: org as OrgBillingDetails
    };
}

export async function getInvoices(orgSlug: string) {
    try {
        const orgResult = await getAuthorizedOrgBillingDetails(orgSlug);
        if ('error' in orgResult) {
            return [];
        }

        if (!orgResult.org.polar_customer_id) {
            return [];
        }

        const orderIterator = await polar.orders.list({
            customerId: orgResult.org.polar_customer_id,
            sorting: ['-created_at'],
            limit: 20,
        });

        const orders: Array<{
            id: string;
            invoiceNumber: string;
            createdAt: Date;
            totalAmount: number;
            status: string;
            isInvoiceGenerated: boolean;
        }> = [];

        for await (const page of orderIterator) {
            if (!page?.result?.items?.length) {
                continue;
            }

            for (const order of page.result.items) {
                orders.push({
                    id: order.id,
                    invoiceNumber: order.invoiceNumber,
                    createdAt: order.createdAt,
                    totalAmount: order.totalAmount,
                    status: order.status,
                    isInvoiceGenerated: order.isInvoiceGenerated,
                });
            }

            if (orders.length >= 20) {
                break;
            }
        }

        const invoices = await Promise.all(
            orders.slice(0, 20).map(async (order): Promise<BillingInvoice> => {
                let pdfUrl: string | null = null;

                if (order.isInvoiceGenerated) {
                    try {
                        const invoice = await polar.orders.invoice({ id: order.id });
                        pdfUrl = invoice.url;
                    } catch (invoiceError) {
                        console.error('[Billing Actions] Failed to fetch invoice URL:', invoiceError);
                    }
                }

                const status: BillingInvoice['status'] = order.status === 'paid'
                    ? 'paid'
                    : order.status === 'pending'
                        ? 'pending'
                        : 'refunded';

                return {
                    id: order.invoiceNumber || order.id,
                    orderId: order.id,
                    date: order.createdAt.toISOString(),
                    amount: order.totalAmount / 100,
                    status,
                    pdfUrl,
                };
            })
        );

        return invoices;
    } catch (error) {
        console.error("Error fetching invoices:", error);
        return [];
    }
}

export async function getCustomerPortalUrl(orgSlug: string) {
    try {
        const orgResult = await getAuthorizedOrgBillingDetails(orgSlug);
        if ('error' in orgResult) {
            return null;
        }

        const org = orgResult.org;
        const billingReturnUrl = `${getAppBaseUrl()}/dashboard/organizations/${org.slug}/billing`;

        // Existing customer => customer portal
        if (org.polar_customer_id) {
            const session = await polar.customerSessions.create({
                customerId: org.polar_customer_id,
                returnUrl: billingReturnUrl,
            });

            return session.customerPortalUrl;
        }

        // No customer yet => generate checkout (free defaults to Pro monthly).
        if (org.subscription_tier === 'pro' || org.subscription_tier === 'team' || org.subscription_tier === 'free') {
            const checkoutTier = org.subscription_tier === 'team' ? 'team' : 'pro';
            const checkout = await polar.checkouts.create({
                products: [getProductId(checkoutTier, 'monthly')],
                customerEmail: org.billing_email || undefined,
                customerName: org.name,
                metadata: {
                    org_id: org.id,
                    org_slug: org.slug,
                },
                successUrl: `${billingReturnUrl}?success=true`,
            });

            return checkout.url || null;
        }

        return null;
    } catch (error) {
        console.error("Error creating billing session:", error);
        return null;
    }
}

export async function getPaymentMethods(orgSlug: string) {
    try {
        const orgResult = await getAuthorizedOrgBillingDetails(orgSlug);
        if ('error' in orgResult || !orgResult.org.polar_customer_id) {
            return [] as BillingPaymentMethod[];
        }

        const session = await polar.customerSessions.create({
            customerId: orgResult.org.polar_customer_id,
            returnUrl: `${getAppBaseUrl()}/dashboard/organizations/${orgResult.org.slug}/billing`,
        });

        const methodsIterator = await polar.customerPortal.customers.listPaymentMethods(
            { customerSession: session.token },
            { limit: 20 }
        );

        const methods: BillingPaymentMethod[] = [];

        for await (const page of methodsIterator) {
            for (const method of page.result.items) {
                if (method.type === 'card' && 'methodMetadata' in method) {
                    methods.push({
                        id: method.id,
                        brand: method.methodMetadata.brand || 'Card',
                        last4: method.methodMetadata.last4 || '----',
                        expMonth: method.methodMetadata.expMonth || 0,
                        expYear: method.methodMetadata.expYear || 0,
                        isDefault: false,
                    });
                    continue;
                }
            }
        }

        if (methods.length > 0) {
            methods[0].isDefault = true;
        }

        return methods;
    } catch (error) {
        console.error('[Billing Actions] Error fetching payment methods:', error);
        return [] as BillingPaymentMethod[];
    }
}

export async function updateBillingDetails(orgSlug: string, formData: FormData) {
    const orgResult = await getAuthorizedOrgBillingDetails(orgSlug);
    if ('error' in orgResult) {
        return { error: orgResult.error };
    }

    const supabase = await createServerClient();
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();

    if (!name || !email) {
        return { error: 'Organization name and billing email are required.' };
    }

    const toNullable = (value: FormDataEntryValue | null) => {
        const normalized = typeof value === 'string' ? value.trim() : '';
        return normalized.length > 0 ? normalized : null;
    };

    const { error } = await supabase
        .from('organizations')
        .update({
            name,
            billing_email: email,
            billing_address_line1: toNullable(formData.get('line1')),
            billing_address_line2: toNullable(formData.get('line2')),
            billing_city: toNullable(formData.get('city')),
            billing_state: toNullable(formData.get('state')),
            billing_zip: toNullable(formData.get('zip')),
            billing_country: toNullable(formData.get('country')),
            billing_tax_id: toNullable(formData.get('taxId')),
        })
        .eq('id', orgResult.org.id);

    if (error) {
        console.error('Error updating billing details:', error);
        return { error: error.message };
    }

    revalidatePath(`/dashboard/organizations/${orgSlug}/billing`);
    return { success: true };
}
