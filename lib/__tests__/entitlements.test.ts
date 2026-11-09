import { describe, expect, it } from "vitest";

import { hasFeature } from "@/lib/entitlements";
import { featureGateResponse } from "@/lib/require-tier-feature";

describe("subscription entitlements", () => {
    it.each([
        "security",
        "piiMasking",
        "customDataRules",
        "outputScanning",
        "securityIncidents",
        "auditTrails",
    ] as const)("reserves %s for paid plans", (feature) => {
        expect(hasFeature("free", feature)).toBe(false);
        expect(hasFeature("pro", feature)).toBe(true);
        expect(hasFeature("team", feature)).toBe(true);
        expect(hasFeature("enterprise", feature)).toBe(true);
    });

    it("gates team collaboration from the free tier", () => {
        expect(hasFeature("free", "teams")).toBe(false);
    });

    it.each(["pro", "team", "enterprise"] as const)(
        "includes team collaboration on the %s tier",
        (tier) => {
            expect(hasFeature(tier, "teams")).toBe(true);
        },
    );

    it("keeps governance readable while gating governance controls from Free", () => {
        expect(hasFeature("free", "governanceControls")).toBe(false);
    });

    it("keeps organization-wide governance controls locked on Pro", () => {
        expect(hasFeature("pro", "governanceControls")).toBe(false);
    });

    it.each(["team", "enterprise"] as const)(
        "includes governance controls on the %s tier",
        (tier) => {
            expect(hasFeature(tier, "governanceControls")).toBe(true);
        },
    );

    it("gates organization audit logs from the free tier", () => {
        expect(hasFeature("free", "auditLogs")).toBe(false);
    });

    it.each(["pro", "team", "enterprise"] as const)(
        "includes organization audit logs on the %s tier",
        (tier) => {
            expect(hasFeature(tier, "auditLogs")).toBe(true);
        },
    );

    // Team folded into Pro (2026-11-09): its audit-log extras are Pro now.
    it.each(["auditLogIdentityEvents", "auditLogExtendedHistory"] as const)(
        "includes %s on Pro and up",
        (feature) => {
            expect(hasFeature("free", feature)).toBe(false);
            expect(hasFeature("pro", feature)).toBe(true);
            expect(hasFeature("team", feature)).toBe(true);
            expect(hasFeature("enterprise", feature)).toBe(true);
        },
    );

    // Sold as Enterprise-only on the pricing page; grandfathered Team orgs keep them.
    it.each(["auditLogExports", "sso", "governanceControls"] as const)(
        "reserves %s for Enterprise (and grandfathered Team)",
        (feature) => {
            expect(hasFeature("free", feature)).toBe(false);
            expect(hasFeature("pro", feature)).toBe(false);
            expect(hasFeature("team", feature)).toBe(true);
            expect(hasFeature("enterprise", feature)).toBe(true);
        },
    );

    it.each([
        "auditLogAllTimeHistory",
        "auditLogApiAccess",
        "auditLogSiemStreaming",
        "auditLogComplianceArchives",
        "governanceCustomFrameworks",
        "governanceAdvancedEvidence",
        "governanceBespokeControls",
    ] as const)("reserves %s for Enterprise", (feature) => {
        expect(hasFeature("free", feature)).toBe(false);
        expect(hasFeature("pro", feature)).toBe(false);
        expect(hasFeature("team", feature)).toBe(false);
        expect(hasFeature("enterprise", feature)).toBe(true);
    });

    it("returns the standard API contract for a gated audit-log request", async () => {
        const response = featureGateResponse("auditLogs");

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            error: "Organization audit log requires the Pro plan",
            code: "FEATURE_NOT_INCLUDED",
            required_tier: "pro",
            upgrade_url: "/billing",
        });
    });

    it("returns the standard API contract for a gated governance action", async () => {
        const response = featureGateResponse("governanceControls", "team");

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            error: "Governance control access requires the Enterprise plan",
            code: "FEATURE_NOT_INCLUDED",
            required_tier: "enterprise",
            upgrade_url: "/billing",
        });
    });

    it("points Team-tier features at Enterprise now that Team is no longer sold", async () => {
        const response = featureGateResponse("auditLogExtendedHistory", "team");

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            error: "Extended audit-log history requires the Enterprise plan",
            code: "FEATURE_NOT_INCLUDED",
            required_tier: "enterprise",
        });
    });

    it("returns an Enterprise-specific API contract for all-time history", async () => {
        const response = featureGateResponse("auditLogAllTimeHistory", "enterprise");

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            error: "All-time audit-log history requires the Enterprise plan",
            code: "FEATURE_NOT_INCLUDED",
            required_tier: "enterprise",
        });
    });

    it("returns an Enterprise-specific API contract for advanced evidence", async () => {
        const response = featureGateResponse("governanceAdvancedEvidence", "enterprise");

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            error: "Advanced governance evidence requires the Enterprise plan",
            code: "FEATURE_NOT_INCLUDED",
            required_tier: "enterprise",
        });
    });
});

describe("Free plan agent limits (pricing page, 2026-11-09)", () => {
    it("allows 1 agent, 1 running at once, 5 knowledge bases and 5 customers on Free", async () => {
        const { getEmbeddedLimits } = await import("../entitlements");
        expect(getEmbeddedLimits("free")).toMatchObject({ maxAgents: 1, maxConcurrentRuns: 1, maxKnowledgeBases: 5, maxTenants: 5 });
    });
    it("gives Pro 10 agents", async () => {
        const { getEmbeddedLimits } = await import("../entitlements");
        expect(getEmbeddedLimits("pro").maxAgents).toBe(10);
        expect(getEmbeddedLimits("pro")).toMatchObject({ maxConcurrentRuns: 10, maxKnowledgeBases: 100, maxTenants: 100 });
    });
});
