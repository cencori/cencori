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
            description: "Change a booking: done (they came), no_show (they didn't come), cancelled, or move (an appointment in the book, to a new start: \"move Tolu to 3pm\"). Look it up with get_schedule or list_bookings first. Moving or cancelling an appointment tells the customer in their chat.",
            parameters: {
                type: "object",
                properties: {
                    booking_id: { type: "string" },
                    change: { type: "string", enum: ["done", "no_show", "cancelled", "move"] },
                    start: { type: "string", description: "For move: the new start, YYYY-MM-DDTHH:MM in the business's local time." },
                },
                required: ["booking_id", "change"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "book_appointment",
            description: "Book someone into the appointment book for the owner (a walk-in, someone who called). No deposit is asked for. It may be outside opening hours; only a full house stops it.",
            parameters: {
                type: "object",
                properties: {
                    service: { type: "string", description: "The service, as the book names it." },
                    start: { type: "string", description: "YYYY-MM-DDTHH:MM in the business's local time." },
                    name: { type: "string", description: "Who it's for." },
                    phone: { type: "string", description: "Their number, so reminders reach them. Optional." },
                    note: { type: "string" },
                },
                required: ["service", "start", "name"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_schedule",
            description: "Set up or change the appointment book from what the owner tells you: services (name, minutes, price, optional own deposit), opening hours per day, chairs (how many clients at once), the deposit rule, how long a slot is held for its deposit, and reminders. Send only what changes; services you send replace the list unless add_services is true. Call get_schedule first to see what's there.",
            parameters: {
                type: "object",
                properties: {
                    services: { type: "array", items: { type: "object", properties: { name: { type: "string" }, minutes: { type: "number" }, price: { type: "number" }, deposit: { type: "number" } }, required: ["name", "minutes"] } },
                    add_services: { type: "boolean", description: "Add these services to the list (or update ones with the same name) instead of replacing it." },
                    remove_services: { type: "array", items: { type: "string" }, description: "Names of services to take off." },
                    hours: { type: "object", description: "By day name (monday…sunday): {open:\"09:00\", close:\"18:00\"}, or null for closed.", additionalProperties: true },
                    chairs: { type: "number" },
                    deposit: { type: "object", properties: { kind: { type: "string", enum: ["none", "fixed", "percent"] }, amount: { type: "number" }, percent: { type: "number" } } },
                    hold_minutes: { type: "number" },
                    reminders: { type: "boolean" },
                },
            },
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
    book_appointment: "Checking the schedule",
    update_schedule: "Preparing the schedule",
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
            if (!booking) return { error: "That booking wasn't found. Look it up with get_schedule or list_bookings." };
            const change = args.change === "done" || args.change === "cancelled" || args.change === "no_show" || args.change === "move" ? args.change : null;
            if (!change) return { error: "Say done, no_show, cancelled or move." };
            if (booking.status === change) return { error: `That booking is already ${change.replace("_", " ")}.` };
            const inBook = booking.source === "schedule" || booking.source === "owner";
            const [{ businessTimeZone }, slots] = await Promise.all([import("@/lib/studio/business-zone"), import("@/lib/studio/schedule-slots")]);
            const timeZone = await businessTimeZone(db, project.id);
            const when = booking.starts_at ? slots.describeStart(timeZone, new Date(booking.starts_at)) : booking.start ?? "Not given";
            if (change === "move") {
                if (!inBook) return { error: "Only appointments in Studio's appointment book can be moved here; this one is on the owner's calendar." };
                const start = slots.parseStart(args.start, timeZone);
                if (!start) return { error: "Give the new start as YYYY-MM-DDTHH:MM in the business's local time." };
                return {
                    proposal: {
                        id, kind: name, tier: "normal",
                        title: `Move ${booking.title} to ${slots.describeStart(timeZone, start)}`,
                        details: [{ label: "Booking", value: booking.title }, { label: "Was", value: when }, { label: "Now", value: slots.describeStart(timeZone, start) }, { label: "Then", value: "They're told in their chat." }],
                        request: { method: "PATCH", path: "/api/studio/schedule/appointments", body: { project_id: project.id, id: booking.id, action: "move", start: args.start } },
                        doneMessage: "Moved, and they've been told.",
                    },
                };
            }
            const label = { done: "Mark done", no_show: "Mark no-show", cancelled: "Cancel" }[change];
            return {
                proposal: {
                    id, kind: name, tier: change === "cancelled" ? "destructive" : "normal",
                    title: `${label}: ${booking.title}`,
                    details: [{ label: "Booking", value: booking.title }, { label: "When", value: when }, { label: "Now", value: booking.status.replace("_", " ") }, ...(inBook && change === "cancelled" ? [{ label: "Then", value: "They're told in their chat." }] : [])],
                    request: inBook
                        ? { method: "PATCH", path: "/api/studio/schedule/appointments", body: { project_id: project.id, id: booking.id, action: change } }
                        : { method: "POST", path: "/api/studio/sales", body: { project_id: project.id, kind: "booking", id: booking.id, action: change } },
                    doneMessage: change === "done" ? "Booking marked done." : change === "no_show" ? "Marked as a no-show." : "Booking cancelled.",
                },
            };
        }

        case "book_appointment": {
            const [{ getSchedule, appointmentsOf }, slots, { businessTimeZone }] = await Promise.all([import("@/lib/studio/schedule"), import("@/lib/studio/schedule-slots"), import("@/lib/studio/business-zone")]);
            const [schedule, timeZone] = await Promise.all([getSchedule(db, project.id), businessTimeZone(db, project.id)]);
            if (!schedule?.settings.services.length) return { error: "There's no appointment book yet. Set up the services first (update_schedule)." };
            const service = slots.findService(schedule.settings.services, args.service);
            if (!service) return { error: `No service called "${String(args.service ?? "")}". Services: ${schedule.settings.services.map((item) => item.name).join(", ")}.` };
            const start = slots.parseStart(args.start, timeZone);
            if (!start) return { error: "Give the start as YYYY-MM-DDTHH:MM in the business's local time." };
            const who = clean(args.name, 100);
            if (!who) return { error: "Who is it for?" };
            const problem = slots.slotProblem({ settings: schedule.settings, service, start, timeZone, appointments: appointmentsOf(await listBookings(db, project.id)), byOwner: true });
            if (problem) return { error: problem };
            const phone = clean(args.phone, 30);
            const note = clean(args.note, 500);
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: `Book ${who}: ${service.name}, ${slots.describeStart(timeZone, start)}`,
                    details: [{ label: "Service", value: `${service.name} (${slots.describeMinutes(service.minutes)})` }, { label: "When", value: slots.describeStart(timeZone, start) }, { label: "For", value: who }, ...(phone ? [{ label: "Phone", value: phone }] : []), ...(note ? [{ label: "Note", value: note }] : [])],
                    request: { method: "POST", path: "/api/studio/schedule/appointments", body: { project_id: project.id, service: service.id, start: args.start, name: who, ...(phone ? { phone } : {}), ...(note ? { note } : {}) } },
                    doneMessage: `Booked ${who} in.`,
                },
            };
        }

        case "update_schedule": {
            const [{ getSchedule }, slots] = await Promise.all([import("@/lib/studio/schedule"), import("@/lib/studio/schedule-slots")]);
            const current = (await getSchedule(db, project.id))?.settings ?? slots.DEFAULT_SETTINGS;
            const next = { ...current, services: [...current.services], hours: [...current.hours] };
            const changes: Array<{ label: string; value: string }> = [];
            if (Array.isArray(args.services)) {
                const cleaned = args.services.map((item) => (item && typeof item === "object" ? slots.cleanService(item as Record<string, unknown>) : null));
                const bad = cleaned.find((result) => !result?.ok);
                if (bad && !bad.ok) return { error: bad.message };
                const services = cleaned.flatMap((result) => (result?.ok ? [result.service] : []));
                if (args.add_services === true) {
                    for (const service of services) {
                        const index = next.services.findIndex((item) => item.name.toLowerCase() === service.name.toLowerCase());
                        if (index >= 0) next.services[index] = { ...service, id: next.services[index].id };
                        else next.services.push(service);
                    }
                } else next.services = services;
                changes.push({ label: args.add_services === true ? "Services added" : "Services", value: services.map((service) => `${service.name} (${slots.describeMinutes(service.minutes)}${service.price !== null ? `, ${money(service.price, "NGN")}` : ""})`).join("; ") });
            }
            if (Array.isArray(args.remove_services) && args.remove_services.length) {
                const names = args.remove_services.map((item) => String(item).toLowerCase());
                next.services = next.services.filter((service) => !names.includes(service.name.toLowerCase()));
                changes.push({ label: "Services removed", value: args.remove_services.join(", ") });
            }
            if (args.hours && typeof args.hours === "object") {
                const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                for (const [key, value] of Object.entries(args.hours as Record<string, unknown>)) {
                    const index = days.indexOf(key.toLowerCase());
                    if (index < 0) continue;
                    const day = value as { open?: unknown; close?: unknown } | null;
                    next.hours[index] = day && typeof day.open === "string" && typeof day.close === "string" ? { open: day.open, close: day.close } : null;
                }
                changes.push({ label: "Hours", value: slots.describeHours(slots.readSettings(next).hours) });
            }
            if (typeof args.chairs === "number") { next.chairs = args.chairs; changes.push({ label: "At once", value: `${Math.round(args.chairs)}` }); }
            if (args.deposit && typeof args.deposit === "object") {
                next.deposit = args.deposit as typeof next.deposit;
                const rule = slots.readSettings(next).deposit;
                changes.push({ label: "Deposit", value: rule.kind === "fixed" ? money(rule.amount, "NGN") : rule.kind === "percent" ? `${rule.percent}% of the price` : "None" });
            }
            if (typeof args.hold_minutes === "number") { next.hold_minutes = args.hold_minutes; changes.push({ label: "Hold for deposit", value: slots.describeMinutes(Math.round(args.hold_minutes)) }); }
            if (typeof args.reminders === "boolean") { next.reminders = args.reminders; changes.push({ label: "Reminders", value: args.reminders ? "On" : "Off" }); }
            if (!changes.length) return { error: "Nothing to change. Say what to set." };
            const settings = slots.readSettings(next);
            if (!settings.services.length) return { error: "The book needs at least one service (name and how long it takes)." };
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: current.services.length ? "Update the appointment book" : "Set up the appointment book",
                    details: changes,
                    request: { method: "PUT", path: "/api/studio/schedule", body: { project_id: project.id, settings } },
                    doneMessage: current.services.length ? "Schedule updated." : "Your appointment book is set up. I'll book customers into it from now on.",
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
