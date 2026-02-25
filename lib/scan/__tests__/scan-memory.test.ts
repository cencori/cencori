import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ScanMemoryError, searchMemory, writeMemory } from "@/lib/scan/scan-memory";

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

    test("searchMemory throws when strict mode is enabled and embedding key is missing", async () => {
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const supabase = {
            rpc: vi.fn(),
        } as unknown as Parameters<typeof searchMemory>[3];

        await expect(
            searchMemory("project-id", "user-id", "what was dismissed last time?", supabase, { enforce: true })
        ).rejects.toBeInstanceOf(ScanMemoryError);
    });

    test("searchMemory remains best-effort when strict mode is disabled", async () => {
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const rpc = vi.fn();
        const supabase = { rpc } as unknown as Parameters<typeof searchMemory>[3];

        const result = await searchMemory("project-id", "user-id", "hello", supabase, { enforce: false });

        expect(result).toBe("");
        expect(rpc).not.toHaveBeenCalled();
    });

    test("writeMemory throws when strict mode is enabled and embedding key is missing", async () => {
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const insert = vi.fn();
        const supabase = {
            from: vi.fn(() => ({ insert })),
        } as unknown as Parameters<typeof writeMemory>[4];

        await expect(
            writeMemory("project-id", "user-id", "memory content", "chat", supabase, undefined, { enforce: true })
        ).rejects.toBeInstanceOf(ScanMemoryError);

        expect(insert).not.toHaveBeenCalled();
    });
});
