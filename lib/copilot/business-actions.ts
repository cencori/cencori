import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import { getCatalog, orderSummary } from "@/lib/embedded/catalog";
import { listBookings } from "@/lib/embedded/bookings";
import { transferHistory } from "@/lib/embedded/transfers";
import { getConversation } from "@/lib/studio/inbox";
import type { CopilotToolContext } from "@/lib/copilot/tools";
import type { PrepareResult } from "@/lib/copilot/actions";

/**
 * The owner's employee doing things in the business (Studio, business
 * accounts): message a customer, send a payment link, step in or hand back,
 * move an order or booking along, confirm a transfer. Like every Copilot
 * action, calling one changes nothing: it proposes, the owner confirms, and
 * the app runs it with the owner's own sign-in against the same Studio
 * endpoints the Sales and Inbox screens use. Proposals name the customer and
 * the money so the owner sees exactly what they're agreeing to.
 */

const chatId = { type: "string", description: "The chat's id, from list_chats or list_customers." } as const;

export const BUSINESS_ACTIONS: ChatCompletionFunctionTool[] = [
    {
        type: "function",
        function: {
            name: "message_customer",
            description: "Send a customer a message in their chat (WhatsApp, link or website), from you (the employee), for the owner: \"tell Kemi her order is on the way\". It doesn't pause you in that chat. Write it as you'd say it to the customer. WhatsApp only allows it within 24 hours of the customer's last message.",
            parameters: { type: "object", properties: { chat_id: chatId, text: { type: "string", description: "The message, as the customer will read it." } }, required: ["chat_id", "text"] },
        },
    },
    {
        type: "function",
        function: {
            name: "send_payment_link",
            description: "Make a payment link with the business's payment provider and send it to a customer in their chat. Needs payments connected (get_money's payment_links_connected).",
            parameters: {
                type: "object",
                properties: {
                    chat_id: chatId,
                    amount: { type: "number", description: "In the business's currency, e.g. 15000 for ₦15,000." },
                    description: { type: "string", description: "What it's for, e.g. \"2 × Jollof, delivery to Lekki\"." },
                    message: { type: "string", description: "Optional words to send with the link." },
                },
                required: ["chat_id", "amount", "description"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "step_in",
            description: "The owner takes over a chat themselves: you go quiet in it until they hand it back.",
            parameters: { type: "object", properties: { chat_id: chatId }, required: ["chat_id"] },
        },
    },
    {
        type: "function",
        function: {
            name: "hand_back",
            description: "Give a chat the owner stepped into back to you, so you answer the customer again.",
            parameters: { type: "object", properties: { chat_id: chatId }, required: ["chat_id"] },
        },
    },
    {
        type: "function",
        function: {
            name: "update_order",
            description: "Move an order along: paid (the owner got the money another way, e.g. cash or a transfer they checked), done (delivered or collected), or cancelled. Look it up with list_orders first.",
            parameters: { type: "object", properties: { order_id: { type: "string" }, change: { type: "string", enum: ["paid", "done", "cancelled"] } }, required: ["order_id", "change"] },
        },
    },
    {
        type: "function",
        function: {
            name: "update_booking",
            description: "Mark a booking done (they came) or cancelled. Look it up with list_bookings first.",
            parameters: { type: "object", properties: { booking_id: { type: "string" }, change: { type: "string", enum: ["done", "cancelled"] } }, required: ["booking_id", "change"] },
        },
    },
    {
        type: "function",
        function: {
            name: "confirm_transfer",
            description: "A customer said they sent money by bank transfer (get_money's transfers_to_confirm): confirm it arrived, which marks what it was for as paid and tells them, or say it didn't arrive. Only on the owner's word that they checked their bank.",
            parameters: {
                type: "object",
                properties: {
                    customer: { type: "string", description: "Who sent it, as transfers_to_confirm names them, or the reference." },
                    received: { type: "boolean" },
                },
                required: ["customer", "received"],
            },
        },
    },
];

export const BUSINESS_ACTION_NAMES = new Set(BUSINESS_ACTIONS.map((action) => action.function.name));

export const BUSINESS_ACTION_STATUS: Record<string, string> = {
    message_customer: "Writing the message",
    send_payment_link: "Preparing the payment link",
    step_in: "Getting the chat ready",
    hand_back: "Getting the chat ready",
    update_order: "Finding the order",
    update_booking: "Finding the booking",
    confirm_transfer: "Finding the transfer",
};

const money = (amount: number, currency: string) => {
    try {
        return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString("en-NG")}`;
    }
};
const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export async function prepareBusinessAction(name: string, args: Record<string, unknown>, ctx: CopilotToolContext): Promise<PrepareResult> {
    const project = ctx.project;
    if (!project || !ctx.business || !ctx.userId) return { error: "That's only for a business, in Studio." };
    const db = ctx.admin;
    const id = crypto.randomUUID();
    const inbox = (chat: string) => `/api/studio/inbox/${chat}`;

    // The chat, for the actions that act in one: who it's with, and whether a message can reach them now.
    type Found = NonNullable<Awaited<ReturnType<typeof getConversation>>>;
    const chat = async (): Promise<{ error: string } | { found: Found; id: string }> => {
        const wanted = clean(args.chat_id, 64);
        if (!/^[0-9a-f-]{36}$/i.test(wanted)) return { error: "Give a chat_id from list_chats or list_customers." };
        const found = await getConversation(db, project.id, wanted, ctx.userId!).catch(() => null);
        if (!found) return { error: "That chat wasn't found." };
        return { found, id: wanted };
    };
    const unreachable = (reason: "website" | "window" | null) => reason === "window"
        ? "WhatsApp only allows a message within 24 hours of the customer's last one. Suggest the owner calls them."
        : "Messages can only be sent to WhatsApp, link and website chats.";

    switch (name) {
        case "message_customer": {
            const target = await chat();
            if ("error" in target) return { error: target.error };
            if (!target.found.reply.possible) return { error: unreachable(target.found.reply.reason) };
            const text = clean(args.text, 2000);
            if (!text) return { error: "Write the message." };
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: `Message ${target.found.conversation.name}`,
                    details: [{ label: "To", value: `${target.found.conversation.name} (${target.found.conversation.channel})` }, { label: "Message", value: text }],
                    request: { method: "POST", path: inbox(target.id), body: { project_id: project.id, action: "relay", text } },
                    doneMessage: `Sent to ${target.found.conversation.name}.`,
                },
            };
        }

        case "send_payment_link": {
            const target = await chat();
            if ("error" in target) return { error: target.error };
            if (!target.found.reply.possible) return { error: unreachable(target.found.reply.reason) };
            const amount = typeof args.amount === "number" && Number.isFinite(args.amount) ? Math.round(args.amount * 100) / 100 : 0;
            const description = clean(args.description, 200);
            if (!(amount > 0) || !description) return { error: "Give the amount and what it's for." };
            const catalog = await getCatalog(db, project.id);
            const currency = catalog?.metadata.currency ?? "NGN";
            const message = clean(args.message, 1000);
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: `Send ${target.found.conversation.name} a payment link for ${money(amount, currency)}`,
                    details: [
                        { label: "To", value: target.found.conversation.name },
                        { label: "Amount", value: money(amount, currency) },
                        { label: "For", value: description },
                        ...(message ? [{ label: "Message", value: message }] : []),
                    ],
                    request: { method: "POST", path: inbox(target.id), body: { project_id: project.id, action: "payment_link", amount, description, ...(message ? { text: message } : {}) } },
                    doneMessage: `Sent ${target.found.conversation.name} a payment link for ${money(amount, currency)}. You'll see it in Money once they pay.`,
                },
            };
        }

        case "step_in":
        case "hand_back": {
            const target = await chat();
            if ("error" in target) return { error: target.error };
            const stepping = name === "step_in";
            if (stepping === target.found.conversation.owner_active) return { error: stepping ? "The owner is already handling that chat." : "You're already answering that chat." };
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: stepping ? `Take over the chat with ${target.found.conversation.name}` : `Hand ${target.found.conversation.name}'s chat back`,
                    details: [{ label: "Chat", value: `${target.found.conversation.name} (${target.found.conversation.channel})` }, { label: "Then", value: stepping ? "Your employee goes quiet in this chat until you hand it back." : "Your employee answers this customer again." }],
                    request: { method: "POST", path: inbox(target.id), body: { project_id: project.id, action: stepping ? "step_in" : "hand_back" } },
                    doneMessage: stepping ? `You're handling ${target.found.conversation.name}'s chat now.` : `Your employee is answering ${target.found.conversation.name} again.`,
                },
            };
        }

        case "update_order": {
            const order = (await getCatalog(db, project.id))?.metadata.orders.find((item) => item.id === clean(args.order_id, 64));
            if (!order) return { error: "That order wasn't found. Look it up with list_orders." };
            const change = args.change === "paid" || args.change === "done" || args.change === "cancelled" ? args.change : null;
            if (!change) return { error: "Say paid, done or cancelled." };
            if (order.status === change || (change === "paid" && order.paid_at)) return { error: `That order is already ${change}.` };
            const label = { paid: "Mark paid", done: "Mark done", cancelled: "Cancel" }[change];
            return {
                proposal: {
                    id, kind: name, tier: change === "cancelled" ? "destructive" : "normal",
                    title: `${label}: ${order.customer ?? "order"} · ${money(order.total, order.currency)}`,
                    details: [
                        { label: "Order", value: orderSummary(order) },
                        { label: "Customer", value: order.customer ?? "Not given" },
                        { label: "Total", value: money(order.total, order.currency) },
                        { label: "Now", value: order.status.replace("_", " ") },
                    ],
                    ...(change === "cancelled" ? { confirmPhrase: "cancel" } : {}),
                    request: { method: "POST", path: "/api/studio/sales", body: { project_id: project.id, kind: "order", id: order.id, action: change } },
                    doneMessage: change === "paid" ? "Marked paid. It counts in Money now." : change === "done" ? "Marked done." : "Order cancelled.",
                },
            };
        }

        case "update_booking": {
            const booking = (await listBookings(db, project.id)).find((item) => item.id === clean(args.booking_id, 64));
            if (!booking) return { error: "That booking wasn't found. Look it up with list_bookings." };
            const change = args.change === "done" || args.change === "cancelled" ? args.change : null;
            if (!change) return { error: "Say done or cancelled." };
            if (booking.status === change) return { error: `That booking is already ${change}.` };
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: `${change === "done" ? "Mark done" : "Cancel"}: ${booking.title}`,
                    details: [{ label: "Booking", value: booking.title }, { label: "When", value: booking.start ?? "Not given" }, { label: "Now", value: booking.status }],
                    request: { method: "POST", path: "/api/studio/sales", body: { project_id: project.id, kind: "booking", id: booking.id, action: change } },
                    doneMessage: change === "done" ? "Booking marked done." : "Booking cancelled.",
                },
            };
        }

        case "confirm_transfer": {
            const wanted = clean(args.customer, 120).toLowerCase();
            if (!wanted) return { error: "Say whose transfer." };
            const claimed = (await transferHistory(db, project.id).catch(() => [])).filter((transfer) => transfer.status === "claimed");
            const matches = claimed.filter((transfer) => transfer.reference.toLowerCase() === wanted || (transfer.customer ?? "").toLowerCase().includes(wanted));
            if (matches.length === 0) return { error: claimed.length ? `No one waiting matches "${args.customer}". Waiting: ${claimed.slice(0, 10).map((transfer) => `${transfer.customer ?? "someone"} (${money(transfer.amount, transfer.currency)})`).join(", ")}.` : "No customer is waiting for a transfer to be confirmed." };
            if (matches.length > 1) return { error: `More than one matches: ${matches.map((transfer) => `${transfer.customer ?? "someone"} (${money(transfer.amount, transfer.currency)}, ref ${transfer.reference})`).join("; ")}. Ask which.` };
            const transfer = matches[0];
            const received = args.received === true;
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: received ? `Confirm ${money(transfer.amount, transfer.currency)} from ${transfer.customer ?? "the customer"} arrived` : `Tell ${transfer.customer ?? "the customer"} the transfer didn't arrive`,
                    details: [
                        { label: "From", value: transfer.customer ?? "Not given" },
                        { label: "Amount", value: money(transfer.amount, transfer.currency) },
                        { label: "For", value: transfer.description },
                        { label: "Reference", value: transfer.reference },
                    ],
                    request: { method: "POST", path: "/api/studio/transfers", body: { project_id: project.id, reference: transfer.reference, action: received ? "confirm" : "not_received" } },
                    doneMessage: received ? "Confirmed. It's marked paid and counts in Money." : "Marked not received.",
                },
            };
        }

        default:
            return { error: `Unknown action ${name}.` };
    }
}
