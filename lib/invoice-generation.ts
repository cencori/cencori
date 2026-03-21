/**
 * End-User Invoice Generation
 *
 * Aggregates usage from end_user_usage for a billing period,
 * creates Stripe invoices via Connect, and stores records
 * in end_user_invoices.
 */

import { createAdminClient } from '@/lib/supabaseAdmin';
import { createEndUserInvoice } from '@/lib/stripe-connect';
import { writeAuditLog } from '@/lib/audit-log';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

interface InvoiceLineItem {
    description: string;
    amount_usd: number;
    tokens: number;
    requests: number;
}

interface GeneratedInvoice {
    invoiceId: string;
    endUserId: string;
    externalId: string;
    totalUsd: number;
    stripeInvoiceId: string | null;
    hostedUrl: string | null;
    status: 'draft' | 'sent';
}

interface GenerateInvoiceParams {
    projectId: string;
    organizationId: string;
    periodStart: string; // ISO date (YYYY-MM-DD)
    periodEnd: string;   // ISO date (YYYY-MM-DD)
    endUserIds?: string[]; // specific users, or all if omitted
    sendViaStripe?: boolean; // create Stripe invoice or just a draft record
    actorId?: string;
    actorEmail?: string | null;
}

/**
 * Generate invoices for end-users based on their usage in a billing period.
 */
