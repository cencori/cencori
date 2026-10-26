"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface BusinessPlanInfo {
    account_type: "developer" | "business";
    plan: { id: string; name: string; conversations: number; agents: number; all_models: boolean; price_ngn: number } | null;
    status: "active" | "past_due" | "canceled" | null;
    active: boolean;
    period_start: string | null;
    period_end: string | null;
    conversations_used: number;
    plans: Array<{ id: "starter" | "growth" | "business"; name: string; price_ngn: number; conversations: number; agents: number; all_models: boolean }>;
}

export const businessPlanQueryKey = (orgId: string | null | undefined) => ["businessPlan", orgId ?? null];

/** The organization's business plan, or account_type 'developer' for everyone else. */
export function useBusinessPlan(orgId: string | null | undefined) {
    return useQuery({
        queryKey: businessPlanQueryKey(orgId),
        enabled: !!orgId,
        queryFn: async () => {
            const response = await fetch(`/api/billing/business?orgId=${encodeURIComponent(orgId!)}`, { cache: "no-store" });
            if (!response.ok) throw new Error("Could not load the plan");
            return response.json() as Promise<BusinessPlanInfo>;
        },
        staleTime: 30 * 1000,
    });
}

const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });

/**
 * Billing for a business: the plan, conversations used this period, and the
 * three plans to buy or renew (30 days, paid in naira).
 */
export function BusinessPlan({ orgId, data }: { orgId: string; data: BusinessPlanInfo }) {
    const [buying, setBuying] = useState<string | null>(null);
    const plan = data.plan;
    const limit = plan?.conversations ?? 0;
    const used = Math.min(data.conversations_used, limit);
    const share = limit > 0 ? used / limit : 0;
    const daysLeft = data.period_end ? Math.max(0, Math.ceil((Date.parse(data.period_end) - Date.now()) / 86_400_000)) : 0;

    const buy = async (planId: string) => {
        setBuying(planId);
        try {
            const response = await fetch("/api/billing/business", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId, action: "checkout", plan: planId }),
            });
            const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
            if (!response.ok || !result.url) throw new Error(result.error ?? "Couldn't open checkout.");
            window.location.href = result.url;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Couldn't open checkout.");
            setBuying(null);
        }
    };

    return (
        <>
            <section className="grid gap-6 border-t border-border/30 py-9 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
                <div>
                    <h2 className="text-sm font-medium">Plan</h2>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Conversations your agents can have this month.</p>
                </div>
                <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/20">
                    <div className="flex flex-col gap-4 bg-muted/50 p-5 sm:p-6">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-medium">{plan ? plan.name : "No plan"}</h3>
                            <span className={cn("text-[10px]", data.active ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                                {data.active ? (daysLeft <= 3 ? `ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : "active") : "ended"}
                            </span>
                        </div>
                        {plan && (
                            <div>
                                <div className="flex items-baseline justify-between text-xs">
                                    <span><span className="font-mono text-2xl font-medium tabular-nums">{used.toLocaleString()}</span> <span className="text-muted-foreground">of {limit.toLocaleString()} conversations</span></span>
                                    {data.period_end && <span className="text-muted-foreground">{data.active ? "Until" : "Ended"} {day(data.period_end)}</span>}
                                </div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/50">
                                    <div className={cn("h-full rounded-full", share >= 1 ? "bg-red-500" : share >= 0.8 ? "bg-orange-500" : "bg-emerald-500")} style={{ width: `${Math.round(share * 100)}%` }} />
                                </div>
                            </div>
                        )}
                        {(!data.active || share >= 1) && (
                            <p className="text-xs text-muted-foreground">
                                {data.active ? "You've used every conversation in your plan. Your agents won't start new chats until you renew or upgrade." : "Your agents aren't answering customers. Choose a plan to turn them back on."}
                            </p>
                        )}
                    </div>
                </div>
            </section>

            <section className="grid gap-6 border-t border-border/30 py-9 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
                <div>
                    <h2 className="text-sm font-medium">Plans</h2>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">30 days, paid in naira by card or bank transfer. Renewing early keeps your remaining days.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    {data.plans.map((option) => {
                        const current = plan?.id === option.id && data.active;
                        return (
                            <div key={option.id} className={cn("flex flex-col rounded-lg border p-4", current ? "border-foreground/30 bg-muted/40" : "border-border/40 bg-muted/20")}>
                                <p className="text-sm font-medium">{option.name}</p>
                                <p className="mt-1"><span className="font-mono text-lg font-medium tabular-nums">{naira(option.price_ngn)}</span> <span className="text-xs text-muted-foreground">/ 30 days</span></p>
                                <ul className="mt-3 flex-1 space-y-1 text-xs text-muted-foreground">
                                    <li>{option.conversations.toLocaleString()} conversations</li>
                                    <li>{option.agents} agent{option.agents === 1 ? "" : "s"}</li>
                                    <li>{option.all_models ? "Every model" : "DeepSeek V4 Flash"}</li>
                                </ul>
                                <Button className="mt-4 h-7 text-[11px]" variant={current ? "outline" : "default"} disabled={!!buying} onClick={() => void buy(option.id)}>
                                    {buying === option.id ? "Opening checkout…" : current ? "Renew" : "Choose"}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </section>
        </>
    );
}
