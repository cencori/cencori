import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
    try {
        const { getStripe, syncConnectAccountStatus } = await import("@/lib/stripe-connect");
        const stripe = getStripe();

        const body = await req.text();
        const sig = req.headers.get("stripe-signature");

        if (!sig || !process.env.STRIPE_CONNECT_WEBHOOK_SECRET) {
            return NextResponse.json({ error: "Missing signature" }, { status: 400 });
        }

        const event = stripe.webhooks.constructEvent(
            body,
            sig,
            process.env.STRIPE_CONNECT_WEBHOOK_SECRET
        );

        switch (event.type) {
            case "account.updated": {
                const account = event.data.object;
                await syncConnectAccountStatus(account.id);
                console.log(`[StripeConnect] Synced account status: ${account.id}`);
                break;
            }

            case "invoice.paid": {
                const invoice = event.data.object;
                if (event.account) {
                    const { createAdminClient } = await import("@/lib/supabaseAdmin");
                    const supabase = createAdminClient();

                    // Update invoice status in our DB
                    await supabase
                        .from("end_user_invoices")
                        .update({
                            status: "paid",
                            paid_at: new Date().toISOString(),
                        })
                        .eq("stripe_invoice_id", invoice.id);

                    // Find the org for audit logging
                    const { data: connectAccount } = await supabase
                        .from("stripe_connect_accounts")
                        .select("organization_id")
                        .eq("stripe_account_id", event.account)
                        .single();

                    if (connectAccount) {
                        writeAuditLog({
                            organizationId: connectAccount.organization_id,
                            category: "billing",
                            action: "updated",
                            resourceType: "end_user_invoice",
                            resourceId: invoice.id,
                            actorType: "webhook",
                            description: `End-user invoice paid: $${((invoice.amount_paid || 0) / 100).toFixed(2)}`,
                            metadata: {
                                stripe_invoice_id: invoice.id,
                                amount_paid: invoice.amount_paid,
                                customer_email: invoice.customer_email,
                            },
                        });
                    }
                }
                break;
            }

            case "invoice.payment_failed": {
                const invoice = event.data.object;
                if (event.account) {
                    const { createAdminClient } = await import("@/lib/supabaseAdmin");
                    const supabase = createAdminClient();

                    await supabase
                        .from("end_user_invoices")
                        .update({ status: "overdue" })
                        .eq("stripe_invoice_id", invoice.id);
                }
                break;
            }

            case "account.application.deauthorized": {
                // User revoked Stripe Connect access — mark account as disconnected
                const account = event.data.object;
                const { createAdminClient } = await import("@/lib/supabaseAdmin");
                const supabase = createAdminClient();

                const { data: connectAccount } = await supabase
                    .from("stripe_connect_accounts")
                    .update({ status: "disconnected", updated_at: new Date().toISOString() })
                    .eq("stripe_account_id", account.id)
                    .select("organization_id")
                    .single();

                if (connectAccount) {
                    writeAuditLog({
                        organizationId: connectAccount.organization_id,
                        category: "billing",
                        action: "deleted",
                        resourceType: "stripe_connect_account",
                        resourceId: account.id,
                        actorType: "webhook",
                        description: `Stripe Connect account deauthorized: ${account.id}`,
                        metadata: { stripe_account_id: account.id },
                    });
                }

                console.log(`[StripeConnect] Account deauthorized: ${account.id}`);
                break;
            }

            default:
                console.log(`[StripeConnect] Unhandled event: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[StripeConnect] Webhook error:", error);
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        );
    }
}
