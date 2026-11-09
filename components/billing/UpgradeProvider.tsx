"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LOG_RETENTION_RANGE, type SubscriptionTier } from "@/lib/entitlements";

const UpgradeDialog = dynamic(
    () => import("@/components/billing/UpgradeDialog").then((module) => module.UpgradeDialog),
    { ssr: false },
);

/**
 * One upgrade dialog for the whole console. Anything inside the org layout can
 * open it with useUpgrade().openUpgrade(), so a Free user can pay for Pro from
 * wherever they meet a limit, without each page mounting its own checkout.
 */

export interface UpgradeOrg {
    id: string;
    slug: string;
    name?: string;
    tier: string | null | undefined;
    /** Business accounts buy conversation plans, not Pro. */
    accountType?: string | null;
}

interface UpgradeContextValue {
    /** The org's plan ('free' when unknown). */
    tier: SubscriptionTier;
    /** True on Free: there's a Pro to buy. */
    canUpgrade: boolean;
    openUpgrade: () => void;
    /** Load the checkout ahead of a likely click (hover/focus). */
    preloadUpgrade: () => void;
}

const UpgradeContext = createContext<UpgradeContextValue>({
    tier: "free",
    canUpgrade: false,
    openUpgrade: () => {},
    preloadUpgrade: () => {},
});

export function UpgradeProvider({ org, children }: { org: UpgradeOrg | null | undefined; children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [preload, setPreload] = useState(false);
    // Local development only: ?preview_plan=free shows the console as another plan would.
    const [preview] = useState<string | null>(() => {
        if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return null;
        const value = new URLSearchParams(window.location.search).get("preview_plan");
        return value && ["free", "pro", "team", "enterprise"].includes(value) ? value : null;
    });
    const tier = (preview ?? org?.tier ?? "free") as SubscriptionTier;
    const canUpgrade = Boolean(org) && tier === "free" && org?.accountType !== "business";

    const openUpgrade = useCallback(() => {
        if (canUpgrade) setOpen(true);
    }, [canUpgrade]);
    const preloadUpgrade = useCallback(() => setPreload(true), []);

    const value = useMemo(() => ({ tier, canUpgrade, openUpgrade, preloadUpgrade }), [tier, canUpgrade, openUpgrade, preloadUpgrade]);

    return (
        <UpgradeContext.Provider value={value}>
            {children}
            {org && canUpgrade && (open || preload) && (
                <UpgradeDialog
                    open={open}
                    onOpenChange={setOpen}
                    orgId={org.id}
                    orgSlug={org.slug}
                    orgName={org.name}
                    currentTier="free"
                    recommendedTier="pro"
                    checkoutMode="direct"
                    preload={open || preload}
                />
            )}
        </UpgradeContext.Provider>
    );
}

export function useUpgrade(): UpgradeContextValue {
    return useContext(UpgradeContext);
}

/** The longest history the org's plan keeps, for locking longer ranges in the UI. */
export function useRetentionLimit(): string {
    const { tier } = useUpgrade();
    return LOG_RETENTION_RANGE[tier] ?? LOG_RETENTION_RANGE.free;
}

const RANGE_ORDER = ['1h', '24h', '7d', '30d', '90d', 'all'];

/**
 * Which plan a history range needs, or null when the org's plan includes it.
 * Ranges past Pro's 30 days are Enterprise.
 */
export function useRangeLock(): (range: string) => 'pro' | 'enterprise' | null {
    const max = useRetentionLimit();
    const proMax = LOG_RETENTION_RANGE.pro;
    return (range: string) => {
        const at = RANGE_ORDER.indexOf(range);
        if (at === -1 || at <= RANGE_ORDER.indexOf(max)) return null;
        return at <= RANGE_ORDER.indexOf(proMax) ? 'pro' : 'enterprise';
    };
}

