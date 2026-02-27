export interface ScanPaywallEntitlement {
    hasScanAccess?: boolean;
    source?: "platform" | "scan_subscription" | "free" | null;
    platformTier?: "pro" | "team" | "enterprise" | null;
    scanTier?: "scan" | "scan_team" | null;
    scanStatus?: string | null;
    plan?: "free" | "scan" | "scan_team" | "pro" | "team" | "enterprise";
    limits?: {
        maxProjects?: number | null;
        maxScansPerProject?: number | null;
    };
    usage?: {
        projectsImported?: number | null;
        remainingProjectImports?: number | null;
    };
}

export interface ScanPaywallPayload {
    error?: string;
    code?: string;
    upgradeUrl?: string;
    entitlement?: ScanPaywallEntitlement;
    limit?: {
        type?: "project_imports" | "scan_runs_per_project";
        max?: number | null;
        used?: number | null;
        projectId?: string;
    };
}

export const SCAN_PAYWALL_EVENT = "scan:paywall";

export async function extractScanPaywallPayload(response: Response): Promise<ScanPaywallPayload | null> {
    if (response.status !== 402) {
        return null;
    }

    try {
        const payload = await response.json();
        return (payload || {}) as ScanPaywallPayload;
    } catch {
        return {
            error: "Scan subscription required",
            code: "SCAN_SUBSCRIPTION_REQUIRED",
            upgradeUrl: "/scan?upgrade=scan",
        };
    }
}

export function emitScanPaywall(payload: ScanPaywallPayload) {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(
        new CustomEvent<ScanPaywallPayload>(SCAN_PAYWALL_EVENT, {
            detail: payload,
        })
    );
}

export async function openScanPaywallFromResponse(response: Response): Promise<boolean> {
    const payload = await extractScanPaywallPayload(response);
    if (!payload) {
        return false;
    }

    emitScanPaywall(payload);
    return true;
}

