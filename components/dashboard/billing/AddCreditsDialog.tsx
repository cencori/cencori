"use client";

import React from "react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import {
    CARD_TOPUP_FEE_PERCENT,
    CREDIT_NGN_PER_USD,
    CRYPTO_TOPUP_FEE_PERCENT,
    NGN_TOPUP_MAX,
    NGN_TOPUP_MIN,
    netTopupCredits,
    ngnTopupCredits,
    parseNgnTopupAmount,
} from "@/lib/billing/credit-pricing";

type PaymentMethod = "card" | "crypto";
type PackId = "starter" | "growth" | "scale";

// Same three sizes in both currencies: the naira presets are the dollar
// packs at the naira credit rate.
const PACKS: Array<{ id: PackId; usd: number }> = [
    { id: "starter", usd: 10 },
    { id: "growth", usd: 50 },
    { id: "scale", usd: 200 },
];
const NGN_PRESETS = PACKS.map((pack) => pack.usd * CREDIT_NGN_PER_USD);

const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;

const chipClass = (active: boolean) =>
    cn(
        "flex h-14 flex-col items-start justify-center rounded-md border px-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
        active
            ? "border-foreground/60 bg-foreground/[0.06]"
            : "border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50",
    );

interface AddCreditsDialogProps {
    orgId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddCreditsDialog({ orgId, open, onOpenChange }: AddCreditsDialogProps) {
    const { currency, formatMoney } = useDisplayCurrency();
    const [method, setMethod] = React.useState<PaymentMethod>("card");
    const [amountInput, setAmountInput] = React.useState(String(NGN_PRESETS[0]));
    const [pack, setPack] = React.useState<PackId>("growth");
    const [submitting, setSubmitting] = React.useState(false);

    // Naira card payments take any amount. Crypto, and dollar mode, use packs.
    const nairaMode = currency === "NGN" && method === "card";
    const amountNgn = parseNgnTopupAmount(amountInput);
    const typedNgn = Number(amountInput || 0);
    const feePercent = method === "card" ? CARD_TOPUP_FEE_PERCENT : CRYPTO_TOPUP_FEE_PERCENT;
    const selectedPack = PACKS.find((item) => item.id === pack) ?? PACKS[1];

    const amountError = !nairaMode || amountNgn !== null
        ? null
        : !amountInput
            ? "Enter an amount"
            : typedNgn < NGN_TOPUP_MIN
                ? `Minimum is ${naira(NGN_TOPUP_MIN)}`
                : `Maximum is ${naira(NGN_TOPUP_MAX)}`;

    const creditPreview = nairaMode
        ? amountNgn !== null ? formatMoney(ngnTopupCredits(amountNgn)) : null
        : formatMoney(netTopupCredits(selectedPack.usd, feePercent));

    const submit = async () => {
        if (submitting) return;
        if (nairaMode && amountNgn === null) return;
        setSubmitting(true);
        try {
            const endpoint = method === "card"
                ? "/api/billing/credits/checkout"
                : "/api/billing/credits/crypto-checkout";
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nairaMode ? { orgId, amountNgn } : { orgId, pack }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.checkoutUrl) {
                throw new Error(data?.error || data?.details || "Failed to start credits checkout");
            }
            window.location.href = data.checkoutUrl;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to start credits checkout");
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
            <DialogContent className="gap-0 overflow-hidden rounded-lg border-border/60 p-0 sm:max-w-[26rem]">
                <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12">
                    <DialogTitle className="text-sm font-medium">Add credits</DialogTitle>
                    <DialogDescription className="text-[11px] leading-5">
                        Prepaid balance for managed model usage.
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="space-y-5 px-5 py-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submit();
                    }}
                >
                    <div className="grid grid-cols-2 gap-0.5 rounded-md bg-muted/60 p-0.5" role="group" aria-label="Payment method">
                        {(["card", "crypto"] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setMethod(option)}
                                aria-pressed={method === option}
                                disabled={submitting}
                                className={cn(
                                    "h-7 rounded-[4px] text-[11px] font-medium transition-colors",
                                    method === option ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {option === "card" ? "Card or transfer" : "Crypto"}
                            </button>
                        ))}
                    </div>

                    {nairaMode && (
                        <div className="space-y-1.5">
                            <label htmlFor="credit-amount-ngn" className="text-[11px] text-muted-foreground">
                                Amount
                            </label>
                            <div
                                className={cn(
                                    "flex h-10 items-center gap-2 rounded-md border bg-muted/30 px-3 focus-within:ring-2 focus-within:ring-ring/15",
                                    amountError ? "border-destructive/60" : "border-border/50 focus-within:border-foreground/30",
                                )}
                            >
                                <span className="font-mono text-sm text-muted-foreground">₦</span>
                                <input
                                    id="credit-amount-ngn"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={amountInput ? Number(amountInput).toLocaleString("en-NG") : ""}
                                    onChange={(event) => setAmountInput(event.target.value.replace(/[^\d]/g, "").slice(0, 9))}
                                    disabled={submitting}
                                    placeholder={NGN_TOPUP_MIN.toLocaleString("en-NG")}
                                    aria-invalid={!!amountError}
                                    aria-describedby="credit-amount-help"
                                    className="min-w-0 flex-1 bg-transparent font-mono text-sm font-medium tabular-nums outline-none"
                                />
                            </div>
                            <p
                                id="credit-amount-help"
                                className={cn("text-[11px]", amountError ? "text-destructive" : "text-muted-foreground")}
                            >
                                {amountError ?? `Anything from ${naira(NGN_TOPUP_MIN)}.`}
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                        {nairaMode
                            ? NGN_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setAmountInput(String(preset))}
                                    aria-pressed={amountNgn === preset}
                                    disabled={submitting}
                                    className={chipClass(amountNgn === preset)}
                                >
                                    <span className="font-mono text-xs font-medium tabular-nums">{naira(preset)}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {formatMoney(ngnTopupCredits(preset))} credit
                                    </span>
                                </button>
                            ))
                            : PACKS.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setPack(item.id)}
                                    aria-pressed={pack === item.id}
                                    disabled={submitting}
                                    className={chipClass(pack === item.id)}
                                >
                                    <span className="font-mono text-xs font-medium tabular-nums">${item.usd}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {formatMoney(netTopupCredits(item.usd, feePercent))} credit
                                    </span>
                                </button>
                            ))}
                    </div>

                    <div className="flex items-baseline justify-between border-t border-border/40 pt-4">
                        <span className="text-xs text-muted-foreground">You get</span>
                        <span className="font-mono text-lg font-medium tabular-nums">
                            {creditPreview ?? "—"}
                        </span>
                    </div>

                    <Button
                        type="submit"
                        className="h-7 w-full rounded-md px-3 text-[11px] font-medium shadow-none"
                        disabled={submitting || (nairaMode && amountNgn === null)}
                    >
                        {submitting
                            ? "Opening checkout…"
                            : nairaMode && amountNgn !== null
                                ? `Pay ${naira(amountNgn)}`
                                : nairaMode
                                    ? "Continue"
                                    : `Pay $${selectedPack.usd}`}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
