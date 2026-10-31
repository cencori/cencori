import { beforeEach, describe, expect, it, vi } from "vitest";

const orders = [
    { id: "o1", items: [{ product_id: "p", name: "Jollof", option: null, quantity: 2, price: 3000 }], total: 6000, currency: "NGN", customer: "Kemi 0803", delivery: null, note: null, status: "paid", payment_reference: "ref", agent_id: "a", conversation_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-10-28T10:00:00Z", paid_at: "2026-10-28T10:05:00Z" },
    { id: "o2", items: [{ product_id: "p", name: "Suya", option: "spicy", quantity: 1, price: 4000 }], total: 4000, currency: "NGN", customer: "Tunde", delivery: "Lekki", note: null, status: "awaiting_payment", payment_reference: null, agent_id: "a", conversation_id: null, created_at: "2026-10-29T10:00:00Z", paid_at: null },
    { id: "o3", items: [{ product_id: "p", name: "Jollof", option: null, quantity: 1, price: 3000 }], total: 3000, currency: "NGN", customer: "Kemi 0803", delivery: null, note: null, status: "done", payment_reference: null, agent_id: "a", conversation_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-10-30T10:00:00Z", paid_at: "2026-10-30T10:01:00Z", paid_by: "owner" },
];
const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
const past = new Date(Date.now() - 5 * 86_400_000).toISOString();
const bookings = [
    { id: "b1", agent_id: "a", conversation_id: "11111111-1111-1111-1111-111111111111", title: "Table for 4: Kemi", start: future, detail: null, status: "confirmed", created_at: past },
    { id: "b2", agent_id: "a", conversation_id: null, title: "Table for 2: Ade", start: past, detail: null, status: "done", created_at: past },
];
const chats = [
    { id: "11111111-1111-1111-1111-111111111111", channel: "whatsapp", name: "Kemi", named: true, topic: "Jollof", number: "+234803", last_message: "Thanks!", last_from: "customer", updated_at: "2026-10-30T11:00:00Z", open: true, needs_owner: null, owner_active: false, unread: true },
    { id: "22222222-2222-2222-2222-222222222222", channel: "link", name: "Link visitor", named: false, topic: null, number: null, last_message: "Can I speak to someone?", last_from: "assistant", updated_at: "2026-10-29T11:00:00Z", open: true, needs_owner: { reason: "transfer" }, owner_active: false, unread: false },
];

vi.mock("@/lib/embedded/catalog", () => ({ getCatalog: vi.fn(async () => ({ metadata: { orders, currency: "NGN", products: [] } })) }));
vi.mock("@/lib/embedded/bookings", () => ({ listBookings: vi.fn(async () => bookings) }));
vi.mock("@/lib/studio/inbox", () => ({
    listConversations: vi.fn(async (_db: unknown, _project: string, opts: { channel?: string | null }) => chats.filter((chat) => !opts.channel || chat.channel === opts.channel)),
    getConversation: vi.fn(async (_db: unknown, _project: string, id: string) => id === chats[0].id
        ? { conversation: chats[0], messages: [{ id: "m1", from: "customer", text: "Do you have jollof?", at: "x" }, { id: "m2", from: "assistant", text: "Yes, ₦3,000", at: "y" }] }
        : null),
}));
vi.mock("@/lib/studio/money-data", () => ({
    loadMoney: vi.fn(async () => ({
        summary: { period: "week", currency: "NGN", total: 9000, previous: 4000, by_link: 6000, by_transfer: 0, marked_paid: 3000, to_collect: 4000, paid_count: 2, bars: [{ label: "M", amount: 6000, current: false }], top_items: [{ name: "Jollof", quantity: 3, amount: 9000 }] },
        payments: { metadata: {} },
        transfers: null,
        transfersToConfirm: [{ reference: "t1", amount: 5000, currency: "NGN", description: "Suya", customer: "Tunde", status: "claimed", created_at: "x", claimed_at: "y", conversation_id: null }],
    })),
}));

const { runBusinessTool } = await import("@/lib/copilot/business-tools");
const { runCopilotTool, toolsFor } = await import("@/lib/copilot/tools");

const ctx = { admin: {} as never, organization: { id: "org", name: "Mama Put", slug: "mama-put" }, project: { id: "proj", name: "Mama Put", slug: "mama-put" }, userId: "user", business: true };

describe("business tools", () => {
    beforeEach(() => vi.clearAllMocks());

    it("reports money as the Money tab does, in the business's currency", async () => {
        const money = await runBusinessTool("get_money", {}, ctx) as Record<string, unknown>;
        expect(money).toMatchObject({ period: "the last 7 days", currency: "NGN", earned: 9000, previous_period: 4000, still_to_collect_from_unpaid_orders: 4000 });
        expect(money.transfers_to_confirm).toEqual([{ amount: 5000, currency: "NGN", customer: "Tunde", for: "Suya", said_sent_at: "y", chat_id: null }]);
    });

    it("lists orders newest first, filtering open ones and by search", async () => {
        const open = await runBusinessTool("list_orders", { status: "open" }, ctx) as { orders: Array<{ id: string }>; open_orders: number };
        expect(open.orders.map((order) => order.id)).toEqual(["o2", "o1"]);
        expect(open.open_orders).toBe(2);
        const suya = await runBusinessTool("list_orders", { search: "suya" }, ctx) as { orders: Array<{ id: string; items: string[] }> };
        expect(suya.orders).toHaveLength(1);
        expect(suya.orders[0].items).toEqual(["1 × Suya (spicy)"]);
    });

    it("lists upcoming bookings by default and past ones on request", async () => {
        expect((await runBusinessTool("list_bookings", {}, ctx) as { bookings: Array<{ id: string }> }).bookings.map((b) => b.id)).toEqual(["b1"]);
        expect((await runBusinessTool("list_bookings", { when: "past" }, ctx) as { bookings: Array<{ id: string }> }).bookings.map((b) => b.id)).toEqual(["b2"]);
    });

    it("joins customers to what they ordered and booked", async () => {
        const result = await runBusinessTool("list_customers", { sort: "top_spenders" }, ctx) as { customers: Array<Record<string, unknown>> };
        expect(result.customers[0]).toMatchObject({ name: "Kemi", orders: 2, total_paid: 9000, bookings: 1, channel: "whatsapp" });
        expect(result.customers[1]).toMatchObject({ name: null, orders: 0, total_paid: 0 });
    });

    it("finds the chats that need the owner, and reads one with the employee named as such", async () => {
        const needing = await runBusinessTool("list_chats", { filter: "needs_owner" }, ctx) as { chats: Array<{ id: string; last_from: string }>; need_the_owner: number };
        expect(needing.need_the_owner).toBe(1);
        expect(needing.chats.map((chat) => chat.id)).toEqual([chats[1].id]);
        expect(needing.chats[0].last_from).toBe("employee");
        const chat = await runBusinessTool("read_chat", { chat_id: chats[0].id }, ctx) as { messages: Array<{ from: string }> };
        expect(chat.messages.map((message) => message.from)).toEqual(["customer", "employee"]);
        expect(await runBusinessTool("read_chat", { chat_id: "not-an-id" }, ctx)).toEqual({ error: "Give a chat_id from list_chats or list_customers." });
    });

    it("are offered to business accounts only, and refused otherwise", async () => {
        const names = (business: boolean) => toolsFor({ ...ctx, business }).map((tool) => tool.function.name);
        expect(names(true)).toContain("get_money");
        expect(names(false)).not.toContain("get_money");
        expect(await runCopilotTool("get_money", {}, { ...ctx, business: false })).toEqual({ error: "That's only for business accounts." });
    });
});
