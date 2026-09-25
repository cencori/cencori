"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ScanUpgradePanelProps {
    className?: string;
    title?: string;
    description?: string;
}

export function ScanUpgradePanel({
    className,
    title = "Upgrade Scan",
    description = "Free Scan includes 5 project imports and 2 scans per project. Upgrade to a platform plan for unlimited scan workflows.",
}: ScanUpgradePanelProps) {
    return (
        <section className={cn("rounded-xl border border-border/50 bg-card p-5 sm:p-6", className)}>
            <div className="mb-5">
                <Badge variant="outline" className="mb-2 text-[10px] uppercase tracking-wide">
                    Scan Pricing
                </Badge>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                    Standalone Scan plans are deprecated. Platform <strong>Pro</strong> ($29/mo) and{" "}
                    <strong>Team</strong> ($99/mo) include unlimited scan access.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <article className="rounded-lg border border-border/50 bg-background/70 p-4">
                    <div className="mb-3">
                        <p className="text-sm font-semibold">Pro</p>
                        <p className="mt-1 text-2xl font-semibold">
                            $29
                            <span className="ml-1 text-sm font-normal text-muted-foreground">/month</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">For developers shipping production AI workloads.</p>
                    </div>

                    <ul className="mb-4 space-y-1.5">
                        {["Unlimited projects and scans", "Full security pipeline", "Priority support"].map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>

                    <Button
                        className="h-8 w-full text-xs"
                        variant="outline"
                        onClick={() => { window.location.href = "/pricing"; }}
                    >
                        View Pro
                    </Button>
                </article>

                <article className="rounded-lg border border-foreground/30 bg-background/70 p-4">
                    <div className="mb-3">
                        <p className="text-sm font-semibold">Team</p>
                        <p className="mt-1 text-2xl font-semibold">
                            $99
                            <span className="ml-1 text-sm font-normal text-muted-foreground">/month</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">For teams operating AI systems at scale.</p>
                    </div>

                    <ul className="mb-4 space-y-1.5">
                        {["Everything in Pro", "Team seats and collaboration", "24/7 priority support"].map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>

                    <Button
                        className="h-8 w-full text-xs"
                        onClick={() => { window.location.href = "/pricing"; }}
                    >
                        View Team
                    </Button>
                </article>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <span>Need full platform features too?</span>
                <Link className="underline underline-offset-2 hover:text-foreground" href="/#pricing">
                    View platform plans
                </Link>
            </div>
        </section>
    );
}
