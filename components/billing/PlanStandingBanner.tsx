"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { planState, PRO_GRACE_DAYS, type OrgPlanColumns } from "@/lib/billing/plan-state";
import { useUpgrade } from "@/components/billing/UpgradeProvider";

/**
 * A thin bar at the top of the console when the org's plan isn't in good
 * standing: an extra org that needs Pro (one Free org per person), a lapsed
 * Pro subscription in its grace period, or projects paused after it.
 */
export function PlanStandingBanner({ org, orgSlug }: { org: (OrgPlanColumns & { id?: string }) | null | undefined; orgSlug: string }) {
    const upgrade = useUpgrade();
    const isFree = (org?.subscription_tier ?? "free") === "free" && org?.account_type !== "business";

    // Read on its own, and a read error means "not required": the column may
    // not be on this database yet, and the rule must never take an org down.
    const { data: requiresPro } = useQuery({
        queryKey: ["orgRequiresPro", org?.id],
        enabled: Boolean(org?.id) && isFree,
        staleTime: 60_000,
        queryFn: async () => {
            const { data, error } = await supabase.from("organizations").select("requires_pro").eq("id", org!.id!).maybeSingle();
            return !error && (data as { requires_pro?: boolean } | null)?.requires_pro === true;
        },
    });

    const state = planState(org ? { ...org, requires_pro: requiresPro === true } : org);

    // An extra org that needs Pro: offer the checkout as soon as it opens (once per visit).
    const offered = useRef(false);
    useEffect(() => {
        if (state.reason === "pro_required" && upgrade.canUpgrade && !offered.current) {
            offered.current = true;
            upgrade.openUpgrade();
        }
    }, [state.reason, upgrade]);

    if (state.standing === "active") return null;

    if (state.reason === "pro_required") {
        return (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-700 dark:text-red-300">
                <span>This organization needs Pro. Everyone gets one Free organization; others are on Pro. Its projects stay paused until it&apos;s upgraded.</span>
                <button type="button" onClick={upgrade.openUpgrade} onMouseEnter={upgrade.preloadUpgrade} className="shrink-0 font-medium underline underline-offset-2">
                    Upgrade to Pro
                </button>
            </div>
        );
    }

    const paused = state.standing === "paused";
    const ends = state.graceEndsAt ? new Date(state.graceEndsAt) : null;
    const daysLeft = ends ? Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86_400_000)) : PRO_GRACE_DAYS;
    const when = ends ? ends.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

    const message = paused
        ? state.reason === "payment_failed"
            ? "Your projects are paused: the Pro payment failed and the grace period has ended. API requests are refused until it's paid."
            : "Your projects are paused: the Pro subscription ended and the grace period is over. API requests are refused until you renew."
        : state.reason === "payment_failed"
            ? `The Pro payment failed. Update your payment method within ${daysLeft} day${daysLeft === 1 ? "" : "s"} (by ${when}) or your projects will pause.`
            : `Your Pro subscription has ended. Renew within ${daysLeft} day${daysLeft === 1 ? "" : "s"} (by ${when}) or your projects will pause.`;

    return (
        <div
            role="alert"
            className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-4 py-2 text-xs ${paused
                ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"}`}
        >
            <span>{message}</span>
            <Link href={`/${orgSlug}/~/billing`} className="shrink-0 font-medium underline underline-offset-2">
                {state.reason === "payment_failed" ? "Update payment" : "Renew Pro"}
            </Link>
        </div>
    );
}
