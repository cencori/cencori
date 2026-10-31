import { describe, expect, it } from "vitest";
import { personaInstructions, publicPersona, savePersona } from "@/lib/studio/persona";

/** One tool_connections row, in memory. */
function fakeDb() {
    let stored: Record<string, unknown> | null = null;
    const builder = (write?: Record<string, unknown>) => ({
        eq: () => builder(write),
        select: () => builder(write),
        single: async () => {
            if (write) stored = { id: "row1", project_id: "proj", metadata: write.metadata ?? write };
            return { data: stored, error: null };
        },
    });
    return {
        db: { from: () => ({ insert: (row: Record<string, unknown>) => builder(row), update: (row: Record<string, unknown>) => builder(row) }) } as never,
        stored: () => stored,
    };
}

describe("personaInstructions", () => {
    it("names the employee over any older name, and says how it talks", () => {
        const block = personaInstructions("Ada", { tone: "warm", style: "calls everyone 'boss'", language: "pidgin", emoji: true });
        expect(block).toContain("Your name is Ada. Use this name; it replaces any other name for you above.");
        expect(block).toContain("Warm and friendly");
        expect(block).toContain("How you talk, in the owner's words: calls everyone 'boss'");
        expect(block).toContain("Speak Nigerian Pidgin");
        expect(block).toContain("Use an emoji now and then");
    });

    it("leaves out how they talk when the owner didn't say, and keeps emoji off", () => {
        const block = personaInstructions("Tolu", { tone: "direct", style: "", language: "customer", emoji: false });
        expect(block).not.toContain("in the owner's words");
        expect(block).toContain("Don't use emoji.");
        expect(block).toContain("Reply in the customer's language");
    });
});

describe("savePersona", () => {
    it("saves the owner's choices over the defaults, tidying the words", async () => {
        const { db, stored } = fakeDb();
        const result = await savePersona(db, { projectId: "proj", agentId: "a1", existing: null, tone: "playful", style: "  uses   Pidgin  when customers do ", emoji: true });
        expect(result.ok).toBe(true);
        expect(stored()?.metadata).toMatchObject({ kind: "persona", agent_id: "a1", tone: "playful", style: "uses Pidgin when customers do", language: "customer", emoji: true });
    });

    it("refuses an unknown tone or language, and an essay", async () => {
        const { db } = fakeDb();
        expect(await savePersona(db, { projectId: "proj", agentId: "a1", existing: null, tone: "grumpy" })).toEqual({ ok: false, message: "Choose a tone." });
        expect(await savePersona(db, { projectId: "proj", agentId: "a1", existing: null, language: "klingon" })).toEqual({ ok: false, message: "Choose a language." });
        expect(await savePersona(db, { projectId: "proj", agentId: "a1", existing: null, style: "x".repeat(501) })).toMatchObject({ ok: false });
    });

    it("shows the defaults before anything is saved", () => {
        expect(publicPersona(null)).toEqual({ tone: "warm", style: "", language: "customer", emoji: false });
    });
});
