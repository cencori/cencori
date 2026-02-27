import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

export type ScanStandaloneTier = "scan" | "scan_team";
type EntitlementSource = "platform" | "scan_subscription" | null;

interface OrganizationRow {
    id: string;
    subscription_tier: string | null;
    subscription_status: string | null;
}

interface ScanSubscriptionRow {
    scan_tier: ScanStandaloneTier;
    status: string | null;
}

export interface ScanEntitlement {
    hasScanAccess: boolean;
    source: EntitlementSource;
    platformTier: "pro" | "team" | "enterprise" | null;
    scanTier: ScanStandaloneTier | null;
    scanStatus: string | null;
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const PLATFORM_TIERS = new Set(["pro", "team", "enterprise"]);
const PLATFORM_TIER_PRIORITY: Record<"pro" | "team" | "enterprise", number> = {
    pro: 1,
    team: 2,
    enterprise: 3,
};

function normalizeStatus(status: string | null | undefined): string {
    return (status || "active").toLowerCase();
}

function normalizePlatformTier(
    tier: string | null | undefined
): "pro" | "team" | "enterprise" | null {
    const normalized = (tier || "").toLowerCase();
    if (normalized === "pro" || normalized === "team" || normalized === "enterprise") {
        return normalized;
    }
    return null;
}

function isActiveStatus(status: string | null | undefined): boolean {
    return ACTIVE_SUBSCRIPTION_STATUSES.has(normalizeStatus(status));
}

function highestPlatformTier(organizations: OrganizationRow[]): "pro" | "team" | "enterprise" | null {
    let best: "pro" | "team" | "enterprise" | null = null;

    for (const org of organizations) {
        const tier = normalizePlatformTier(org.subscription_tier);
        if (!tier || !PLATFORM_TIERS.has(tier)) {
            continue;
        }

        if (!isActiveStatus(org.subscription_status)) {
            continue;
        }

        if (!best || PLATFORM_TIER_PRIORITY[tier] > PLATFORM_TIER_PRIORITY[best]) {
            best = tier;
        }
    }

    return best;
}

export async function getScanEntitlementForUser(userId: string): Promise<ScanEntitlement> {
    const supabaseAdmin = createAdminClient();

    const [{ data: ownedOrgs, error: ownedOrgsError }, { data: memberships, error: membershipsError }] = await Promise.all([
        supabaseAdmin
            .from("organizations")
            .select("id, subscription_tier, subscription_status")
            .eq("owner_id", userId),
        supabaseAdmin
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", userId),
    ]);

    if (ownedOrgsError) {
        throw new Error(`Failed to resolve owned organizations: ${ownedOrgsError.message}`);
    }
    if (membershipsError) {
        throw new Error(`Failed to resolve organization memberships: ${membershipsError.message}`);
    }

    const organizationMap = new Map<string, OrganizationRow>();
    for (const org of ownedOrgs || []) {
        organizationMap.set(org.id, org as OrganizationRow);
    }

    const membershipOrgIds = Array.from(
        new Set((memberships || []).map((membership) => membership.organization_id).filter((id): id is string => typeof id === "string"))
    );

    if (membershipOrgIds.length > 0) {
        const { data: membershipOrgs, error: membershipOrgsError } = await supabaseAdmin
            .from("organizations")
            .select("id, subscription_tier, subscription_status")
            .in("id", membershipOrgIds);

        if (membershipOrgsError) {
            throw new Error(`Failed to resolve membership organizations: ${membershipOrgsError.message}`);
        }

        for (const org of membershipOrgs || []) {
            organizationMap.set(org.id, org as OrganizationRow);
        }
    }

    const platformTier = highestPlatformTier(Array.from(organizationMap.values()));
    if (platformTier) {
        return {
            hasScanAccess: true,
            source: "platform",
            platformTier,
            scanTier: null,
            scanStatus: "active",
        };
    }

    const { data: scanSubscription, error: scanSubscriptionError } = await supabaseAdmin
        .from("scan_subscriptions")
        .select("scan_tier, status")
        .eq("user_id", userId)
        .maybeSingle();

    if (scanSubscriptionError) {
        throw new Error(`Failed to resolve scan subscription: ${scanSubscriptionError.message}`);
    }

    const typedScanSubscription = scanSubscription as ScanSubscriptionRow | null;
    if (typedScanSubscription && isActiveStatus(typedScanSubscription.status)) {
        return {
            hasScanAccess: true,
            source: "scan_subscription",
            platformTier: null,
            scanTier: typedScanSubscription.scan_tier,
            scanStatus: typedScanSubscription.status || "active",
        };
    }

    return {
        hasScanAccess: false,
        source: null,
        platformTier: null,
        scanTier: typedScanSubscription?.scan_tier || null,
        scanStatus: typedScanSubscription?.status || null,
    };
}

export function createScanPaywallResponse(entitlement: ScanEntitlement) {
    return NextResponse.json(
        {
            error: "Scan subscription required",
            code: "SCAN_SUBSCRIPTION_REQUIRED",
            entitlement,
            upgradeUrl: "/scan?upgrade=scan",
        },
        { status: 402 }
    );
}

export async function getScanPaywallForUser(userId: string): Promise<NextResponse | null> {
    const entitlement = await getScanEntitlementForUser(userId);
    if (entitlement.hasScanAccess) {
        return null;
    }

    return createScanPaywallResponse(entitlement);
}
