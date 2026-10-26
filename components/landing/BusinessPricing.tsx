"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS_PLANS, BUSINESS_TRIAL_DAYS, PAID_BUSINESS_PLANS } from "@/lib/business/plans";
import { cn } from "@/lib/utils";
import { getConsoleUrl } from "@/lib/auth-redirect";

const DESCRIPTIONS: Record<(typeof PAID_BUSINESS_PLANS)[number], string> = {
    starter: "For one location getting started on WhatsApp.",
    growth: "For busy businesses answering customers all day.",
    business: "For several locations or teams, with every model.",
};

/**
 * Pricing for businesses that run agents (restaurants, shops): a flat naira
 * price per month for a number of conversations. No tokens, no credits.
 */
export function BusinessPricing({ signupHref }: { signupHref?: string } = {}) {
    const trial = BUSINESS_PLANS.trial;
    return (
        <div className="mb-16">
            <div className="mx-auto mb-8 max-w-2xl text-center">
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">For your business</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                    An agent that answers your customers on WhatsApp and your website, takes bookings and orders. One monthly price,
                    counted in conversations. Free for {BUSINESS_TRIAL_DAYS} days or {trial.conversations} conversations, no card needed.
                </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {PAID_BUSINESS_PLANS.map((id) => {
                    const plan = BUSINESS_PLANS[id];
                    const featured = id === "growth";
                    return (
                        <article key={id} className={cn("flex flex-col rounded-2xl border bg-background/95 p-6 backdrop-blur-sm", featured ? "border-foreground/30" : "border-border/50")}>
                            <p className="text-sm font-semibold">{plan.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{DESCRIPTIONS[id]}</p>
                            <p className="mt-5"><span className="text-3xl font-semibold tracking-tight">₦{plan.priceNgn.toLocaleString("en-NG")}</span> <span className="text-xs text-muted-foreground">/ month</span></p>
                            <ul className="mt-5 flex-1 space-y-2 text-sm">
                                {[
                                    `${plan.conversations.toLocaleString()} conversations a month`,
                                    `${plan.agents} agent${plan.agents === 1 ? "" : "s"}`,
                                    "WhatsApp, website chat and share link",
                                    "Bookings, payments and orders",
                                    plan.allModels ? "Every AI model" : "DeepSeek V4 Flash",
                                ].map((feature) => (
                                    <li key={feature} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{feature}</li>
                                ))}
                            </ul>
                            <Button asChild className="mt-6 h-9 text-xs" variant={featured ? "default" : "outline"}>
                                <Link href={signupHref ?? getConsoleUrl("/signup?for=business")}><span className="inline-flex items-center gap-1.5">Start free trial <ArrowRight className="h-3 w-3" /></span></Link>
                            </Button>
                        </article>
                    );
                })}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">A conversation is one customer chat: up to 40 messages, or until a day of quiet.</p>
        </div>
    );
}
