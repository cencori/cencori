import { afterEach, describe, expect, it, vi } from "vitest";

const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
vi.mock("@/lib/security/outbound-url", () => ({
    safeOutboundFetch: async (url: string, init: { body?: string }) => {
        sent.push({ url, body: JSON.parse(init.body ?? "{}") });
        return new Response(JSON.stringify({ data: { url: "https://setup.kapso.ai/s/abc" } }), { status: 200 });
    },
}));

process.env.KAPSO_API_KEY = "key";
const { createKapsoSetupLink } = await import("@/lib/channels/kapso");

afterEach(() => { sent.length = 0; });

describe("createKapsoSetupLink", () => {
    it("connects the owner's WhatsApp Business app number by default", async () => {
        expect(await createKapsoSetupLink("cust", { successUrl: "https://s", failureUrl: "https://f" })).toBe("https://setup.kapso.ai/s/abc");
        expect(sent[0].url).toContain("/customers/cust/setup_links");
        expect((sent[0].body.setup_link as Record<string, unknown>).allowed_connection_types).toEqual(["coexistence"]);
    });

    it("asks for a number of the assistant's own when told to", async () => {
        await createKapsoSetupLink("cust", { successUrl: "https://s", failureUrl: "https://f", connection: "dedicated" });
        expect((sent[0].body.setup_link as Record<string, unknown>).allowed_connection_types).toEqual(["dedicated"]);
    });
});
