import { describe, expect, it } from "vitest";
import { applySummary, patchMessage, RECENT_MESSAGES, saveThread, stamp, SUMMARIZE_AT, summaryPrompt, threadContext, toSummarize, type StoredMessage, type Thread } from "@/lib/studio/owner-chat";

const thread = (messages: StoredMessage[], extra: Partial<Thread["settings"]> = {}): Thread => ({
    id: "row1", projectId: "proj", settings: { kind: "owner_chat", user_id: "u1", messages, summary: null, summarized: 0, ...extra },
});
const msg = (index: number, role: "user" | "assistant" = index % 2 ? "assistant" : "user"): StoredMessage => ({
    id: `m${index}`, role, content: `message ${index}`, at: new Date(Date.UTC(2026, 9, 30, 9, index)).toISOString(),
});

describe("stamp", () => {
    it("reads in the business's time zone", () => {
        // 13:05 UTC is 2:05 pm in Lagos (UTC+1).
        expect(stamp("2026-10-31T13:05:00Z", "Africa/Lagos")).toBe("Sat 31 Oct, 2:05 pm");
        expect(stamp("2026-10-31T23:30:00Z", "Africa/Lagos")).toBe("Sun 1 Nov, 12:30 am");
    });
});

describe("threadContext", () => {
    it("stamps the owner's messages, not the employee's, and says what the employee proposed and saved", () => {
        const messages: StoredMessage[] = [
            { id: "1", role: "user", content: "We're closed Sunday", at: "2026-10-28T09:00:00Z" },
            { id: "2", role: "assistant", content: "Got it.", at: "2026-10-28T09:00:05Z", notes: [{ id: "n", fact: "Closed Sunday 2 Nov.", agent_id: "a", agent_name: "Ada", state: "undone" }], actions: [{ id: "x", title: "Message Kemi", state: "done", result: "Sent", proposal: {} }] },
            { id: "3", role: "user", content: "[The user confirmed…]", at: "2026-10-28T09:01:00Z", hidden: true },
        ];
        const { messages: seen } = threadContext(thread(messages), "Africa/Lagos");
        expect(seen[0]).toEqual({ role: "user", content: "[Wed 28 Oct, 10:00 am] We're closed Sunday" });
        expect(seen[1].content).toBe('Got it.\n[Message Kemi: done — Sent]\n[Saved for customers (Ada): "Closed Sunday 2 Nov." — the owner undid this, so it\'s no longer told to customers]');
        expect(seen[2].content).toBe("[Wed 28 Oct, 10:01 am] (from the app, not typed by the owner) [The user confirmed…]");
    });

    it("sends only the latest messages word for word, and the summary for the rest", () => {
        const many = Array.from({ length: 70 }, (_, index) => msg(index));
        const context = threadContext(thread(many, { summary: "Earlier: they talked about suya.", summarized: 10 }), "UTC");
        expect(context.summary).toBe("Earlier: they talked about suya.");
        expect(context.messages).toHaveLength(RECENT_MESSAGES);
        expect(context.messages.at(-1)!.content).toContain("message 69");
    });
});

describe("summarising", () => {
    it("waits until enough has piled up, then folds all but the recent ones", () => {
        expect(toSummarize(thread(Array.from({ length: SUMMARIZE_AT - 1 }, (_, i) => msg(i))))).toEqual([]);
        const full = thread(Array.from({ length: SUMMARIZE_AT }, (_, i) => msg(i)));
        const batch = toSummarize(full);
        expect(batch).toHaveLength(SUMMARIZE_AT - RECENT_MESSAGES);
        expect(batch[0].id).toBe("m0");
        const folded = applySummary(full, batch, "  On Thu 30 Oct the owner asked about suya.  ");
        expect(folded.settings).toMatchObject({ summary: "On Thu 30 Oct the owner asked about suya.", summarized: SUMMARIZE_AT - RECENT_MESSAGES });
        expect(toSummarize(folded)).toEqual([]);
    });

    it("asks for a dated summary that keeps the previous one", () => {
        const prompt = summaryPrompt("Before: closed Sundays.", [msg(0), { ...msg(1), hidden: false }], "UTC");
        expect(prompt).toContain("Before: closed Sundays.");
        expect(prompt).toContain("Fri 30 Oct, 9:00 am Owner: message 0");
        expect(prompt).toContain("Employee: message 1");
    });
});

describe("saveThread and patchMessage", () => {
    it("drops the oldest summarised messages past the cap", async () => {
        let written: Record<string, unknown> | null = null;
        const builder = { eq: () => builder, select: () => builder, single: async () => ({ data: { id: "row1" }, error: null }) };
        const db = { from: () => ({ update: (row: Record<string, unknown>) => { written = row; return builder; } }) } as never;
        const big = thread(Array.from({ length: 405 }, (_, i) => msg(i)), { summarized: 300 });
        const saved = await saveThread(db, big);
        expect(saved.settings.messages).toHaveLength(400);
        expect(saved.settings.messages[0].id).toBe("m5");
        expect(saved.settings.summarized).toBe(295);
        expect((written as unknown as { metadata: { messages: unknown[] } }).metadata.messages).toHaveLength(400);
    });

    it("records how an action or a saved fact ended", () => {
        const t = thread([{ ...msg(1, "assistant"), actions: [{ id: "a1", title: "Message Kemi", state: "pending", proposal: {} }], notes: [{ id: "n1", fact: "x", agent_id: "a", agent_name: "Ada", state: "saved" }] }]);
        expect(patchMessage(t, "m1", { actionId: "a1", state: "done", result: "Sent." })).toBe(true);
        expect(patchMessage(t, "m1", { noteId: "n1", state: "undone" })).toBe(true);
        expect(patchMessage(t, "m1", { actionId: "a1", state: "exploded" })).toBe(false);
        expect(patchMessage(t, "nope", { noteId: "n1", state: "undone" })).toBe(false);
        expect(t.settings.messages[0].actions![0]).toMatchObject({ state: "done", result: "Sent." });
        expect(t.settings.messages[0].notes![0].state).toBe("undone");
    });
});

import { pickThread } from "@/lib/studio/owner-chat";

describe("one thread per employee", () => {
    const row = (id: string, agent?: string) => ({ id, metadata: { kind: "owner_chat" as const, user_id: "u1", ...(agent ? { agent_id: agent } : {}), messages: [], summary: null, summarized: 0 } });
    // Newest first, as getThread reads them.
    const rows = [row("tolu-thread", "tolu"), row("old-thread"), row("ada-thread", "ada")];

    it("finds each employee's own thread", () => {
        expect(pickThread(rows, { agentId: "tolu", main: false })?.id).toBe("tolu-thread");
        expect(pickThread(rows, { agentId: "ada", main: true })?.id).toBe("ada-thread");
    });

    it("gives the main employee the thread from before there was one each, and no one else", () => {
        const before = [row("tolu-thread", "tolu"), row("old-thread")];
        expect(pickThread(before, { agentId: "ada", main: true })?.id).toBe("old-thread");
        expect(pickThread(before, { agentId: "kemi", main: false })).toBeNull();
    });

    it("without an employee, the newest thread, as before", () => {
        expect(pickThread(rows)?.id).toBe("tolu-thread");
    });
});
