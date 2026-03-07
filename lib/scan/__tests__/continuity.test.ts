import { describe, expect, test } from "vitest";
import {
    buildAcceptedRiskMemory,
    buildProjectBriefMemory,
    buildScanSummaryMemory,
    extractRecurringWeakSpotMemories,
} from "@/lib/scan/continuity";
import type { ProjectBrief, ScanIssueLike } from "@/lib/scan/research";

const brief: ProjectBrief = {
    summary: "Next.js security scanning app with Supabase auth and Vercel deployment.",
    appPurpose: "Security scanning application for imported repositories.",
    authModel: "Supabase-backed authentication and user/session checks are present.",
    deploymentShape: "Next.js web app with server-rendered routes and API handlers.",
    trustBoundaries: ["Client-side flows cross into 4 server or API handler(s)."],
    sensitiveFlows: ["HTTP request body reaches Outbound network request in app/api/scan/route.ts:42"],
    criticalModules: ["app/api/scan/route.ts (api-route, score 22)"],
    externalServices: ["Supabase", "GitHub"],
    confidence: 0.81,
};

const recurringIssue: ScanIssueLike = {
    file: "app/api/scan/route.ts",
    severity: "high",
    name: "CORS Wildcard Origin",
    type: "cors_wildcard",
    line: 42,
};

describe("scan continuity", () => {
    test("buildProjectBriefMemory includes project identity fields", () => {
        const memory = buildProjectBriefMemory("cencori/demo", brief);

        expect(memory).toContain("Project brief for cencori/demo.");
        expect(memory).toContain("Auth model:");
        expect(memory).toContain("Sensitive flows:");
        expect(memory).toContain("Confidence 81%");
    });

    test("buildAcceptedRiskMemory summarizes outstanding findings", () => {
        const memory = buildAcceptedRiskMemory({
            repository: "cencori/demo",
            scanRunId: "12345678-1234-1234-1234-123456789abc",
            issues: [recurringIssue],
            projectBrief: brief,
        });

        expect(memory).toContain("Accepted risk recorded for cencori/demo");
        expect(memory).toContain("Outstanding findings:");
        expect(memory).toContain("Auth context:");
    });

    test("buildScanSummaryMemory captures top findings", () => {
        const memory = buildScanSummaryMemory({
            repository: "cencori/demo",
            scanRunId: "12345678-1234-1234-1234-123456789abc",
            score: "B",
            issues: [recurringIssue],
            summary: {
                vulnerabilities: 1,
                codeQuality: 2,
            },
            projectBrief: brief,
        });

        expect(memory).toContain("Score B.");
        expect(memory).toContain("Top findings:");
        expect(memory).toContain("Project identity:");
    });

    test("extractRecurringWeakSpotMemories flags repeated issues across runs", () => {
        const memories = extractRecurringWeakSpotMemories({
            repository: "cencori/demo",
            currentIssues: [recurringIssue],
            previousRuns: [
                {
                    id: "run-1",
                    created_at: "2026-03-01T00:00:00.000Z",
                    score: "C",
                    results: {
                        issues: [
                            {
                                file: recurringIssue.file,
                                severity: recurringIssue.severity,
                                name: recurringIssue.name,
                                type: recurringIssue.type,
                                line: 21,
                            },
                        ],
                    },
                },
            ],
        });

        expect(memories).toHaveLength(1);
        expect(memories[0]).toContain("Recurring weak spot");
        expect(memories[0]).toContain("has appeared in 2 scan runs");
    });
});
