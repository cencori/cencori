import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ScanIssue } from "@/packages/scan/src/scanner/core";

vi.mock("@/lib/scan/ai-client", () => ({
    generateWithFallback: vi.fn(),
}));

import { filterIssuesWithLLM, LlmFilterEnforcementError } from "@/lib/scan/llm-filter";
import { generateWithFallback } from "@/lib/scan/ai-client";

const mockedGenerateWithFallback = vi.mocked(generateWithFallback);
const ENV_BACKUP = { ...process.env };

function restoreProviderEnv() {
    process.env.CEREBRAS_API_KEY = ENV_BACKUP.CEREBRAS_API_KEY;
    process.env.GROQ_API_KEY = ENV_BACKUP.GROQ_API_KEY;
    process.env.GOOGLE_AI_API_KEY = ENV_BACKUP.GOOGLE_AI_API_KEY;
    process.env.GEMINI_API_KEY = ENV_BACKUP.GEMINI_API_KEY;
}

function buildIssue(partial: Partial<ScanIssue>): ScanIssue {
    return {
        type: "route",
        severity: "high",
        name: "Next.js API Route (check for auth)",
        file: "app/api/users/route.ts",
        line: 1,
        column: 1,
        match: "export async function GET()",
        ...partial,
    };
}

describe("filterIssuesWithLLM", () => {
    beforeEach(() => {
        restoreProviderEnv();
        mockedGenerateWithFallback.mockReset();
    });

    afterEach(() => {
        restoreProviderEnv();
    });

    test("throws in strict mode when no AI provider key is configured", async () => {
        delete process.env.CEREBRAS_API_KEY;
        delete process.env.GROQ_API_KEY;
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const issues = [buildIssue({ line: 10 })];
        const fileContents = new Map<string, string>([
            ["app/api/users/route.ts", "export async function GET() { return Response.json({ ok: true }); }"],
        ]);

        await expect(
            filterIssuesWithLLM(issues, fileContents, { enforce: true })
        ).rejects.toBeInstanceOf(LlmFilterEnforcementError);
    });

    test("evaluates all chunks in strict mode and suppresses false positives", async () => {
        process.env.GEMINI_API_KEY = "test-key";

        const routeIssues = Array.from({ length: 22 }).map((_, index) =>
            buildIssue({
                line: index + 1,
                name: `Route check ${index + 1}`,
            })
        );
        const nonFilterable = buildIssue({
            type: "secret",
            name: "Hardcoded API Key",
            line: 999,
        });
        const issues = [...routeIssues, nonFilterable];

        const firstChunkVerdicts = routeIssues.slice(0, 20).map((issue, index) => ({
            issueKey: `${issue.file}:${issue.line}:${issue.type}:${issue.name}`,
            isRealIssue: index !== 2,
            reason: "test",
        }));
        const secondChunkVerdicts = routeIssues.slice(20).map((issue, index) => ({
            issueKey: `${issue.file}:${issue.line}:${issue.type}:${issue.name}`,
            isRealIssue: index !== 0,
            reason: "test",
        }));

        mockedGenerateWithFallback
            .mockResolvedValueOnce({
                model: "gemini-2.5-flash",
                provider: "gemini",
                text: JSON.stringify({ verdicts: firstChunkVerdicts }),
            })
            .mockResolvedValueOnce({
                model: "gemini-2.5-flash",
                provider: "gemini",
                text: JSON.stringify({ verdicts: secondChunkVerdicts }),
            });

        const fileContents = new Map<string, string>([
            ["app/api/users/route.ts", "export async function GET() { return Response.json({ ok: true }); }"],
        ]);

        const result = await filterIssuesWithLLM(issues, fileContents, { enforce: true });

        expect(mockedGenerateWithFallback).toHaveBeenCalledTimes(2);
        expect(result.evaluated).toBe(22);
        expect(result.suppressed).toHaveLength(2);
        expect(result.filtered).toHaveLength(21);
        expect(result.filtered.some((issue) => issue.type === "secret")).toBe(true);
        expect(result.enforced).toBe(true);
    });

    test("keeps issues in strict mode when any issue verdict is missing", async () => {
        process.env.GEMINI_API_KEY = "test-key";

        const issues = [
            buildIssue({ line: 1, name: "Route 1" }),
            buildIssue({ line: 2, name: "Route 2" }),
        ];

        mockedGenerateWithFallback.mockResolvedValue({
            model: "gemini-2.5-flash",
            provider: "gemini",
            text: JSON.stringify({
                verdicts: [
                    {
                        issueKey: `${issues[0].file}:${issues[0].line}:${issues[0].type}:${issues[0].name}`,
                        isRealIssue: true,
                        reason: "test",
                    },
                ],
            }),
        });

        const fileContents = new Map<string, string>([
            ["app/api/users/route.ts", "export async function GET() { return Response.json({ ok: true }); }"],
        ]);

        const result = await filterIssuesWithLLM(issues, fileContents, { enforce: true });
        expect(result.suppressed).toHaveLength(0);
        expect(result.filtered).toHaveLength(2);
        expect(result.filtered.every((issue) => issue.confidence === "high")).toBe(true);
    });

    test("keeps issues in strict mode when AI response format is invalid", async () => {
        process.env.GEMINI_API_KEY = "test-key";

        const issues = [
            buildIssue({ line: 42, name: "Route invalid format" }),
        ];

        mockedGenerateWithFallback.mockResolvedValue({
            model: "gemini-2.5-flash",
            provider: "gemini",
            text: "Not JSON at all",
        });

        const fileContents = new Map<string, string>([
            ["app/api/users/route.ts", "export async function GET() { return Response.json({ ok: true }); }"],
        ]);

        const result = await filterIssuesWithLLM(issues, fileContents, { enforce: true });
        expect(result.suppressed).toHaveLength(0);
        expect(result.filtered).toHaveLength(1);
        expect(result.filtered[0]?.confidence).toBe("high");
    });
});
