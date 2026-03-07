import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ScanMemoryError, getContinuityMemoryContext, listContinuityMemoryEntries, searchMemory, writeMemory } from "@/lib/scan/scan-memory";

const ENV_BACKUP = { ...process.env };

function restoreEmbeddingEnv() {
    process.env.GOOGLE_AI_API_KEY = ENV_BACKUP.GOOGLE_AI_API_KEY;
    process.env.GEMINI_API_KEY = ENV_BACKUP.GEMINI_API_KEY;
}

describe("scan-memory strict enforcement", () => {
    beforeEach(() => {
        restoreEmbeddingEnv();
    });

    afterEach(() => {
        restoreEmbeddingEnv();
    });

    test("searchMemory uses lexical fallback in strict mode when embedding key is missing", async () => {
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const queryBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: "mem-1",
                        content: "User dismissed a SQL injection finding in api/users.ts",
                        source: "dismiss",
                        created_at: "2026-02-25T10:00:00.000Z",
                    },
                ],
                error: null,
            }),
        };

        const supabase = {
            rpc: vi.fn(),
            from: vi.fn(() => queryBuilder),
        } as unknown as Parameters<typeof searchMemory>[3];

        const result = await searchMemory("project-id", "user-id", "what sql issue was dismissed?", supabase, { enforce: true });

        expect(result).toContain("[Previously dismissed]");
        expect(result).toContain("SQL injection");
        expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test("searchMemory remains best-effort when strict mode is disabled", async () => {
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const queryBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        const rpc = vi.fn();
        const supabase = {
            rpc,
            from: vi.fn(() => queryBuilder),
        } as unknown as Parameters<typeof searchMemory>[3];

        const result = await searchMemory("project-id", "user-id", "hello", supabase, { enforce: false });

        expect(result).toBe("");
        expect(rpc).not.toHaveBeenCalled();
    });

    test("searchMemory throws in strict mode when lexical fallback query fails", async () => {
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const queryBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "db unavailable" },
            }),
        };

        const supabase = {
            rpc: vi.fn(),
            from: vi.fn(() => queryBuilder),
        } as unknown as Parameters<typeof searchMemory>[3];

        await expect(
            searchMemory("project-id", "user-id", "what was dismissed?", supabase, { enforce: true })
        ).rejects.toMatchObject({ code: "search_failed" });
    });

    test("writeMemory stores records without embedding when strict mode is enabled and key is missing", async () => {
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const insert = vi.fn().mockResolvedValue({ error: null });
        const supabase = {
            from: vi.fn(() => ({ insert })),
        } as unknown as Parameters<typeof writeMemory>[4];

        await expect(
            writeMemory("project-id", "user-id", "memory content", "chat", supabase, undefined, { enforce: true })
        ).resolves.toBeUndefined();

        expect(insert).toHaveBeenCalledTimes(1);
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({
            embedding: null,
            source: "chat",
        }));
    });

    test("writeMemory throws on insert failure in strict mode", async () => {
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const insert = vi.fn().mockResolvedValue({ error: { message: "insert failed" } });
        const supabase = {
            from: vi.fn(() => ({ insert })),
        } as unknown as Parameters<typeof writeMemory>[4];

        await expect(
            writeMemory("project-id", "user-id", "memory content", "chat", supabase, undefined, { enforce: true })
        ).rejects.toBeInstanceOf(ScanMemoryError);
    });

    test("getContinuityMemoryContext returns latest continuity entries grouped by source", async () => {
        const queryBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: "mem-brief",
                        content: "Project brief for cencori/demo. Next.js security app.",
                        source: "project_brief",
                        created_at: "2026-03-06T10:00:00.000Z",
                    },
                    {
                        id: "mem-scan",
                        content: "Scan summary for cencori/demo (run abcd1234). Score B.",
                        source: "scan_summary",
                        created_at: "2026-03-06T09:00:00.000Z",
                    },
                    {
                        id: "mem-risk",
                        content: "Accepted risk recorded for cencori/demo on scan run abcd1234.",
                        source: "accepted_risk",
                        created_at: "2026-03-06T08:00:00.000Z",
                    },
                ],
                error: null,
            }),
        };

        const supabase = {
            from: vi.fn(() => queryBuilder),
        } as unknown as Parameters<typeof getContinuityMemoryContext>[2];

        const result = await getContinuityMemoryContext("project-id", "user-id", supabase, { enforce: true });

        expect(result).toContain("[Project brief]");
        expect(result).toContain("[Prior scan]");
        expect(result).toContain("[Accepted risk]");
    });

    test("listContinuityMemoryEntries returns structured continuity memory rows", async () => {
        const queryBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: "mem-1",
                        content: "Recurring weak spot for cencori/demo.",
                        source: "weak_spot",
                        created_at: "2026-03-06T10:00:00.000Z",
                        scan_run_id: "run-1",
                    },
                ],
                error: null,
            }),
        };

        const supabase = {
            from: vi.fn(() => queryBuilder),
        } as unknown as Parameters<typeof listContinuityMemoryEntries>[2];

        const result = await listContinuityMemoryEntries("project-id", "user-id", supabase, { limit: 5 });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            source: "weak_spot",
            scan_run_id: "run-1",
        });
    });
});
