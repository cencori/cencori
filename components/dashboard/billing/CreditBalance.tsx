"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { AddCreditsDialog } from "./AddCreditsDialog";

interface Transaction {
    id: string;
    amount: number;
    type: string;
    description: string;
    createdAt: string;
}

interface CreditProps {
    orgId: string;
    balance: number;
    transactions: Transaction[];
    currency?: string;
}

export function CreditBalance({ orgId, balance, transactions, currency = "USD" }: CreditProps) {
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const { currency: displayCurrency, formatMoney } = useDisplayCurrency();
    const showMoney = (usd: number, digits?: number) =>
        displayCurrency === "NGN"
            ? formatMoney(usd)
            : formatCurrency(usd, currency, { maximumFractionDigits: digits ?? 8, minimumFractionDigits: 2 });

    return (
        <section className="grid gap-6 border-t border-border/30 py-9 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
            <div>
                <h2 className="text-sm font-medium">Prepaid credits</h2>
                <p className="mt-1.5 max-w-[30ch] text-xs leading-5 text-muted-foreground">
                    Add balance for managed model usage. Your provider-key calls remain separate.
                </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/20">
                <div className="flex flex-col gap-5 bg-muted/50 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                    <div>
                        <div className="text-xs text-muted-foreground">Available balance</div>
                        <div className="mt-1 font-mono text-2xl font-medium tracking-[-0.03em] tabular-nums">
                            {showMoney(balance)}
                        </div>
                    </div>
                    <Button
                        className="h-7 w-fit rounded-md px-3 text-[11px] font-medium shadow-none"
                        onClick={() => setDialogOpen(true)}
                    >
                        Add credits
                    </Button>
                </div>

                <div className="border-t border-border/30">
                    <div className="grid grid-cols-[1fr_auto] bg-muted/30 px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:px-5">
                        <span>Recent activity</span>
                        <span>Amount</span>
                    </div>
                    {transactions.length > 0 ? (
                        transactions.slice(0, 5).map((transaction) => {
                            const amount = Number(transaction.amount) || 0;
                            const isCredit = amount >= 0;
                            return (
                                <div
                                    key={transaction.id}
                                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border/30 px-4 py-3 sm:px-5"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate text-xs font-medium">{transaction.description}</div>
                                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                                            {new Date(transaction.createdAt).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "font-mono text-xs tabular-nums",
                                        isCredit && "text-emerald-500",
                                    )}>
                                        {isCredit ? "+" : "−"}
                                        {showMoney(Math.abs(amount), 6)}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="border-t border-border/30 px-5 py-6 text-xs text-muted-foreground">
                            No credit activity yet.
                        </div>
                    )}
                </div>
            </div>

            <AddCreditsDialog orgId={orgId} open={dialogOpen} onOpenChange={setDialogOpen} />
        </section>
    );
}
