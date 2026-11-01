import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const wa = vi.hoisted(() => ({
    sendText: vi.fn(async () => undefined),
    sendTemplate: vi.fn(async () => undefined),
    ensureTemplate: vi.fn(async () => "APPROVED"),
    channelAccessToken: vi.fn(() => "token"),
    getChannelById: vi.fn(),
    getAgentChannel: vi.fn(),
}));
vi.mock("@/lib/channels/whatsapp", () => wa);
vi.mock("@/lib/encryption", () => ({ decryptApiKey: () => "secret" }));
vi.mock("@/lib/main-site-url", () => ({ getMainSiteUrl: () => "https://cencori.test/" }));
vi.mock("@/lib/auth/admin-users", () => ({ adminUsers: { getUserById: vi.fn(async () => ({ data: { user: { user_metadata: { first_name: "Bola" } } } })) } }));
const sessions = vi.hoisted(() => ({ created: 0, deleted: 0 }));
vi.mock("@/lib/auth/better-auth", () => ({
    auth: { $context: Promise.resolve({ internalAdapter: {
        createSession: vi.fn(async () => { sessions.created++; return { token: `session-${sessions.created}` }; }),
        deleteSession: vi.fn(async () => { sessions.deleted++; }),
    } }) },
}));

import { answerOwnerOnWhatsApp, startOwnerLink, tellOwnersOnWhatsApp } from "@/lib/studio/owner-whatsapp";

const PROJECT = "11111111-1111-1111-1111-111111111111";
const AGENT = "22222222-2222-2222-2222-222222222222";
const USER = "33333333-3333-3333-3333-333333333333";
const channel = { id: "chan1", projectId: PROJECT, status: "active", accessTokenEncrypted: null, metadata: { agent_id: AGENT, phone_number_id: "PN", display_phone_number: "+234 811 000 0000", enabled: true, coexistence: false } };

/** tool_connections and projects, in memory. */
function fakeDb() {
    const rows: Array<Record<string, unknown>> = [];
    const db = {
        from: (table: string) => {
            const filters: Array<[string, unknown]> = [];
            let patch: Record<string, unknown> | null = null;
            const match = () => (table === "tool_connections" ? rows : []).filter((row) => filters.every(([key, value]) => row[key] === value));
            const builder: Record<string, unknown> = {
                select: () => builder, order: () => builder, limit: () => builder,
                eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
                maybeSingle: async () => (table === "projects" ? { data: { organization_id: "org" } } : table === "agents" ? { data: { name: "Ada" } } : { data: match()[0] ?? null }),
                insert: async (row: Record<string, unknown>) => { rows.push({ id: `r${rows.length}`, ...row }); return { error: null }; },
                update: (value: Record<string, unknown>) => { patch = value; return builder; },
                then: (resolve: (value: unknown) => void) => { match().forEach((row) => Object.assign(row, patch)); return Promise.resolve({ error: null }).then(resolve); },
            };
            return builder;
        },
    };
    return { db: db as never, rows };
}

/** /api/agent's stream: some text, and optionally a proposed change. */
function agentStream(content: string, action?: Record<string, unknown>) {
    const events = [`data: ${JSON.stringify({ content })}\n\n`, ...(action ? [`data: ${JSON.stringify({ action })}\n\n`] : []), "data: [DONE]\n\n"];
    return new Response(new ReadableStream({ start(controller) { events.forEach((event) => controller.enqueue(new TextEncoder().encode(event))); controller.close(); } }), { status: 200 });
}

const fetchMock = vi.fn();
beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    await import("@/lib/channels/whatsapp");
});
beforeEach(() => {
    fetchMock.mockReset();
    Object.values(wa).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockClear());
    wa.getAgentChannel.mockResolvedValue(channel);
    wa.getChannelById.mockResolvedValue(channel);
});

async function linked() {
    const { db, rows } = fakeDb();
    const started = await startOwnerLink(db, { projectId: PROJECT, userId: USER, agentId: AGENT });
    if (!started.ok) throw new Error(started.message);
    fetchMock.mockResolvedValueOnce(agentStream("Hi Bola! We're connected."));
    await answerOwnerOnWhatsApp(db, channel as never, "2348031112222", [`Link ${started.code}`], "token");
    return { db, rows, started };
}

