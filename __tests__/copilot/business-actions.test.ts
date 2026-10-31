import { describe, expect, it, vi } from "vitest";

const kemi = { id: "11111111-1111-1111-1111-111111111111", channel: "whatsapp", name: "Kemi", named: true, owner_active: false };
const late = { ...kemi, id: "22222222-2222-2222-2222-222222222222", name: "Tunde" };
vi.mock("@/lib/studio/inbox", () => ({
    getConversation: vi.fn(async (_db: unknown, _p: string, id: string) => id === kemi.id ? { conversation: kemi, messages: [], reply: { possible: true, reason: null } }
        : id === late.id ? { conversation: late, messages: [], reply: { possible: false, reason: "window" } } : null),
}));
vi.mock("@/lib/embedded/catalog", () => ({
    getCatalog: vi.fn(async () => ({ metadata: { currency: "NGN", orders: [{ id: "o1", items: [{ name: "Jollof", quantity: 2, option: null, price: 3000 }], total: 6000, currency: "NGN", customer: "Kemi", status: "new", paid_at: null }] } })),
    orderSummary: (order: { items: Array<{ quantity: number; name: string }> }) => order.items.map((item) => `${item.quantity} × ${item.name}`).join(", "),
}));
vi.mock("@/lib/embedded/bookings", () => ({ listBookings: vi.fn(async () => [{ id: "b1", title: "Table for 4: Ade", start: "2026-11-01T19:00", status: "confirmed" }]) }));
vi.mock("@/lib/embedded/transfers", () => ({
    transferHistory: vi.fn(async () => [
        { reference: "TRF1", amount: 5000, currency: "NGN", description: "Suya", customer: "Tunde Bakare", status: "claimed" },
        { reference: "TRF2", amount: 8000, currency: "NGN", description: "Rice", customer: "Tunde Ojo", status: "claimed" },
        { reference: "TRF3", amount: 1000, currency: "NGN", description: "Old", customer: "Bisi", status: "paid" },
    ]),
}));

const { prepareBusinessAction } = await import("@/lib/copilot/business-actions");
const ctx = { admin: {} as never, organization: { id: "org", name: "Mama Put", slug: "mama-put" }, project: { id: "proj", name: "Mama Put", slug: "mama-put" }, userId: "owner", business: true };
type Proposal = { proposal: { title: string; tier: string; confirmPhrase?: string; details: Array<{ label: string; value: string }>; request: { method: string; path: string; body: Record<string, unknown> } } };

describe("business actions", () => {
    it("messages a customer from the employee, without pausing it", async () => {
        const { proposal } = await prepareBusinessAction("message_customer", { chat_id: kemi.id, text: "Your order is on the way!" }, ctx) as Proposal;
        expect(proposal.title).toBe("Message Kemi");
        expect(proposal.request).toEqual({ method: "POST", path: `/api/studio/inbox/${kemi.id}`, body: { project_id: "proj", action: "relay", text: "Your order is on the way!" } });
    });

    it("won't message a WhatsApp chat past the 24-hour window, or a chat that isn't there", async () => {
        expect(await prepareBusinessAction("message_customer", { chat_id: late.id, text: "Hi" }, ctx)).toEqual({ error: expect.stringContaining("24 hours") });
        expect(await prepareBusinessAction("message_customer", { chat_id: "33333333-3333-3333-3333-333333333333", text: "Hi" }, ctx)).toEqual({ error: "That chat wasn't found." });
    });

    it("shows the amount and what it's for on a payment link", async () => {
        const { proposal } = await prepareBusinessAction("send_payment_link", { chat_id: kemi.id, amount: 15000, description: "2 × Jollof, delivery" }, ctx) as Proposal;
        expect(proposal.title).toMatch(/^Send Kemi a payment link for ₦15,000/);
        expect(proposal.request.body).toEqual({ project_id: "proj", action: "payment_link", amount: 15000, description: "2 × Jollof, delivery" });
    });

    it("asks for the word before cancelling an order, and moves bookings along", async () => {
        const cancel = await prepareBusinessAction("update_order", { order_id: "o1", change: "cancelled" }, ctx) as Proposal;
        expect(cancel.proposal).toMatchObject({ tier: "destructive", confirmPhrase: "cancel" });
        expect(cancel.proposal.request.body).toEqual({ project_id: "proj", kind: "order", id: "o1", action: "cancelled" });
        const paid = await prepareBusinessAction("update_order", { order_id: "o1", change: "paid" }, ctx) as Proposal;
        expect(paid.proposal.tier).toBe("normal");
        const booking = await prepareBusinessAction("update_booking", { booking_id: "b1", change: "done" }, ctx) as Proposal;
        expect(booking.proposal.request.body).toEqual({ project_id: "proj", kind: "booking", id: "b1", action: "done" });
    });

    it("confirms the one transfer that matches, and asks which when two do", async () => {
        expect(await prepareBusinessAction("confirm_transfer", { customer: "tunde", received: true }, ctx)).toEqual({ error: expect.stringContaining("More than one matches") });
        const { proposal } = await prepareBusinessAction("confirm_transfer", { customer: "bakare", received: true }, ctx) as Proposal;
        expect(proposal.request.body).toEqual({ project_id: "proj", reference: "TRF1", action: "confirm" });
        expect(await prepareBusinessAction("confirm_transfer", { customer: "bisi", received: true }, ctx)).toEqual({ error: expect.stringContaining("No one waiting matches") });
    });

    it("are for a business in Studio only", async () => {
        expect(await prepareBusinessAction("message_customer", { chat_id: kemi.id, text: "Hi" }, { ...ctx, business: false })).toEqual({ error: "That's only for a business, in Studio." });
    });
});
