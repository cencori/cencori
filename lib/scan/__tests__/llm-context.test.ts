import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ScanIssue } from "@/packages/scan/src/scanner/core";

vi.mock("@/lib/scan/ai-client", () => ({
    generateWithFallback: vi.fn(),
}));

import { createRepositoryAiContextTracker } from "@/lib/scan/llm-context";
import { generateWithFallback } from "@/lib/scan/ai-client";

const mockedGenerateWithFallback = vi.mocked(generateWithFallback);
const ENV_BACKUP = { ...process.env };

function restoreProviderEnv() {
    process.env.CEREBRAS_API_KEY = ENV_BACKUP.CEREBRAS_API_KEY;
    process.env.GROQ_API_KEY = ENV_BACKUP.GROQ_API_KEY;
    process.env.GOOGLE_AI_API_KEY = ENV_BACKUP.GOOGLE_AI_API_KEY;
    process.env.GEMINI_API_KEY = ENV_BACKUP.GEMINI_API_KEY;
}

function buildIssue(partial: Partial<ScanIssue> = {}): ScanIssue {
    return {
        type: "vulnerability",
        severity: "high",
        name: "Potential SQL Injection",
        file: "app/api/users/route.ts",
        line: 18,
        column: 5,
        match: "query(`SELECT ... ${input}`)",
        ...partial,
    };
}

describe("createRepositoryAiContextTracker", () => {
    beforeEach(() => {
        restoreProviderEnv();
        mockedGenerateWithFallback.mockReset();
    });

    afterEach(() => {
        restoreProviderEnv();
    });

    test("stays disabled when no AI provider key is configured", async () => {
        delete process.env.CEREBRAS_API_KEY;
        delete process.env.GROQ_API_KEY;
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const tracker = createRepositoryAiContextTracker({ repository: "acme/repo" });
        expect(tracker.isEnabled).toBe(false);

        tracker.ingest({
            filePath: "app/page.tsx",
            fileContent: "export default function Page() { return null; }",
            fileIssues: [],
            totals: { processedFiles: 1, totalFiles: 1, issuesFound: 0 },
        });

        const result = await tracker.finalize();
        expect(result).toBeNull();
        expect(mockedGenerateWithFallback).not.toHaveBeenCalled();
    });

    test("emits live context snapshots from scanned file batches", async () => {
        process.env.GEMINI_API_KEY = "test-key";

        mockedGenerateWithFallback.mockResolvedValue({
            model: "gemini-2.5-flash",
            provider: "gemini",
            text: JSON.stringify({
                summary: "Auth boundaries are inconsistent across API handlers.",
                architectureFindings: ["API routes call shared DB helpers without a central auth guard."],
                riskThemes: ["Authentication gaps", "Unsanitized query construction"],
                priorityFiles: ["app/api/users/route.ts", "lib/db/users.ts"],
                suggestedChecks: ["Verify all mutating endpoints require user/session checks."],
            }),
        });

        const onUpdate = vi.fn();
        const tracker = createRepositoryAiContextTracker({
            repository: "acme/repo",
            batchSize: 2,
            onUpdate,
        });

        tracker.ingest({
            filePath: "app/api/users/route.ts",
            fileContent: "export async function POST(req: Request) { const body = await req.json(); }",
            fileIssues: [buildIssue()],
            totals: { processedFiles: 1, totalFiles: 2, issuesFound: 1 },
        });

        tracker.ingest({
            filePath: "lib/db/users.ts",
            fileContent: "export async function lookup(id: string) { return db.query(`select * from users where id=${id}`); }",
            fileIssues: [buildIssue({ file: "lib/db/users.ts", line: 1 })],
            totals: { processedFiles: 2, totalFiles: 2, issuesFound: 2 },
        });

        const context = await tracker.finalize({ processedFiles: 2, totalFiles: 2, issuesFound: 2 });
        expect(mockedGenerateWithFallback).toHaveBeenCalledTimes(1);
        expect(context).not.toBeNull();
        expect(context?.summary).toContain("Auth boundaries");
        expect(context?.snapshotsAnalyzed).toBe(1);
        expect(context?.priorityFiles).toContain("app/api/users/route.ts");
        expect(onUpdate).toHaveBeenCalledTimes(1);
    });
});