describe("linking", () => {
    it("gives a one-tap link to the employee's number with the code typed in", async () => {
        const { db } = fakeDb();
        const started = await startOwnerLink(db, { projectId: PROJECT, userId: USER, agentId: AGENT });
        expect(started.ok && started.link).toMatch(/^https:\/\/wa\.me\/2348110000000\?text=Link%20\d{4}$/);
    });

    it("won't link on the owner's own WhatsApp Business number", async () => {
        wa.getAgentChannel.mockResolvedValueOnce({ ...channel, metadata: { ...channel.metadata, coexistence: true } });
        const { db } = fakeDb();
        expect(await startOwnerLink(db, { projectId: PROJECT, userId: USER, agentId: AGENT })).toMatchObject({ ok: false });
    });

    it("the right code links the number it came from, and the employee says hello", async () => {
        const { rows } = await linked();
        const link = ((rows[0].metadata as { links: Array<Record<string, unknown>> }).links)[0];
        expect(link).toMatchObject({ status: "active", phone: "2348031112222", code: null });
        expect(wa.sendText).toHaveBeenCalledWith(channel, "token", "2348031112222", "Hi Bola! We're connected.");
        expect(sessions.deleted).toBe(sessions.created);
    });

    it("a stranger, or a wrong code, gets the customer flow", async () => {
        const { db } = fakeDb();
        await startOwnerLink(db, { projectId: PROJECT, userId: USER, agentId: AGENT });
        expect(await answerOwnerOnWhatsApp(db, channel as never, "2348039999999", ["How much is a trim?"], "token")).toBe(false);
        expect(await answerOwnerOnWhatsApp(db, channel as never, "2348039999999", ["Link 0000"], "token")).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("talking", () => {
    it("asks the owner's employee chat as the owner and replies on WhatsApp", async () => {
        const { db } = await linked();
        fetchMock.mockResolvedValueOnce(agentStream("This week I took ₦45,000."));
        expect(await answerOwnerOnWhatsApp(db, channel as never, "2348031112222", ["How much this week?"], "token")).toBe(true);
        const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
        expect(url).toBe("https://cencori.test/api/agent");
        expect((init.headers as Record<string, string>).Authorization).toMatch(/^Bearer session-/);
        expect(JSON.parse(init.body as string)).toMatchObject({ thread: true, agentId: AGENT, currentPath: "studio" });
        expect(wa.sendText).toHaveBeenLastCalledWith(channel, "token", "2348031112222", "This week I took ₦45,000.");
    });

    it("asks before a change, and YES runs it as the owner", async () => {
        const { db } = await linked();
        const action = { id: "a1", title: "Send Kemi a payment link for ₦15,000", tier: "normal", details: [{ label: "To", value: "Kemi" }], request: { method: "POST", path: "/api/studio/inbox/x", body: { action: "payment_link" } }, doneMessage: "Sent." };
        fetchMock.mockResolvedValueOnce(agentStream("Sure.", action));
        await answerOwnerOnWhatsApp(db, channel as never, "2348031112222", ["send kemi a link for 15k"], "token");
        expect(wa.sendText).toHaveBeenLastCalledWith(channel, "token", "2348031112222", expect.stringContaining("Reply YES to do it"));

        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        fetchMock.mockResolvedValueOnce(agentStream("Done, Kemi has the link."));
        await answerOwnerOnWhatsApp(db, channel as never, "2348031112222", ["yes"], "token");
        const run = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/studio/inbox/x"));
        expect(run).toBeTruthy();
        expect(wa.sendText).toHaveBeenLastCalledWith(channel, "token", "2348031112222", "Done, Kemi has the link.");
    });

    it("never runs a change against anything but Cencori's own endpoints", async () => {
        const { db } = await linked();
        const action = { id: "a2", title: "Do something", tier: "normal", details: [], request: { method: "POST", path: "https://evil.example/steal" }, doneMessage: "Done." };
        fetchMock.mockResolvedValueOnce(agentStream("Okay.", action));
        await answerOwnerOnWhatsApp(db, channel as never, "2348031112222", ["do it"], "token");
        fetchMock.mockResolvedValueOnce(agentStream("That didn't go through."));
        await answerOwnerOnWhatsApp(db, channel as never, "2348031112222", ["yes"], "token");
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes("evil.example"))).toBe(false);
    });
});

describe("telling the owner", () => {
    it("messages inside the 24-hour window, and uses the template outside it", async () => {
        const { db, rows } = await linked();
        await tellOwnersOnWhatsApp(db, PROJECT, { title: "Kemi needs you", body: "She asked for a refund." });
        expect(wa.sendText).toHaveBeenLastCalledWith(channel, "token", "2348031112222", "Kemi needs you\nShe asked for a refund.");
        const links = (rows[0].metadata as { links: Array<Record<string, unknown>> }).links;
        links[0].last_inbound_at = new Date(Date.now() - 30 * 3_600_000).toISOString();
        await tellOwnersOnWhatsApp(db, PROJECT, { title: "Good morning", body: "₦45k yesterday." });
        expect(wa.sendTemplate).toHaveBeenCalledWith(channel, "token", "2348031112222", expect.objectContaining({ name: "owner_update_v1" }), ["Bola", "Ada", "Good morning: ₦45k yesterday."]);
    });
});
