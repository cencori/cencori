"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
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

interface ScanPaywallDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payload: ScanPaywallPayload | null;
}

function getDialogCopy(payload: ScanPaywallPayload | null) {
    if (!payload) {
        return {
            title: "Upgrade for unlimited scans",
            description: "Choose a platform plan to continue.",
        };
    }

    const max = payload.limit?.max;
    const used = payload.limit?.used;

    if (payload.code === "SCAN_FREE_PROJECT_LIMIT_REACHED") {
        return {
            title: "Project import limit reached",
            description:
                typeof max === "number" && typeof used === "number"
                    ? `You have imported ${used} of ${max} projects on the free tier. Upgrade for unlimited imports.`
                    : "You have reached the free project import limit. Upgrade for unlimited imports.",
        };
    }

    if (payload.code === "SCAN_FREE_SCAN_LIMIT_REACHED") {
        return {
            title: "Scan limit reached",
            description:
                typeof max === "number" && typeof used === "number"
                    ? `You have used ${used} of ${max} scans for this project on the free tier. Upgrade for unlimited scans.`
                    : "You have reached the free scan limit for this project. Upgrade for unlimited scans.",
        };
    }

    return {
        title: "Upgrade for unlimited scans",
        description: payload.error || "Choose a platform plan to continue using scan workflows.",
    };
}

export function ScanPaywallDialog({ open, onOpenChange, payload }: ScanPaywallDialogProps) {
    const copy = useMemo(() => getDialogCopy(payload), [payload]);

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
                        <p className="text-sm font-semibold">Pro</p>
                        <p className="mt-1 text-2xl font-semibold">
                            $29<span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                        <ul className="mt-3 space-y-1.5">
                            <li className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Check className="h-3.5 w-3.5 text-foreground" />
                                Unlimited projects and scans
                            </li>
                            <li className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Check className="h-3.5 w-3.5 text-foreground" />
                                Full security pipeline
                            </li>
                        </ul>
                        <Button
                            className="mt-4 h-8 w-full text-xs"
                            variant="outline"
                            onClick={() => { window.location.href = "/pricing"; }}
                        >
                            View Pro
                        </Button>
                    </article>

                    <article className="rounded-md border border-foreground/25 bg-card p-4">
                        <p className="text-sm font-semibold">Team</p>
                        <p className="mt-1 text-2xl font-semibold">
                            $99<span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                        <ul className="mt-3 space-y-1.5">
                            <li className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Check className="h-3.5 w-3.5 text-foreground" />
                                Everything in Pro
                            </li>
                            <li className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Check className="h-3.5 w-3.5 text-foreground" />
                                Team seats and collaboration
                            </li>
                        </ul>
                        <Button
                            className="mt-4 h-8 w-full text-xs"
                            onClick={() => { window.location.href = "/pricing"; }}
                        >
                            View Team
                        </Button>
                    </article>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-5 py-3">
                    <p className="text-[11px] text-muted-foreground">
                        Standalone Scan plans are deprecated. Pro and Team include unlimited scan access.
                    </p>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
                        Continue
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
