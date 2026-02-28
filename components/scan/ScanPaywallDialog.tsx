"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { ScanPaywallPayload } from "@/lib/scan/paywall-client";

type ScanCheckoutTier = "scan" | "scan_team";

interface ScanPaywallDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payload: ScanPaywallPayload | null;
}

const SCAN_BASE_URL = "https://scan.cencori.com";
const SCAN_SIGNUP_URL = `${SCAN_BASE_URL}/signup?redirect=${encodeURIComponent(SCAN_BASE_URL)}`;

function getDialogCopy(payload: ScanPaywallPayload | null) {
    if (!payload) {
        return {
            title: "Upgrade Scan",
            description: "Choose a scan plan to continue.",
        };
    }

    const max = payload.limit?.max;
    const used = payload.limit?.used;

    if (payload.code === "SCAN_FREE_PROJECT_LIMIT_REACHED") {
        return {
            title: "Project import limit reached",
            description:
                typeof max === "number" && typeof used === "number"
                    ? `You have imported ${used} of ${max} projects on Scan Free. Upgrade for unlimited imports.`
                    : "You have reached the Scan Free project import limit. Upgrade for unlimited imports.",
        };
    }

    if (payload.code === "SCAN_FREE_SCAN_LIMIT_REACHED") {
        return {
            title: "Scan limit reached",
            description:
                typeof max === "number" && typeof used === "number"
                    ? `You have used ${used} of ${max} scans for this project on Scan Free. Upgrade for unlimited scans.`
                    : "You have reached the Scan Free scan limit for this project. Upgrade for unlimited scans.",
        };
    }

    return {
        title: "Upgrade Scan",
        description: payload.error || "Choose a scan plan to continue using scan workflows.",
    };
}

export function ScanPaywallDialog({ open, onOpenChange, payload }: ScanPaywallDialogProps) {
    const [loadingTier, setLoadingTier] = useState<ScanCheckoutTier | null>(null);
    const [error, setError] = useState<string | null>(null);
    const copy = useMemo(() => getDialogCopy(payload), [payload]);

    const handleCheckout = async (tier: ScanCheckoutTier) => {
        setLoadingTier(tier);
        setError(null);

        try {
            const response = await fetch("/api/billing/scan/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tier }),
            });

            if (response.status === 401) {
                window.location.href = SCAN_SIGNUP_URL;
                return;
            }

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.checkoutUrl) {
                throw new Error(data?.error || "Failed to start checkout");
            }

            window.location.href = data.checkoutUrl;
        } catch (checkoutError) {
            setError(
                checkoutError instanceof Error ? checkoutError.message : "Failed to start checkout"
            );
        } finally {
            setLoadingTier(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl border border-border/50 bg-background/95 p-0">
                <div className="border-b border-border/40 px-5 py-4">
                    <Badge variant="outline" className="mb-2 text-[10px] uppercase tracking-wide">
                        Scan Plan
                    </Badge>
                    <DialogHeader className="space-y-1 text-left">
                        <DialogTitle className="flex items-center gap-2 text-base">
                            {copy.title}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            {copy.description}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="grid gap-3 p-5 md:grid-cols-2">
                    <article className="rounded-md border border-border/50 bg-card p-4">
                        <p className="text-sm font-semibold">Scan</p>
                        <p className="mt-1 text-2xl font-semibold">
                            $9<span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                        <ul className="mt-3 space-y-1.5">
                            <li className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Check className="h-3.5 w-3.5 text-foreground" />
                                Unlimited repository imports
                            </li>
                            <li className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Check className="h-3.5 w-3.5 text-foreground" />
                                Unlimited scans per project
                            </li>
                        </ul>
                        <Button
                            className="mt-4 h-8 w-full text-xs"
                            variant="outline"
                            disabled={loadingTier === "scan"}
                            onClick={() => handleCheckout("scan")}
                        >
                            {loadingTier === "scan" ? "Redirecting..." : "Get Scan"}
                        </Button>
                    </article>

                    <article className="rounded-md border border-foreground/25 bg-card p-4">
                        <p className="text-sm font-semibold">Scan Teams</p>
                        <p className="mt-1 text-2xl font-semibold">
                            $29<span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                        <ul className="mt-3 space-y-1.5">
                            <li className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Check className="h-3.5 w-3.5 text-foreground" />
                                Everything in Scan
                            </li>
                            <li className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Check className="h-3.5 w-3.5 text-foreground" />
                                Team workflows and priority support
                            </li>
                        </ul>
                        <Button
                            className="mt-4 h-8 w-full text-xs"
                            disabled={loadingTier === "scan_team"}
                            onClick={() => handleCheckout("scan_team")}
                        >
                            {loadingTier === "scan_team" ? "Redirecting..." : "Get Scan Teams"}
                        </Button>
                    </article>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-5 py-3">
                    <p className="text-[11px] text-muted-foreground">
                        Pro, Team, and Enterprise plans include unlimited scan access.
                    </p>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
                        Continue
                    </Button>
                </div>

                {error && <p className="px-5 pb-4 text-xs text-red-400">{error}</p>}
            </DialogContent>
        </Dialog>
    );
}

