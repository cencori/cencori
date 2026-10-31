import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const metadata = {
    owner_active_at: null,
    manual_messages: [
        { id: "m1", from: "customer", text: "Hello?", at: "2026-10-30T10:00:00Z" },
        { id: "m2", from: "owner", text: "Hi, it's the owner", at: "2026-10-30T10:01:00Z" },
        { id: "m3", from: "assistant", text: "Here's your payment link for Jollof (₦6,000):\nhttps://pay.example/x", at: "2026-10-30T10:05:00Z" },
    ],
};
vi.mock("@/lib/embedded/client-tokens", () => ({ verifyClientToken: () => ({ ok: true, claims: { session_id: "s1", project_id: "p1", external_user_id: "v1" } }) }));
vi.mock("@/lib/api-keys", () => ({ extractBearerToken: () => "token" }));
vi.mock("@/lib/supabaseAdmin", () => ({
    createAdminClient: () => {
        const builder = { select: () => builder, eq: () => builder, maybeSingle: async () => ({ data: { metadata } }) };
        return { from: () => builder };
    },
}));

const { GET } = await import("@/app/api/widget/messages/route");
const get = async (since?: string) => (await GET(new NextRequest(`https://x.test/api/widget/messages${since ? `?since=${encodeURIComponent(since)}` : ""}`))).json();

describe("GET /api/widget/messages", () => {
    it("sends the visitor what the owner wrote and what the assistant passed on, each marked, never their own messages", async () => {
        const body = await get();
        expect(body.messages).toEqual([
            { id: "m2", from: "owner", text: "Hi, it's the owner", at: "2026-10-30T10:01:00Z" },
            { id: "m3", from: "assistant", text: "Here's your payment link for Jollof (₦6,000):\nhttps://pay.example/x", at: "2026-10-30T10:05:00Z" },
        ]);
        expect(body.owner_active).toBe(false);
    });

    it("only what's new since the last poll", async () => {
        expect((await get("2026-10-30T10:02:00Z")).messages.map((m: { id: string }) => m.id)).toEqual(["m3"]);
    });
});
