"use client";

import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Cards, the subscription and receipts live in the Bachs customer portal
 * (Cencori never holds card details). The org gets a Bachs billing account
 * with its first payment.
 */
export function BillingPortal({
    hasAccount,
    opening,
    onOpen,
}: {
    hasAccount: boolean;
    opening: boolean;
    onOpen: () => void;
}) {
    return (
        <section className="grid gap-6 border-t border-border/30 py-9 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
            <div>
                <h2 className="text-sm font-medium">Payment methods</h2>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    Cards used for subscriptions and prepaid credits.
                </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/20">
                <div className="flex items-start gap-3 bg-muted/50 px-5 py-6">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/40 bg-background">
                        <CreditCard className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <div>
                        <div className="text-xs font-medium">
                            {hasAccount ? "Managed in the billing portal" : "No saved payment method"}
                        </div>
                        <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
                            {hasAccount
                                ? "Change your card, cancel the subscription and download receipts on our payment partner's secure portal."
                                : "Your card is saved securely by our payment partner with your first subscription or credit purchase."}
                        </div>
                    </div>
                </div>

                {hasAccount && (
                    <div className="flex justify-end border-t border-border/30 px-4 py-3 sm:px-5">
                        <Button
                            className="h-7 rounded-md px-3 text-[11px] font-medium shadow-none"
                            onClick={onOpen}
                            disabled={opening}
                        >
                            {opening ? "Opening…" : "Open billing portal"}
                        </Button>
                    </div>
                )}
            </div>
        </section>
    );
}
