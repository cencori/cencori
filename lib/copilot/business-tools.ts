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
 * the Money, Sales and Inbox tabs so the numbers always match. Read-only
 * (except note_client, which keeps the owner's note about a client straight
 * away, like remember), and pinned to ctx.project like every Copilot tool. This is the owner's side: the
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
            name: "get_schedule",
            description: "The appointment book: whether it's set up, the services (length, price, deposit), opening hours, chairs (how many at once), deposit and reminder settings, and the appointments on a day or the next few days with their ids, customers, deposit and whether reminders went out. Times are the business's local time.",
            parameters: {
                type: "object",
                properties: {
                    from: { type: "string", description: "First day, YYYY-MM-DD. Defaults to today." },
                    days: { type: "number", description: "How many days, 1-14. Defaults to 1 (just that day)." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "client_card",
            description: "Everything about one client, by phone number or name: visits, missed and cancelled appointments, what's coming up, recent services, orders, what they've spent, and the notes kept about them.",
            parameters: { type: "object", properties: { client: { type: "string", description: "Their phone number, or their name as it shows in chats." } }, required: ["client"] },
        },
    },
    {
        type: "function",
        function: {
            name: "note_client",
            description: "Keep a note about a client the owner tells you (\"Tolu is allergic to latex\", \"Kemi always wants Ada as her stylist\"). Saved straight away; you see it when that client writes. By phone number or name.",
            parameters: { type: "object", properties: { client: { type: "string", description: "Their phone number, or their name as it shows in chats." }, note: { type: "string" } }, required: ["client", "note"] },
        },
    },
    {
        type: "function",
        function: {
            name: "owner_whatsapp",
            description: "Let the owner text you on WhatsApp (\"here's my WhatsApp, send me a text\", \"can I talk to you on WhatsApp?\") or stop it. link with their phone: you text that number a code on WhatsApp; ask them to tell you the code (here, in this chat) and call confirm with it. That's what links the number: a code that reached a mistyped number is no use to whoever got it. If the code couldn't be sent yet, you get a link instead: give it to them as it is (it opens WhatsApp to you with the code typed in; they press send). link without a phone: just the link. confirm: the code they read back. unlink: stop. Once linked, they can ask you anything there, and you'll message them there when something needs them.",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["link", "confirm", "unlink"] },
                    phone: { type: "string", description: "For link: their WhatsApp number, as they gave it." },
                    code: { type: "string", description: "For confirm: the code from the WhatsApp message." },
                },
                required: ["action"],
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
    get_schedule: "Opening the schedule",
    client_card: "Looking up the client",
    note_client: "Making a note",
    owner_whatsapp: "Getting WhatsApp ready",
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
                bookings: chosen.slice(0, limitOf(args.limit, 20, 50)).map(({ id, title, start, detail, status, conversation_id, created_at, customer_phone, deposit_due }) => ({
                    id, what: title, when: start, detail, status, chat_id: conversation_id, booked_at: created_at,
                    ...(customer_phone ? { phone: `+${customer_phone}` } : {}),
                    ...(deposit_due ? { deposit: { amount: deposit_due.amount, paid: !!deposit_due.paid_at } } : {}),
                })),
            };
        }

        case "get_schedule": {
            const [{ getSchedule, appointmentsOf }, slots, { businessTimeZone }, { localDate, localMidnight }] = await Promise.all([
                import("@/lib/studio/schedule"), import("@/lib/studio/schedule-slots"), import("@/lib/studio/business-zone"), import("@/lib/studio/time"),
            ]);
            const [schedule, bookings, timeZone] = await Promise.all([getSchedule(db, project.id), listBookings(db, project.id), businessTimeZone(db, project.id)]);
            if (!schedule?.settings.services.length) return { set_up: false, note: "No appointment book yet: the owner adds services (name, how long, price) and hours in Studio's Schedule, or tells you and you set it up with update_schedule." };
            const day = slots.parseDay(args.from) ?? localDate(timeZone, new Date());
            const days = limitOf(args.days, 1, 14);
            const from = localMidnight(timeZone, day.year, day.month, day.day).getTime();
            const to = localMidnight(timeZone, day.year, day.month, day.day + days).getTime();
            const { settings } = schedule;
            return {
                set_up: true,
                time_zone: timeZone,
                services: settings.services.map((service) => ({ name: service.name, minutes: service.minutes, price: service.price, deposit: slots.depositFor(settings, service) || null })),
                hours: slots.describeHours(settings.hours),
                chairs: settings.chairs,
                deposit: settings.deposit,
                hold_minutes: settings.hold_minutes,
                reminders: settings.reminders,
                appointments: appointmentsOf(bookings)
                    .filter((booking) => booking.starts_at && Date.parse(booking.starts_at) >= from && Date.parse(booking.starts_at) < to)
                    .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!))
                    .map((booking) => ({
                        id: booking.id,
                        when: slots.describeStart(timeZone, new Date(booking.starts_at!)),
                        service: booking.service,
                        customer: booking.customer_name,
                        phone: booking.customer_phone ? `+${booking.customer_phone}` : null,
                        status: booking.status,
                        deposit: booking.deposit_due ? { amount: booking.deposit_due.amount, paid: !!booking.deposit_due.paid_at } : null,
                        customer_confirmed: !!booking.customer_confirmed_at,
                        reminders: booking.reminders ?? {},
                        note: booking.detail,
                        chat_id: booking.conversation_id,
                    })),
            };
        }

        case "client_card":
        case "note_client": {
            const who = typeof args.client === "string" ? args.client.trim() : "";
            if (!who) return { error: "Say which client: a phone number or name." };
            const { phoneDigits } = await import("@/lib/studio/schedule");
            let phone = /\d{7,}/.test(who.replace(/\D/g, "")) ? phoneDigits(who) : null;
            if (!phone && ctx.userId) {
                // By name: the WhatsApp chats with that name.
                const chats = (await listConversations(db, project.id, { limit: 500, userId: ctx.userId })).filter((chat) => chat.number && has(who.toLowerCase(), chat.name));
                const numbers = [...new Set(chats.map((chat) => chat.number!))];
                if (numbers.length > 1) return { error: `More than one client matches "${who}": ${chats.slice(0, 8).map((chat) => `${chat.name} (${chat.number})`).join(", ")}. Ask which.` };
                phone = numbers[0] ? phoneDigits(numbers[0]) : null;
            }
            if (!phone) return { error: `No WhatsApp client called "${who}". Ask for their number.` };
            const clients = await import("@/lib/studio/clients");
            if (name === "note_client") {
                const note = typeof args.note === "string" ? args.note : "";
                const saved = await clients.addClientNote(db, project.id, phone, note, "owner");
                return saved.ok ? { saved: true, client: `+${phone}`, note: saved.note.text } : { error: saved.message };
            }
            const card = await clients.clientCard(db, project.id, phone);
            return card ?? { error: `No history with +${phone} yet.` };
        }

        case "owner_whatsapp": {
            if (!ctx.userId) return { error: "That's only for the owner, in Studio." };
            const owner = await import("@/lib/studio/owner-whatsapp");
            const { studioStaff } = await import("@/lib/studio/owner-chat");
            const staff = await studioStaff(db as never, project.id);
            const employee = (ctx.employeeId ? staff.find((agent) => agent.id === ctx.employeeId) : null) ?? staff[0];
            if (!employee) return { error: "There's no employee yet." };
            if (args.action === "unlink") {
                const removed = await owner.unlinkOwner(db, project.id, ctx.userId, employee.id);
                return removed ? { unlinked: true } : { error: "They weren't texting you on WhatsApp." };
            }
            if (args.action === "confirm") {
                const confirmed = await owner.confirmOwnerCode(db, { projectId: project.id, userId: ctx.userId, agentId: employee.id, code: typeof args.code === "string" ? args.code : "" });
                return confirmed.ok ? { linked: true, phone: confirmed.phone, note: "Linked. They can text you there now; you'll message them there when something needs them." } : { error: confirmed.message };
            }
            if (typeof args.phone === "string" && args.phone.trim()) {
                const texted = await owner.textOwnerCode(db, { projectId: project.id, userId: ctx.userId, agentId: employee.id, phone: args.phone });
                if (!texted.ok) return { error: texted.message };
                return texted.sent ? { code_sent_to: texted.to, note: "Ask them for the code from your WhatsApp message and call confirm with it. It lasts 15 minutes." } : { code_not_sent: texted.message, link: texted.link };
            }
            const started = await owner.startOwnerLink(db, { projectId: project.id, userId: ctx.userId, agentId: employee.id });
            if (!started.ok) return { error: started.message };
            return { link: started.link, your_number: started.number, code: started.code, already_linked_on: started.linked_phone, note: "Tap the link on the phone with their WhatsApp; it opens a chat with you with the code typed in; they press send and you reply there. The code lasts 15 minutes." };
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
