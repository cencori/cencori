'use server'

import { createServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { Polar } from "@polar-sh/sdk";
import { redirect } from "next/navigation";

// Initialize Polar
const polar = new Polar({
    accessToken: process.env.POLAR_API_KEY,
    server: "production", // Switch to production as we are using live keys
});

// Helper to get org details including Polar IDs
async function getOrgBillingDetails(orgSlug: string) {
    const supabase = createServerClient();
    const { data: org, error } = await (await supabase)
        .from('organizations')
        .select('id, name, billing_email, polar_customer_id, subscription_id, subscription_tier')
        .eq('slug', orgSlug)
        .single();

    if (error || !org) return null;
    return org;
}

export async function getInvoices(orgSlug: string) {
    try {
        const org = await getOrgBillingDetails(orgSlug);
        if (!org?.polar_customer_id) return [];

        // In a real implementation, you would list invoices from Polar using the customer ID
        // For now, returning empty array as placeholder or implement actual SDK call if available
        // const result = await polar.invoices.list({ customerId: org.polar_customer_id });
        // return result.items;

        return [];
    } catch (error) {
        console.error("Error fetching invoices:", error);
        return [];
    }
}

export async function getCustomerPortalUrl(orgSlug: string) {
    try {
        console.log("Generating billing action URL for org:", orgSlug);
        const org = await getOrgBillingDetails(orgSlug);
        console.log("Org details:", {
            id: org?.id,
            customerId: org?.polar_customer_id,
            subscriptionId: org?.subscription_id,
            tier: org?.subscription_tier // We need to fetch this
        });

        if (!org) return null;

        // SCENARIO 1: Existing Subscription -> Go to Portal
        // If they have a subscription_id, they are a paid customer.
        if (org.subscription_id && org.polar_customer_id) {
            console.log("User has subscription. Generating Portal Session...");
            const session = await polar.customerSessions.create({
                customerId: org.polar_customer_id,
            });
            return session.customerPortalUrl;
        }

        // SCENARIO 2: No Subscription but on Paid Plan (Manual/Team) -> Go to Checkout
        // If they are on 'team' or 'pro' but have no subscription_id, they need to pay.
        // We will redirect them to the Checkout link for their current plan.

        // We need to fetch the plan/tier to know which link to generate.
        // Let's assume 'team' for now based on context.

        const productId = process.env.POLAR_PRODUCT_TEAM_MONTHLY;

        if (productId) {
            console.log("User has NO subscription. Generating Checkout Session for Product:", productId);
            const checkout = await polar.checkouts.create({
                products: [productId],
                customerEmail: org.billing_email,
                customerName: org.name,
                customerId: org.polar_customer_id,
                metadata: {
                    org_id: org.id
                },
                successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/organizations/${orgSlug}/billing?success=true`,
            });
            return checkout.url;
        }

        return null; // Fallback if no product ID configured
    } catch (error) {
        console.error("Error creating billing session:", error);
        return null;
    }
}

export async function updateBillingDetails(orgSlug: string, formData: FormData) {
    const supabase = createServerClient();
    const { data: { user } } = await (await supabase).auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const name = formData.get('name') as string;
    const line1 = formData.get('line1') as string;
    const line2 = formData.get('line2') as string;
    const city = formData.get('city') as string;
    const state = formData.get('state') as string;
    const zip = formData.get('zip') as string;
    const country = formData.get('country') as string;
    const taxId = formData.get('taxId') as string;

    const { error } = await (await supabase)
        .from('organizations')
        .update({
            name,
            billing_address_line1: line1,
            billing_address_line2: line2,
            billing_city: city,
            billing_state: state,
            billing_zip: zip,
            billing_country: country,
            billing_tax_id: taxId
        })
        .eq('slug', orgSlug);

    if (error) {
        console.error('Error updating billing details:', error);
        return { error: error.message };
    }

    revalidatePath(`/dashboard/organizations/${orgSlug}/billing`);
    return { success: true };
}
