"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { FlagClient, FlagProvider, useFlagMeta } from "@flagswift/nextjs/client";
import { FLAGSWIFT_ENVIRONMENT, OBSERVABILITY_FLAG } from "@/lib/flags/constants";

// Feature flags come from FlagSwift (flagswift.com). The client key is public:
// it ships in the browser bundle. Without one there is no flag service to ask,
// so nothing is gated.
const API_KEY = process.env.NEXT_PUBLIC_FLAGSWIFT_API_KEY ?? "";

interface FeatureAccess {
    enabled: boolean;
    /** True until the first answer arrives and there is no remembered one. */
    loading: boolean;
}

const OPEN: FeatureAccess = { enabled: true, loading: false };
const ObservabilityAccessContext = createContext<FeatureAccess>(OPEN);

function hintKey(orgSlug: string) {
    return `cencori:flag:${OBSERVABILITY_FLAG}:${orgSlug}`;
}

/**
 * Resolves the flag once for everything below it. The last answer is
 * remembered per organization, so the sidebar doesn't flicker on reload and a
 * FlagSwift outage keeps whatever access the organization last had.
 */
function ObservabilityAccessBridge({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
    const { enabled, loading, error } = useFlagMeta(OBSERVABILITY_FLAG);
    const [hint, setHint] = useState<boolean | null>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(hintKey(orgSlug));
            setHint(stored === null ? null : stored === "1");
        } catch {
            setHint(null);
        }
    }, [orgSlug]);

    const resolved = !loading && !error;
    useEffect(() => {
        if (!resolved) return;
        setHint(enabled);
        try {
            localStorage.setItem(hintKey(orgSlug), enabled ? "1" : "0");
        } catch {
            // Storage unavailable: the flag still works, just without the memory.
        }
    }, [resolved, enabled, orgSlug]);

    const value = useMemo<FeatureAccess>(
        () => (resolved
            ? { enabled, loading: false }
            : { enabled: hint ?? false, loading: loading && hint === null }),
        [resolved, enabled, hint, loading],
    );

    return <ObservabilityAccessContext.Provider value={value}>{children}</ObservabilityAccessContext.Provider>;
}

export function FeatureFlagsProvider({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
    const client = useMemo(
        () => new FlagClient({
            apiKey: API_KEY,
            environment: FLAGSWIFT_ENVIRONMENT,
            userIdentifier: orgSlug || undefined,
            refreshInterval: 5 * 60 * 1000,
        }),
        [orgSlug],
    );

    if (!API_KEY) return <>{children}</>;

    return (
        <FlagProvider client={client}>
            <ObservabilityAccessBridge orgSlug={orgSlug}>{children}</ObservabilityAccessBridge>
        </FlagProvider>
    );
}

/** Whether this organization can open Observability. */
export function useObservabilityAccess(): FeatureAccess {
    return useContext(ObservabilityAccessContext);
}
