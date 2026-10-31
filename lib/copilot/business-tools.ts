import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import { getCatalog, type CatalogOrder } from "@/lib/embedded/catalog";
import { listBookings, type Booking } from "@/lib/embedded/bookings";
import { getConversation, listConversations, type InboxChannel } from "@/lib/studio/inbox";
import { loadMoney } from "@/lib/studio/money-data";
import type { MoneyPeriod } from "@/lib/studio/money";
import type { CopilotToolContext } from "@/lib/copilot/tools";

/**
 * The business, as its owner's employee sees it (Studio, business accounts):
 * money, orders, bookings, customers and chats, read through the same code as
 * the Money, Sales and Inbox tabs so the numbers always match. Read-only, and
 * pinned to ctx.project like every Copilot tool. This is the owner's side: the
 * customer-facing agent never gets these.
 */

const CHANNELS: InboxChannel[] = ["whatsapp", "website", "link", "other"];

export const BUSINESS_TOOLS: ChatCompletionFunctionTool[] = [
    {
        type: "function",
        function: {
            name: "get_money",
            description: "What the business earned: the total for this week (the last 7 days), month or year in its own time zone, the same period before it, how it was paid (payment link, bank transfer confirmed, marked paid by the owner), money still to collect from unpaid orders, the best-selling items, a bar per day/week/month, and customers waiting for the owner to confirm a transfer. The same figures as Studio's Money tab.",
            parameters: { type: "object", properties: { period: { type: "string", enum: ["week", "month", "year"], description: "Defaults to week." } } },
        },
    },
    {
        type: "function",
        function: {
            name: "list_orders",
            description: "Orders customers placed through the employee, newest first: items, total, customer, delivery, note, status (awaiting_payment, paid, new, done, cancelled), how it was paid, and when. Filter by status or a word in the customer, items or note.",
            parameters: {
                type: "object",
                properties: {
                    status: { type: "string", enum: ["awaiting_payment", "paid", "new", "done", "cancelled", "open"], description: "open = not done or cancelled yet." },
                    search: { type: "string", description: "A customer name, phone, item or word to look for." },
                    limit: { type: "number", description: "1-50, default 20." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_bookings",
            description: "Table and appointment bookings the employee took: what (e.g. 'Table for 4: Kemi'), when, details, status (confirmed, done, cancelled). Upcoming ones by default, soonest first.",
            parameters: {
                type: "object",
                properties: {
                    when: { type: "string", enum: ["upcoming", "past", "all"], description: "Defaults to upcoming." },
                    limit: { type: "number", description: "1-50, default 20." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_customers",
            description: "The business's customers: everyone who chatted (WhatsApp, link, website) with their name or number and channel, joined to what they ordered and booked: orders, total paid, bookings, last contact. Most recent first, or biggest spenders first.",
            parameters: {
                type: "object",
                properties: {
                    search: { type: "string", description: "A name or phone number." },
                    sort: { type: "string", enum: ["recent", "top_spenders"], description: "Defaults to recent." },
                    limit: { type: "number", description: "1-50, default 20." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_chats",
            description: "Customer chats, newest first: who, channel, what they came for, the last message and who sent it, whether it needs the owner (handed over or asked for a callback), whether the owner has stepped in, and whether it's unread.",
            parameters: {
                type: "object",
                properties: {
                    filter: { type: "string", enum: ["all", "needs_owner", "unread"], description: "Defaults to all." },
                    channel: { type: "string", enum: CHANNELS },
                    search: { type: "string", description: "A name, number or word in the topic or last message." },
                    limit: { type: "number", description: "1-30, default 15." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "read_chat",
            description: "One customer chat in full (the latest 40 messages): what the customer said, what the employee and the owner replied. Use list_chats or list_customers first for its id.",
            parameters: { type: "object", properties: { chat_id: { type: "string" } }, required: ["chat_id"] },
        },
    },
];

export const BUSINESS_TOOL_NAMES = new Set(BUSINESS_TOOLS.map((tool) => tool.function.name));

export const BUSINESS_TOOL_STATUS: Record<string, string> = {
    get_money: "Checking the money",
    list_orders: "Looking at orders",
    list_bookings: "Looking at bookings",
    list_customers: "Looking up customers",
    list_chats: "Going through the chats",
    read_chat: "Reading the chat",
};

const limitOf = (value: unknown, fallback: number, max: number) => {
    const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.min(Math.max(n, 1), max);
};
const text = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const has = (needle: string, ...haystack: Array<string | null | undefined>) => !needle || haystack.some((value) => value?.toLowerCase().includes(needle));
const isOpenOrder = (order: CatalogOrder) => order.status !== "done" && order.status !== "cancelled";
const orderPaid = (order: CatalogOrder) => !!order.paid_at || order.status === "paid";

/** A booking's start as a time, when the agent gave one we can read. */
const startOf = (booking: Booking) => {
    const at = booking.start ? Date.parse(booking.start) : Number.NaN;
    return Number.isNaN(at) ? null : at;
};

const orderOut = (order: CatalogOrder) => ({
    id: order.id,
    items: order.items.map((item) => `${item.quantity} × ${item.name}${item.option ? ` (${item.option})` : ""}`),
    total: order.total,
    currency: order.currency,
    customer: order.customer,
    delivery: order.delivery,
    note: order.note,
    status: order.status,
    paid_by: order.paid_by ?? (order.status === "paid" && order.payment_reference ? "link" : null),
    chat_id: order.conversation_id,
    placed_at: order.created_at,
    paid_at: order.paid_at,
});

export async function runBusinessTool(name: string, args: Record<string, unknown>, ctx: CopilotToolContext): Promise<unknown> {
    const project = ctx.project;
    if (!project) return { error: "No business is selected." };
    const db = ctx.admin;

    switch (name) {
        case "get_money": {
            const period: MoneyPeriod = args.period === "month" || args.period === "year" ? args.period : "week";
            const { summary, payments, transfersToConfirm } = await loadMoney(db, project.id, period);
            return {
                period: period === "week" ? "the last 7 days" : `this ${period}`,
                currency: summary.currency,
                earned: summary.total,
                previous_period: summary.previous,
                payments: summary.paid_count,
                by_payment_link: summary.by_link,
                by_bank_transfer: summary.by_transfer,
                marked_paid_by_owner: summary.marked_paid,
                still_to_collect_from_unpaid_orders: summary.to_collect,
                best_sellers: summary.top_items.slice(0, 5),
                breakdown: summary.bars.map(({ label, amount }) => ({ label, amount })),
                payment_links_connected: !!payments,
                transfers_to_confirm: transfersToConfirm.filter((transfer) => transfer.status === "claimed").slice(0, 10)
                    .map(({ amount, currency, customer, description, claimed_at, conversation_id }) => ({ amount, currency, customer, for: description, said_sent_at: claimed_at, chat_id: conversation_id })),
            };
        }

        case "list_orders": {
            const orders = (await getCatalog(db, project.id))?.metadata.orders ?? [];
            const search = text(args.search);
            const status = typeof args.status === "string" ? args.status : null;
            const matching = [...orders].reverse()
                .filter((order) => !status || (status === "open" ? isOpenOrder(order) : order.status === status))
                .filter((order) => has(search, order.customer, order.note, order.delivery, ...order.items.map((item) => item.name)));
            return {
                total_matching: matching.length,
                open_orders: orders.filter(isOpenOrder).length,
                orders: matching.slice(0, limitOf(args.limit, 20, 50)).map(orderOut),
            };
        }

        case "list_bookings": {
            const bookings = await listBookings(db, project.id);
            const when = args.when === "past" || args.when === "all" ? args.when : "upcoming";
            const now = Date.now();
            const dayAgo = now - 86_400_000;
            const chosen = bookings
                .filter((booking) => {
                    if (when === "all") return true;
                    const at = startOf(booking);
                    // A booking whose time we can't read counts as upcoming until it's done or cancelled.
                    if (at === null) return when === "upcoming" ? booking.status === "confirmed" : booking.status !== "confirmed";
                    return when === "upcoming" ? at >= dayAgo && booking.status !== "cancelled" : at < dayAgo;
                })
                .sort((a, b) => (when === "upcoming" ? 1 : -1) * ((startOf(a) ?? Number.MAX_SAFE_INTEGER) - (startOf(b) ?? Number.MAX_SAFE_INTEGER)));
            return {
                total_matching: chosen.length,
                bookings: chosen.slice(0, limitOf(args.limit, 20, 50)).map(({ id, title, start, detail, status, conversation_id, created_at }) => ({ id, what: title, when: start, detail, status, chat_id: conversation_id, booked_at: created_at })),
            };
        }

        case "list_customers": {
            if (!ctx.userId) return { error: "Customers aren't available here." };
            const [chats, catalog, bookings] = await Promise.all([
                listConversations(db, project.id, { limit: 500, userId: ctx.userId }),
                getCatalog(db, project.id),
                listBookings(db, project.id),
            ]);
            const orders = catalog?.metadata.orders ?? [];
            const search = text(args.search);
            const people = chats
                .filter((chat) => has(search, chat.name, chat.number))
                .map((chat) => {
                    const theirs = orders.filter((order) => order.conversation_id === chat.id);
                    return {
                        name: chat.named ? chat.name : null,
                        number: chat.number,
                        channel: chat.channel,
                        chat_id: chat.id,
                        last_contact: chat.updated_at,
                        came_for: chat.topic,
                        orders: theirs.length,
                        total_paid: theirs.filter(orderPaid).reduce((sum, order) => sum + order.total, 0),
                        bookings: bookings.filter((booking) => booking.conversation_id === chat.id).length,
                    };
                });
            if (args.sort === "top_spenders") people.sort((a, b) => b.total_paid - a.total_paid);
            return {
                total_customers: chats.length,
                currency: catalog?.metadata.currency ?? "NGN",
                customers: people.slice(0, limitOf(args.limit, 20, 50)),
            };
        }

        case "list_chats": {
            if (!ctx.userId) return { error: "Chats aren't available here." };
            const channel = CHANNELS.includes(args.channel as InboxChannel) ? (args.channel as InboxChannel) : null;
            const chats = await listConversations(db, project.id, { channel, limit: 200, userId: ctx.userId });
            const search = text(args.search);
            const matching = chats
                .filter((chat) => args.filter === "needs_owner" ? !!chat.needs_owner || chat.owner_active : args.filter === "unread" ? chat.unread : true)
                .filter((chat) => has(search, chat.name, chat.number, chat.topic, chat.last_message));
            return {
                total_matching: matching.length,
                need_the_owner: chats.filter((chat) => chat.needs_owner || chat.owner_active).length,
                unread: chats.filter((chat) => chat.unread).length,
                chats: matching.slice(0, limitOf(args.limit, 15, 30)).map((chat) => ({
                    id: chat.id,
                    who: chat.name,
                    channel: chat.channel,
                    came_for: chat.topic,
                    last_message: chat.last_message?.slice(0, 200) ?? null,
                    last_from: chat.last_from === "assistant" ? "employee" : chat.last_from,
                    at: chat.updated_at,
                    needs_owner: chat.needs_owner,
                    owner_stepped_in: chat.owner_active,
                    unread: chat.unread,
                })),
            };
        }

        case "read_chat": {
            if (!ctx.userId) return { error: "Chats aren't available here." };
            const id = typeof args.chat_id === "string" ? args.chat_id : "";
            if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Give a chat_id from list_chats or list_customers." };
            const found = await getConversation(db, project.id, id, ctx.userId).catch(() => null);
            if (!found) return { error: "That chat wasn't found." };
            return {
                who: found.conversation.name,
                channel: found.conversation.channel,
                needs_owner: found.conversation.needs_owner,
                owner_stepped_in: found.conversation.owner_active,
                messages: found.messages.slice(-40).map((message) => ({
                    from: message.from === "assistant" ? "employee" : message.from,
                    text: message.text.slice(0, 1_000),
                    at: message.at,
                })),
            };
        }

        default:
            return { error: `Unknown tool ${name}.` };
    }
}
