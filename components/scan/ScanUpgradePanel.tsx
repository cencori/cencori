"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ScanCheckoutTier = "scan" | "scan_team";

type ScanPlan = {
    tier: ScanCheckoutTier;
    title: string;
    price: string;
    subtitle: string;
    description: string;
    cta: string;
    highlighted?: boolean;
    features: string[];
};

const scanPlans: ScanPlan[] = [
    {
        tier: "scan",
        title: "Scan",
        price: "$9",
        subtitle: "/month",
        description: "For solo engineers who need unlimited scan workflows.",
        cta: "Get Scan",
        features: [
            "Unlimited repository imports",
            "Unlimited scans per project",
            "Generate AI fix proposals",
            "Create remediation pull requests",
            "Security chat workspace",
        ],
    },
    {
        tier: "scan_team",
        title: "Scan Teams",
        price: "$29",
        subtitle: "/month",
        description: "For teams that need shared, unlimited secure delivery workflows.",
        cta: "Get Scan Teams",
        highlighted: true,
        features: [
            "Everything in Scan",
            "Team-oriented scan workflows",
            "Shared remediation and changelog flows",
            "Priority support for scan operations",
        ],
    },
];

interface ScanUpgradePanelProps {
    className?: string;
    title?: string;
    description?: string;
}

export function ScanUpgradePanel({
    className,
    title = "Upgrade Scan",
    description = "Free Scan includes 5 project imports and 2 scans per project. Upgrade for unlimited scan workflows.",
}: ScanUpgradePanelProps) {
    const [loadingTier, setLoadingTier] = useState<ScanCheckoutTier | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCheckout = async (tier: ScanCheckoutTier) => {
        setLoadingTier(tier);
        setError(null);

        try {
            const response = await fetch("/api/billing/scan/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tier }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.checkoutUrl) {
                throw new Error(data?.error || "Failed to start checkout");
            }

            window.location.href = data.checkoutUrl;
        } catch (checkoutError) {
            setError(checkoutError instanceof Error ? checkoutError.message : "Failed to start checkout");
        } finally {
            setLoadingTier(null);
        }
    };

    return (
        <section className={cn("rounded-xl border border-border/50 bg-card p-5 sm:p-6", className)}>
            <div className="mb-5">
                <Badge variant="outline" className="mb-2 text-[10px] uppercase tracking-wide">
                    Scan Pricing
                </Badge>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                    Already on platform <strong>Pro</strong>, <strong>Team</strong>, or <strong>Enterprise</strong>? You already have full scan access.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                {scanPlans.map((plan) => (
                    <article
                        key={plan.tier}
                        className={cn(
                            "rounded-lg border border-border/50 bg-background/70 p-4",
                            plan.highlighted && "border-foreground/30"
                        )}
                    >
                        <div className="mb-3">
                            <p className="text-sm font-semibold">{plan.title}</p>
                            <p className="mt-1 text-2xl font-semibold">
                                {plan.price}
                                <span className="ml-1 text-sm font-normal text-muted-foreground">{plan.subtitle}</span>
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                        </div>

                        <ul className="mb-4 space-y-1.5">
                            {plan.features.map((feature) => (
                                <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <Button
                            className="h-8 w-full text-xs"
                            variant={plan.highlighted ? "default" : "outline"}
                            disabled={loadingTier === plan.tier}
                            onClick={() => handleCheckout(plan.tier)}
                        >
                            {loadingTier === plan.tier ? "Redirecting..." : plan.cta}
                        </Button>
                    </article>
                ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <span>Need full platform features too?</span>
                <Link className="underline underline-offset-2 hover:text-foreground" href="/#pricing">
                    View platform plans
                </Link>
            </div>

            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </section>
    );
}