export async function generateInvoices(params: GenerateInvoiceParams): Promise<{
    generated: GeneratedInvoice[];
    skipped: { endUserId: string; reason: string }[];
    errors: { endUserId: string; error: string }[];
}> {
    const {
        projectId,
        organizationId,
        periodStart,
        periodEnd,
        endUserIds,
        sendViaStripe = false,
        actorId,
        actorEmail,
    } = params;

    const supabase = createAdminClient();
    const generated: GeneratedInvoice[] = [];
    const skipped: { endUserId: string; reason: string }[] = [];
    const errors: { endUserId: string; error: string }[] = [];

    // Get Stripe Connect account if sending via Stripe
    let stripeAccountId: string | null = null;
    if (sendViaStripe) {
        const { data: connectAccount } = await supabase
            .from('stripe_connect_accounts')
            .select('stripe_account_id, status, charges_enabled')
            .eq('organization_id', organizationId)
            .single();

        if (!connectAccount || connectAccount.status !== 'active' || !connectAccount.charges_enabled) {
            throw new Error('Stripe Connect account is not active or charges are not enabled');
        }
        stripeAccountId = connectAccount.stripe_account_id;
    }

    // Get project billing config
    const { data: project } = await supabase
        .from('projects')
        .select('customer_markup_percentage')
        .eq('id', projectId)
        .single();

    const defaultMarkup = project?.customer_markup_percentage ?? 0;

    // Get end-users to invoice
    let usersQuery = supabase
        .from('end_users')
        .select('id, external_id, display_name, email, rate_plan_id, is_blocked, rate_plans(markup_percentage, flat_rate_per_request)')
        .eq('project_id', projectId);

    if (endUserIds && endUserIds.length > 0) {
        usersQuery = usersQuery.in('id', endUserIds);
    }

    const { data: endUsers, error: usersError } = await usersQuery;

    if (usersError || !endUsers) {
        throw new Error(`Failed to fetch end-users: ${usersError?.message || 'unknown'}`);
    }

    for (const user of endUsers) {
        try {
            // Check for existing invoice in this period
            const { data: existingInvoice } = await supabase
                .from('end_user_invoices')
                .select('id')
                .eq('end_user_id', user.id)
                .eq('period_start', periodStart)
                .eq('period_end', periodEnd)
                .not('status', 'eq', 'void')
                .maybeSingle();

            if (existingInvoice) {
                skipped.push({ endUserId: user.id, reason: 'Invoice already exists for this period' });
                continue;
            }

            // Aggregate usage for the period
            const { data: usageData } = await supabase
                .from('end_user_usage')
                .select('total_requests, total_tokens, provider_cost_usd, customer_charge_usd')
                .eq('end_user_id', user.id)
                .eq('period_type', 'daily')
                .gte('period_start', periodStart)
                .lte('period_start', periodEnd);

            if (!usageData || usageData.length === 0) {
                skipped.push({ endUserId: user.id, reason: 'No usage in this period' });
                continue;
            }

            // Sum up usage
            let totalRequests = 0;
            let totalTokens = 0;
            let providerCostUsd = 0;
            let customerChargeUsd = 0;

            for (const row of usageData) {
                totalRequests += row.total_requests ?? 0;
                totalTokens += Number(row.total_tokens ?? 0);
                providerCostUsd += parseFloat(row.provider_cost_usd) || 0;
                customerChargeUsd += parseFloat(row.customer_charge_usd) || 0;
            }

            if (customerChargeUsd <= 0) {
                skipped.push({ endUserId: user.id, reason: 'Zero charge for this period' });
                continue;
            }

            const markupUsd = customerChargeUsd - providerCostUsd;
            const totalUsd = customerChargeUsd;

            // Build line items
            const lineItems: InvoiceLineItem[] = [{
                description: `AI Usage (${periodStart} to ${periodEnd}) — ${totalRequests.toLocaleString()} requests, ${totalTokens.toLocaleString()} tokens`,
                amount_usd: totalUsd,
                tokens: totalTokens,
                requests: totalRequests,
            }];

            let stripeInvoiceId: string | null = null;
            let hostedUrl: string | null = null;
            let invoiceStatus: 'draft' | 'sent' = 'draft';

            // Create Stripe invoice if requested and user has email
            if (sendViaStripe && stripeAccountId && user.email) {
                try {
                    const result = await createEndUserInvoice({
                        stripeAccountId,
                        endUserEmail: user.email,
                        endUserName: user.display_name || user.external_id,
                        lineItems: lineItems.map(li => ({
                            description: li.description,
                            amount: Math.round(li.amount_usd * 100), // convert to cents
                        })),
                    });

                    stripeInvoiceId = result.invoiceId;
                    hostedUrl = result.hostedInvoiceUrl;
                    invoiceStatus = 'sent';
                } catch (stripeErr) {
                    const msg = stripeErr instanceof Error ? stripeErr.message : 'Stripe invoice creation failed';
                    errors.push({ endUserId: user.id, error: msg });
                    continue;
                }
            } else if (sendViaStripe && !user.email) {
                skipped.push({ endUserId: user.id, reason: 'No email address — cannot send Stripe invoice' });
                continue;
            }

            // Store invoice record
            const { data: invoice, error: insertError } = await supabase
                .from('end_user_invoices')
                .insert({
                    project_id: projectId,
                    end_user_id: user.id,
                    stripe_invoice_id: stripeInvoiceId,
                    period_start: periodStart,
                    period_end: periodEnd,
                    total_requests: totalRequests,
                    total_tokens: totalTokens,
                    subtotal_usd: providerCostUsd,
                    markup_usd: markupUsd,
                    total_usd: totalUsd,
                    status: invoiceStatus,
                    sent_at: invoiceStatus === 'sent' ? new Date().toISOString() : null,
                    line_items: lineItems,
                })
                .select('id')
                .single();

            if (insertError || !invoice) {
                errors.push({ endUserId: user.id, error: `DB insert failed: ${insertError?.message || 'unknown'}` });
                continue;
            }

            generated.push({
                invoiceId: invoice.id,
                endUserId: user.id,
                externalId: user.external_id,
                totalUsd,
                stripeInvoiceId,
                hostedUrl,
                status: invoiceStatus,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            errors.push({ endUserId: user.id, error: msg });
        }
    }

    // Audit log
    if (actorId) {
        writeAuditLog({
            organizationId,
            projectId,
            category: 'billing',
            action: 'created',
            resourceType: 'end_user_invoices',
            resourceId: projectId,
            actorId,
            actorEmail: actorEmail || null,
            actorType: 'user',
            description: `Generated ${generated.length} invoice(s) for period ${periodStart} to ${periodEnd}`,
            metadata: {
                period_start: periodStart,
                period_end: periodEnd,
                generated: generated.length,
                skipped: skipped.length,
                errors: errors.length,
                send_via_stripe: sendViaStripe,
            },
        });
    }

    return { generated, skipped, errors };
}
