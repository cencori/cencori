import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const meta = vi.hoisted(() => ({
    findPhoneNumber: vi.fn(async () => null as { id: string } | null),
    addPhoneNumber: vi.fn(async () => "PN1"),
    requestVerificationCode: vi.fn(async () => undefined),
    verifyPhoneCode: vi.fn(async () => undefined),
    registerPhoneNumber: vi.fn(async () => undefined),
    subscribeAppToWaba: vi.fn(async () => undefined),
    getAgentChannel: vi.fn(async () => null),
    saveSignupChannel: vi.fn(async () => ({ ok: true, channel: { id: "ch1", projectId: "p", status: "active", accessTokenEncrypted: null, metadata: { display_phone_number: "+234 801 234 5678" } } })),
    WHATSAPP_CHANNEL_SLUG: "whatsapp-channel",
}));
vi.mock("@/lib/channels/whatsapp", () => meta);
vi.mock("@/lib/embedded/widget", () => ({ ensureWidgetInstallation: vi.fn(async () => ({ ok: true, tenantId: "t", installationId: "i" })) }));
vi.mock("@/lib/encryption", () => ({ encryptApiKey: (value: string) => `enc:${value}` }));

import { explainMetaError, readNumber, sendNumberCode, verifyNumberCode } from "@/lib/channels/whatsapp-own-number";

/** tool_connections in memory, for the pending number and the "taken elsewhere" check. */
function fakeDb() {
    const rows: Array<Record<string, unknown>> = [];
    const db = {
        from: () => {
            const filters: Array<(row: Record<string, unknown>) => boolean> = [];
            let patch: Record<string, unknown> | null = null;
            let remove = false;
            const match = () => rows.filter((row) => filters.every((test) => test(row)));
            const builder: Record<string, unknown> = {
                select: () => builder, order: () => builder, limit: () => builder,
                eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return builder; },
                neq: (key: string, value: unknown) => { filters.push((row) => row[key] !== value); return builder; },
                maybeSingle: async () => ({ data: match()[0] ?? null }),
                insert: async (row: Record<string, unknown>) => { rows.push({ id: `r${rows.length}`, ...row }); return { error: null }; },
                update: (value: Record<string, unknown>) => { patch = value; return builder; },
                delete: () => { remove = true; return builder; },
                then: (resolve: (value: unknown) => void) => {
                    const hit = match();
                    if (patch) hit.forEach((row) => Object.assign(row, patch));
                    if (remove) hit.forEach((row) => rows.splice(rows.indexOf(row), 1));
                    return Promise.resolve({ data: hit, error: null }).then(resolve);
                },
            };
            return builder;
        },
    };
    return { db: db as never, rows };
}

const project = "11111111-1111-1111-1111-111111111111";
const agent = "22222222-2222-2222-2222-222222222222";

beforeAll(async () => {
    await import("@/lib/channels/whatsapp");
});
beforeEach(() => {
    process.env.STUDIO_WABA_ID = "WABA";
    process.env.META_SYSTEM_USER_TOKEN = "token";
    Object.values(meta).forEach((value) => typeof value === "function" && "mockClear" in value && value.mockClear());
});

describe("readNumber", () => {
    it("reads a local Nigerian number and an international one", () => {
        expect(readNumber("0801 234 5678")).toMatchObject({ cc: "234", national: "8012345678", e164: "2348012345678" });
        expect(readNumber("+44 7911 123456")).toMatchObject({ cc: "44", e164: "447911123456" });
        expect(readNumber("12345")).toBeNull();
    });
});

describe("explainMetaError", () => {
    it("turns a number still on the WhatsApp app into steps, not Meta's words", () => {
        expect(explainMetaError(new Error("The phone number is already registered with WhatsApp")).reason).toBe("on_whatsapp");
        expect(explainMetaError(Object.assign(new Error("Too many attempts"), { code: 136023 })).reason).toBe("too_many");
    });
});

describe("own number", () => {
    it("texts the code, then checks it and connects the number to the employee", async () => {
        const { db, rows } = fakeDb();
        const sent = await sendNumberCode(db, { projectId: project, agentId: agent, phone: "08012345678", displayName: "Glow Salon", method: "SMS" });
        expect(sent).toEqual({ ok: true, phone: "+234 801 234 5678" });
        expect(meta.addPhoneNumber).toHaveBeenCalledWith("WABA", "token", { cc: "234", phoneNumber: "8012345678", verifiedName: "Glow Salon" });
        expect(meta.requestVerificationCode).toHaveBeenCalledWith("PN1", "token", "SMS");

        const done = await verifyNumberCode(db, { projectId: project, organizationId: "org", agentId: agent, agentName: "Ada", tier: "free" as never, code: "123 456" });
        expect(done.ok).toBe(true);
        expect(meta.verifyPhoneCode).toHaveBeenCalledWith("PN1", "token", "123456");
        expect(meta.registerPhoneNumber).toHaveBeenCalledWith("PN1", "token", expect.stringMatching(/^\d{6}$/));
        expect(meta.saveSignupChannel).toHaveBeenCalledWith(db, expect.objectContaining({ phoneNumberId: "PN1", wabaId: "WABA", accessToken: "token", coexistence: false }));
        // The pending number is gone once it's connected.
        expect(rows.filter((row) => row.connector_slug === "whatsapp-number-pending")).toHaveLength(0);
    });

    it("reuses a number already on the account instead of adding it twice", async () => {
        meta.findPhoneNumber.mockResolvedValueOnce({ id: "PN9" });
        const { db } = fakeDb();
        await sendNumberCode(db, { projectId: project, agentId: agent, phone: "+2348012345678", displayName: "Glow Salon", method: "VOICE" });
        expect(meta.addPhoneNumber).not.toHaveBeenCalled();
        expect(meta.requestVerificationCode).toHaveBeenCalledWith("PN9", "token", "VOICE");
    });

    it("says when the number is still on the WhatsApp app", async () => {
        meta.requestVerificationCode.mockRejectedValueOnce(new Error("This phone number is already registered to a WhatsApp account."));
        const { db } = fakeDb();
        const sent = await sendNumberCode(db, { projectId: project, agentId: agent, phone: "08012345678", displayName: "Glow Salon", method: "SMS" });
        expect(sent).toMatchObject({ ok: false, reason: "on_whatsapp" });
    });

    it("a wrong code changes nothing", async () => {
        const { db } = fakeDb();
        await sendNumberCode(db, { projectId: project, agentId: agent, phone: "08012345678", displayName: "Glow Salon", method: "SMS" });
        meta.verifyPhoneCode.mockRejectedValueOnce(new Error("Verification code is incorrect"));
        const result = await verifyNumberCode(db, { projectId: project, organizationId: "org", agentId: agent, agentName: "Ada", tier: "free" as never, code: "000000" });
        expect(result).toMatchObject({ ok: false, reason: "wrong_code" });
        expect(meta.saveSignupChannel).not.toHaveBeenCalled();
    });

    it("needs a code sent first", async () => {
        const { db } = fakeDb();
        expect(await verifyNumberCode(db, { projectId: project, organizationId: "org", agentId: agent, agentName: "Ada", tier: "free" as never, code: "123456" })).toMatchObject({ ok: false, reason: "expired" });
    });
});
