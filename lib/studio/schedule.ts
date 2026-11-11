import "server-only";

import type { createAdminClient } from "@/lib/supabaseAdmin";
import { decryptApiKey } from "@/lib/encryption";
import { changeBookings, listBookings, updateBooking, type Booking } from "@/lib/embedded/bookings";
import { businessTimeZone } from "@/lib/studio/business-zone";
import { pushToOwners } from "@/lib/studio/push";
import { addManualMessage, manualMessages } from "@/lib/studio/takeover";
import { REPLY_WINDOW_MS } from "@/lib/studio/inbox";
import {
    describeHours,
    describeMinutes,
    describeStart,
    depositFor,
    findService,
    readSettings,
    slotProblem,
    type ScheduleSettings,
    type Service,
} from "@/lib/studio/schedule-slots";

/**
 * Studio's own appointment book: a salon, clinic or any business that books
 * people in sets its services (how long, how much), opening hours and how
 * many clients it takes at once, and its employee books customers into free
 * slots itself, no Google Calendar needed.
 *
 * - The settings are one `tool_connections` row per project (connector_slug
 *   'schedule'); the appointments are the bookings list (lib/embedded/bookings.ts).
 * - A service with a deposit is booked "held": the slot is kept for the
 *   customer while they pay (a link, or a transfer the owner confirms) and let
 *   go if they don't. A payment confirms it and the customer hears so.
 * - Reminders go out on WhatsApp the day before and two hours before: a normal
 *   message inside WhatsApp's 24-hour window, else the approved reminder
 *   template. "1" confirms, "2" asks for another time; the employee handles
 *   the reply, since the client card tells it about the appointment.
 */

type Admin = ReturnType<typeof createAdminClient>;

export const SCHEDULE_SLUG = "schedule";

/** The reminder Meta has to approve on each business's WhatsApp account. */
export const REMINDER_TEMPLATE = {
    name: "appointment_reminder_v1",
    language: "en",
    category: "UTILITY" as const,
    body: "Hi {{1}}, this is a reminder of your {{2}} appointment at {{3}} on {{4}}. Reply 1 to confirm, or 2 if you need another time.",
    example: ["Tolu", "Knotless braids", "Glow Salon", "Tuesday 3 November at 2pm"],
};

interface ScheduleMetadata {
    kind: "schedule";
    settings: ScheduleSettings;
    /** The reminder template's state on each WhatsApp account (by WABA id), checked now and then. */
    templates?: Record<string, { status: string; checked_at: string }>;
    updated_at: string;
}

export interface Schedule {
    id: string;
    settings: ScheduleSettings;
    templates: Record<string, { status: string; checked_at: string }>;
}

async function scheduleRow(db: Admin, projectId: string): Promise<Schedule | null> {
    const { data } = await db.from("tool_connections").select("id, metadata").eq("project_id", projectId).eq("connector_slug", SCHEDULE_SLUG).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const metadata = data?.metadata as ScheduleMetadata | undefined;
    if (!data || metadata?.kind !== "schedule") return null;
    return { id: data.id as string, settings: readSettings(metadata.settings), templates: metadata.templates ?? {} };
}

export async function getSchedule(db: Admin, projectId: string): Promise<Schedule | null> {
    return scheduleRow(db, projectId);
}

const takesBookingsCache = new Map<string, { value: boolean; expiresAt: number }>();

/** Whether the employee books appointments itself (the business has services set up). Cached 30 seconds: read on every customer turn. */
export async function takesBookingsCached(db: Admin, projectId: string): Promise<boolean> {
    const cached = takesBookingsCache.get(projectId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = !!(await scheduleRow(db, projectId).catch(() => null))?.settings.services.length;
    takesBookingsCache.set(projectId, { value, expiresAt: Date.now() + 30_000 });
    if (takesBookingsCache.size > 5_000) takesBookingsCache.delete(takesBookingsCache.keys().next().value!);
    return value;
}

/** Save the settings, all of them (the app and the employee send the whole thing). */
export async function saveSchedule(db: Admin, projectId: string, input: unknown): Promise<Schedule | null> {
    const settings = readSettings(input);
    const existing = await scheduleRow(db, projectId);
    const metadata: ScheduleMetadata = { kind: "schedule", settings, templates: existing?.templates ?? {}, updated_at: new Date().toISOString() };
    const write = existing
        ? db.from("tool_connections").update({ metadata }).eq("id", existing.id).select("id, metadata").single()
        : db.from("tool_connections").insert({ project_id: projectId, connector_slug: SCHEDULE_SLUG, owner_type: "platform", status: "active", metadata }).select("id, metadata").single();
    const { data, error } = await write;
    if (error || !data) return null;
    takesBookingsCache.delete(projectId);
    return { id: data.id as string, settings, templates: metadata.templates ?? {} };
}

/** Appointments from the book (not calendar bookings), for the app and the employee. */
export function appointmentsOf(bookings: Booking[]): Booking[] {
    return bookings.filter((booking) => booking.source === "schedule" || booking.source === "owner");
}

/** "2348012345678" from "+234 801 234 5678" or "08012345678" (a Nigerian number written locally). */
export function phoneDigits(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const digits = value.replace(/\D/g, "");
    if (/^0\d{10}$/.test(digits)) return `234${digits.slice(1)}`;
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

const formatMoney = (amount: number, currency: string) => {
    try {
        return new Intl.NumberFormat("en-NG", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString("en-NG")}`;
    }
};

/** How the business takes money: its currency (its payment provider's, else naira), and whether a deposit can be paid at all (a provider, or a bank account). */
async function paymentOptions(db: Admin, projectId: string): Promise<{ currency: string; payable: boolean }> {
    const [{ getPaymentsConnection }, { getTransfers }] = await Promise.all([import("@/lib/embedded/payments"), import("@/lib/embedded/transfers")]);
    const [link, transfer] = await Promise.all([getPaymentsConnection(db, projectId, null).catch(() => null), getTransfers(db, projectId).catch(() => null)]);
    return { currency: link?.metadata.currency ?? "NGN", payable: !!link || !!transfer };
}

export interface BookContext {
    db: Admin;
    projectId: string;
    agentId: string;
    agentName?: string;
    surface: "preview" | "conversation" | "run" | "owner";
    conversationId?: string | null;
}

export type BookResult =
    | { ok: true; booking: Booking; payment: { kind: "link"; link: string; amount: string } | { kind: "transfer"; instructions: string; amount: string } | null; heldMinutes: number | null }
    | { ok: false; message: string };

/**
 * Book someone into a free slot. With a deposit (and a way to pay it), the
 * slot is held until it's paid; without one, it's confirmed.
 */
export async function bookAppointment(ctx: BookContext, request: { service: unknown; start: Date; name: string | null; phone: string | null; note: string | null }): Promise<BookResult> {
    const schedule = await scheduleRow(ctx.db, ctx.projectId);
    if (!schedule?.settings.services.length) return { ok: false, message: "The business hasn't set up its services for booking yet." };
    const service = findService(schedule.settings.services, request.service);
    if (!service) return { ok: false, message: `There's no service called "${String(request.service ?? "")}". Services: ${schedule.settings.services.map((item) => item.name).join(", ")}.` };
    const timeZone = await businessTimeZone(ctx.db, ctx.projectId);
    const byOwner = ctx.surface === "owner";
    const { currency, payable } = await paymentOptions(ctx.db, ctx.projectId);
    // A deposit only when the business set one and can be paid (and never on one the owner books): otherwise the booking stands on its own.
    const deposit = payable && !byOwner ? depositFor(schedule.settings, service) : 0;
    const now = new Date();
    const id = crypto.randomUUID();
    const name = request.name?.trim() || null;
    const booking: Booking = {
        id,
        agent_id: ctx.agentId,
        conversation_id: ctx.conversationId ?? null,
        title: `${service.name}${name ? `: ${name}` : ""}`,
        start: request.start.toISOString(),
        detail: request.note,
        status: deposit > 0 ? "held" : "confirmed",
        created_at: now.toISOString(),
        source: byOwner ? "owner" : "schedule",
        service_id: service.id,
        service: service.name,
        starts_at: request.start.toISOString(),
        ends_at: new Date(request.start.getTime() + service.minutes * 60_000).toISOString(),
        customer_name: name,
        customer_phone: request.phone,
        price: service.price,
        currency,
        deposit_due: null,
        held_until: deposit > 0 ? new Date(now.getTime() + schedule.settings.hold_minutes * 60_000).toISOString() : null,
        reminders: {},
        updated_at: now.toISOString(),
    };
    // Previews try the flow without taking a real chair.
    if (ctx.surface === "preview") {
        const problem = slotProblem({ settings: schedule.settings, service, start: request.start, timeZone, appointments: appointmentsOf(await listBookings(ctx.db, ctx.projectId)), now });
        if (problem) return { ok: false, message: problem };
        return { ok: true, booking, payment: deposit > 0 ? { kind: "link", link: "(a payment link is sent here once you're live)", amount: formatMoney(deposit, currency) } : null, heldMinutes: deposit > 0 ? schedule.settings.hold_minutes : null };
    }
    const placed = await changeBookings<Booking>(ctx.db, ctx.projectId, (bookings) => {
        const problem = slotProblem({ settings: schedule.settings, service, start: request.start, timeZone, appointments: appointmentsOf(bookings), now, byOwner });
        return problem ? { error: problem } : { bookings: [...bookings, booking], result: booking };
    });
    if (!placed.ok) return { ok: false, message: placed.message };

    if (deposit <= 0) {
        if (!byOwner) await tellOwnerBooked(ctx, booking, timeZone);
        return { ok: true, booking, payment: null, heldMinutes: null };
    }
    const description = `Deposit: ${service.name}, ${describeStart(timeZone, request.start)}`;
    const payment = await startDeposit(ctx, booking, deposit, description);
    if (!payment.ok) {
        // No way to take it after all: let the slot go rather than hold it for nothing.
        await updateBooking(ctx.db, ctx.projectId, id, (current) => ({ ...current, status: "cancelled", held_until: null }));
        return { ok: false, message: `${payment.message} The slot wasn't kept.` };
    }
    const saved = await updateBooking(ctx.db, ctx.projectId, id, (current) => ({ ...current, deposit_due: payment.deposit }));
    return {
        ok: true,
        booking: saved.ok ? saved.result : booking,
        payment: payment.deposit.method === "link"
            ? { kind: "link", link: payment.deposit.link ?? "", amount: formatMoney(deposit, currency) }
            : { kind: "transfer", instructions: payment.instructions, amount: formatMoney(deposit, currency) },
        heldMinutes: schedule.settings.hold_minutes,
    };
}

/** A payment link through the business's provider, or its bank account to transfer to. */
async function startDeposit(ctx: BookContext, booking: Booking, amount: number, description: string): Promise<{ ok: true; deposit: NonNullable<Booking["deposit_due"]>; instructions: string } | { ok: false; message: string }> {
    const [{ getPaymentsConnection, requestPayment, customerOf }, transfers] = await Promise.all([import("@/lib/embedded/payments"), import("@/lib/embedded/transfers")]);
    if (await getPaymentsConnection(ctx.db, ctx.projectId, ctx.agentId || null)) {
        const started = await requestPayment({ db: ctx.db, projectId: ctx.projectId, agentId: ctx.agentId, agentName: ctx.agentName, surface: ctx.surface, conversationId: ctx.conversationId }, { amount, description, email: null });
        if (!started.ok) return { ok: false, message: started.message };
        return { ok: true, instructions: "", deposit: { amount, currency: booking.currency ?? "NGN", reference: started.reference, method: "link", link: started.link, claimed_at: null, paid_at: null } };
    }
    const customer = await customerOf(ctx.db, ctx.conversationId);
    const started = await transfers.startTransfer({ db: ctx.db, projectId: ctx.projectId, agentId: ctx.agentId, conversationId: ctx.conversationId }, { amount, description, orderId: `APT-${booking.id}`, customer: customer.label ?? booking.customer_name });
    if (!started.ok) return { ok: false, message: started.message };
    return { ok: true, instructions: started.instructions, deposit: { amount, currency: booking.currency ?? "NGN", reference: started.reference, method: "transfer", link: null, claimed_at: null, paid_at: null } };
}

async function tellOwnerBooked(ctx: Pick<BookContext, "db" | "projectId" | "agentId" | "agentName" | "surface" | "conversationId">, booking: Booking, timeZone: string): Promise<void> {
    if (ctx.surface === "preview" || ctx.surface === "owner") return;
    const { notifyBooking } = await import("@/lib/embedded/owner-alerts");
    await notifyBooking(
        { db: ctx.db, projectId: ctx.projectId, agentId: ctx.agentId, agentName: ctx.agentName, surface: ctx.surface, conversationId: ctx.conversationId },
        JSON.stringify({ title: booking.title, start: booking.starts_at, description: [booking.detail, booking.deposit_due?.paid_at ? `Deposit paid: ${formatMoney(booking.deposit_due.amount, booking.deposit_due.currency)}` : null].filter(Boolean).join(". ") || null }),
        { where: "studio", timeZone },
    ).catch(() => undefined);
}

/**
 * A deposit was paid (a link the provider confirmed, or a transfer the owner
 * confirmed): the booking is confirmed, even if its hold ran out meanwhile (a
 * payment wins; the owner hears if that leaves too many in at once), and the
 * customer hears they're booked. Returns whether it was for an appointment.
 */
export async function markAppointmentPaid(db: Admin, projectId: string, reference: string): Promise<boolean> {
    const booking = (await listBookings(db, projectId)).find((item) => item.deposit_due?.reference === reference);
    if (!booking) return false;
    if (booking.deposit_due?.paid_at) return true;
    const paidAt = new Date().toISOString();
    const updated = await updateBooking(db, projectId, booking.id, (current) => ({
        ...current,
        status: current.status === "held" || current.status === "cancelled" ? "confirmed" : current.status,
        held_until: null,
        deposit_due: current.deposit_due ? { ...current.deposit_due, paid_at: paidAt } : current.deposit_due,
    }));
    if (!updated.ok) return true;
    const timeZone = await businessTimeZone(db, projectId);
    const when = updated.result.starts_at ? describeStart(timeZone, new Date(updated.result.starts_at)) : "";
    await Promise.allSettled([
        messageCustomer(db, projectId, updated.result, `You're booked: ${updated.result.service ?? "your appointment"}, ${when}. See you then!`),
        tellOwnerBooked({ db, projectId, agentId: updated.result.agent_id, surface: "conversation", conversationId: updated.result.conversation_id }, updated.result, timeZone),
        tooManyAfterPayment(db, projectId, updated.result, timeZone),
    ]);
    return true;
}

/** A deposit paid after its hold ran out can land on a slot someone else took: tell the owner. */
async function tooManyAfterPayment(db: Admin, projectId: string, booking: Booking, timeZone: string): Promise<void> {
    const schedule = await scheduleRow(db, projectId);
    const service = schedule ? findService(schedule.settings.services, booking.service_id) : null;
    if (!schedule || !service || !booking.starts_at) return;
    const problem = slotProblem({ settings: schedule.settings, service, start: new Date(booking.starts_at), timeZone, appointments: appointmentsOf(await listBookings(db, projectId)), ignoreId: booking.id, byOwner: true });
    if (!problem) return;
    await pushToOwners(db, projectId, { title: "Double booked", body: `${booking.title} paid after their hold ran out, and ${describeStart(timeZone, new Date(booking.starts_at))} is now over-full. Move someone.`, url: "/schedule", tag: `clash-${booking.id}` });
}

/** The customer says they sent the deposit by transfer: hold the slot until the owner confirms or rejects it. */
export async function markAppointmentClaimed(db: Admin, projectId: string, reference: string, claimed: boolean): Promise<void> {
    const booking = (await listBookings(db, projectId)).find((item) => item.deposit_due?.reference === reference);
    if (!booking || booking.status !== "held") return;
    const schedule = await scheduleRow(db, projectId);
    const holdMs = (schedule?.settings.hold_minutes ?? 30) * 60_000;
    await updateBooking(db, projectId, booking.id, (current) => ({
        ...current,
        // Claimed: no end until the owner checks. Rejected: a fresh hold, so they can sort it out.
        held_until: claimed ? null : new Date(Date.now() + holdMs).toISOString(),
        deposit_due: current.deposit_due ? { ...current.deposit_due, claimed_at: claimed ? new Date().toISOString() : null } : null,
    }));
}

export type ChangeResult = { ok: true; booking: Booking } | { ok: false; message: string };

/** Move an appointment to another start (same service), if that's free. */
export async function moveAppointment(db: Admin, projectId: string, bookingId: string, start: Date, opts: { byOwner?: boolean } = {}): Promise<ChangeResult> {
    const schedule = await scheduleRow(db, projectId);
    if (!schedule) return { ok: false, message: "The business has no appointment book set up." };
    const timeZone = await businessTimeZone(db, projectId);
    const now = new Date();
    const moved = await changeBookings<Booking>(db, projectId, (bookings) => {
        const current = bookings.find((item) => item.id === bookingId);
        if (!current || !current.starts_at || !current.ends_at) return { error: "That appointment isn't in the book." };
        if (current.status !== "confirmed" && current.status !== "held") return { error: `That appointment is ${current.status.replace("_", " ")}.` };
        const minutes = Math.round((Date.parse(current.ends_at) - Date.parse(current.starts_at)) / 60_000);
        const service: Service = findService(schedule.settings.services, current.service_id) ?? { id: "", name: current.service ?? "Appointment", minutes, price: current.price ?? null };
        const problem = slotProblem({ settings: schedule.settings, service: { ...service, minutes }, start, timeZone, appointments: appointmentsOf(bookings), now, ignoreId: bookingId, byOwner: opts.byOwner });
        if (problem) return { error: problem };
        const next: Booking = { ...current, start: start.toISOString(), starts_at: start.toISOString(), ends_at: new Date(start.getTime() + minutes * 60_000).toISOString(), reminders: {}, customer_confirmed_at: null, updated_at: now.toISOString() };
        return { bookings: bookings.map((item) => (item.id === bookingId ? next : item)), result: next };
    });
    if (!moved.ok) return moved;
    return { ok: true, booking: moved.result };
}

/** Cancel, mark done or a no-show, or note that the customer confirmed they're coming. */
export async function setAppointment(db: Admin, projectId: string, bookingId: string, change: "cancelled" | "done" | "no_show" | "customer_confirmed"): Promise<ChangeResult> {
    const result = await updateBooking(db, projectId, bookingId, (current) => {
        if (change === "customer_confirmed") return current.status === "confirmed" || current.status === "held" ? { ...current, customer_confirmed_at: new Date().toISOString() } : { error: `That appointment is ${current.status.replace("_", " ")}.` };
        if (current.status === change) return { error: `That appointment is already ${change.replace("_", " ")}.` };
        return { ...current, status: change, held_until: null };
    });
    return result.ok ? { ok: true, booking: result.result } : result;
}

/** The customer's latest conversation on the same channel, where a message to them lands. */
async function latestChat(db: Admin, projectId: string, booking: Booking): Promise<{ id: string; metadata: Record<string, unknown> } | null> {
    if (!booking.conversation_id) return null;
    const { data } = await db.from("sessions").select("id, metadata, external_user_id").eq("id", booking.conversation_id).eq("project_id", projectId).maybeSingle();
    if (!data) return null;
    const metadata = (data.metadata ?? {}) as Record<string, unknown>;
    if (metadata.source !== "whatsapp" || !data.external_user_id) return { id: data.id as string, metadata };
    // A WhatsApp customer who came back later is on a newer conversation.
    const { data: newer } = await db.from("sessions").select("id, metadata").eq("project_id", projectId).eq("external_user_id", data.external_user_id as string)
        .eq("metadata->>channel_id", String(metadata.channel_id ?? "")).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return newer ? { id: newer.id as string, metadata: (newer.metadata ?? {}) as Record<string, unknown> } : { id: data.id as string, metadata };
}

/** When the customer last wrote in a conversation (their turns, or what they said while the owner had it). */
async function lastFromCustomer(db: Admin, sessionId: string, metadata: Record<string, unknown>): Promise<number | null> {
    const { data } = await db.from("session_events").select("created_at").eq("session_id", sessionId).eq("event_type", "turn.started").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const turn = data?.created_at ? Date.parse(data.created_at as string) : Number.NaN;
    const manual = manualMessages(metadata).filter((message) => message.from === "customer").map((message) => Date.parse(message.at));
    const latest = Math.max(Number.isNaN(turn) ? 0 : turn, ...manual, 0);
    return latest || null;
}

/**
 * Write to the customer in their chat, as the employee: WhatsApp inside its
 * 24-hour window (or the template, when given and approved), website and link
 * chats any time. The message is kept in the chat, so the owner sees it and
 * the employee knows it said it.
 */
export async function messageCustomer(db: Admin, projectId: string, booking: Booking, text: string, template?: { values: string[] }): Promise<"sent" | "template" | "unreachable"> {
    const chat = await latestChat(db, projectId, booking);
    if (!chat) return "unreachable";
    if (chat.metadata.source !== "whatsapp") {
        await addManualMessage(db, chat.id, { from: "assistant", text });
        return "sent";
    }
    const number = typeof chat.metadata.customer_number === "string" ? chat.metadata.customer_number : null;
    const channelId = typeof chat.metadata.channel_id === "string" ? chat.metadata.channel_id : null;
    if (!number || !channelId) return "unreachable";
    const { getChannelById, channelAccessToken, sendText, sendTemplate } = await import("@/lib/channels/whatsapp");
    const channel = await getChannelById(db, channelId);
    if (!channel || channel.projectId !== projectId || !channel.metadata.enabled) return "unreachable";
    const { data: project } = await db.from("projects").select("organization_id").eq("id", projectId).maybeSingle();
    const organizationId = (project?.organization_id as string | undefined) ?? "";
    const token = channelAccessToken(channel, (value) => {
        try {
            return decryptApiKey(value, organizationId);
        } catch {
            return null;
        }
    });
    if (!token) return "unreachable";
    const last = await lastFromCustomer(db, chat.id, chat.metadata);
    const open = last !== null && Date.now() - last < REPLY_WINDOW_MS - 5 * 60_000;
    try {
        if (open) {
            await sendText(channel, token, number, text);
            await addManualMessage(db, chat.id, { from: "assistant", text });
            return "sent";
        }
        if (!template || !channel.metadata.waba_id) return "unreachable";
        const schedule = await scheduleRow(db, projectId);
        if (schedule?.templates[channel.metadata.waba_id]?.status !== "APPROVED") return "unreachable";
        await sendTemplate(channel, token, number, REMINDER_TEMPLATE, template.values);
        await addManualMessage(db, chat.id, { from: "assistant", text });
        return "template";
    } catch (error) {
        console.error("[schedule] message failed", error instanceof Error ? error.message : error);
        return "unreachable";
    }
}

/**
 * Submit the reminder template on the business's WhatsApp accounts that
 * don't have it, and note where it stands on each. Run when reminders are on;
 * Meta usually decides within minutes.
 */
export async function syncReminderTemplates(db: Admin, projectId: string): Promise<Record<string, { status: string; checked_at: string }>> {
    const schedule = await scheduleRow(db, projectId);
    if (!schedule) return {};
    const { data } = await db.from("tool_connections").select("id").eq("project_id", projectId).eq("connector_slug", "whatsapp-channel").eq("status", "active");
    const { getChannelById, channelAccessToken, ensureTemplate } = await import("@/lib/channels/whatsapp");
    const { data: project } = await db.from("projects").select("organization_id").eq("id", projectId).maybeSingle();
    const organizationId = (project?.organization_id as string | undefined) ?? "";
    const templates = { ...schedule.templates };
    for (const row of (data ?? []) as Array<{ id: string }>) {
        const channel = await getChannelById(db, row.id);
        const wabaId = channel?.metadata.waba_id;
        if (!channel || !wabaId || templates[wabaId]?.status === "APPROVED") continue;
        const token = channelAccessToken(channel, (value) => {
            try {
                return decryptApiKey(value, organizationId);
            } catch {
                return null;
            }
        });
        if (!token) continue;
        try {
            templates[wabaId] = { status: await ensureTemplate(channel, token, REMINDER_TEMPLATE), checked_at: new Date().toISOString() };
        } catch (error) {
            templates[wabaId] = { status: "ERROR", checked_at: new Date().toISOString() };
            console.error("[schedule] reminder template", wabaId, error instanceof Error ? error.message : error);
        }
    }
    if (JSON.stringify(templates) !== JSON.stringify(schedule.templates)) {
        const { data: current } = await db.from("tool_connections").select("metadata").eq("id", schedule.id).maybeSingle();
        await db.from("tool_connections").update({ metadata: { ...(current?.metadata as object), templates } }).eq("id", schedule.id);
    }
    return templates;
}

const HOUR = 3_600_000;

/** Which reminder is due for an appointment now, if any. */
export function reminderDue(booking: Booking, now: number): "day_before" | "two_hours" | null {
    if (booking.status !== "confirmed" || !booking.starts_at) return null;
    const start = Date.parse(booking.starts_at);
    const created = Date.parse(booking.created_at);
    const sent = booking.reminders ?? {};
    const left = start - now;
    if (left <= 30 * 60_000) return null;
    // Two hours before (the sweep runs every half hour): for anything booked well before then.
    if (!sent.two_hours && left <= 2.5 * HOUR && start - created > 4 * HOUR) return "two_hours";
    // The day before: only when booked more than a day ahead, and not once it's nearly time.
    if (!sent.day_before && !sent.two_hours && left <= 24 * HOUR && left > 4 * HOUR && start - created > 26 * HOUR) return "day_before";
    return null;
}

/** Run every half hour: let go of unpaid holds, and send the reminders that are due. */
export async function sweepSchedules(db: Admin, now = Date.now()): Promise<{ released: number; reminded: number; skipped: number }> {
    const { data } = await db.from("tool_connections").select("project_id").eq("connector_slug", SCHEDULE_SLUG).eq("status", "active").limit(2_000);
    let released = 0;
    let reminded = 0;
    let skipped = 0;
    for (const { project_id: projectId } of (data ?? []) as Array<{ project_id: string }>) {
        try {
            const [schedule, bookings, timeZone] = await Promise.all([scheduleRow(db, projectId), listBookings(db, projectId), businessTimeZone(db, projectId)]);
            if (!schedule) continue;
            const book = appointmentsOf(bookings);
            for (const booking of book.filter((item) => item.status === "held" && item.held_until && Date.parse(item.held_until) <= now && !item.deposit_due?.paid_at)) {
                const let_go = await updateBooking(db, projectId, booking.id, (current) => (current.status === "held" && current.held_until && Date.parse(current.held_until) <= now ? { ...current, status: "cancelled", held_until: null } : { error: "changed" }));
                if (!let_go.ok) continue;
                released++;
                const when = booking.starts_at ? describeStart(timeZone, new Date(booking.starts_at)) : "your appointment";
                await messageCustomer(db, projectId, booking, `I've let go of the ${booking.service ?? "appointment"} slot for ${when} because the deposit didn't come through. Message me if you'd still like to book.`);
            }
            if (!schedule.settings.reminders) continue;
            const due = book.map((booking) => ({ booking, which: reminderDue(booking, now) })).filter((item) => item.which);
            if (!due.length) continue;
            // Reminders outside the 24-hour window need the template approved on the business's account.
            await syncReminderTemplates(db, projectId).catch(() => undefined);
            const { data: project } = await db.from("projects").select("name").eq("id", projectId).maybeSingle();
            const business = (project?.name as string | undefined) ?? "us";
            for (const { booking, which } of due) {
                const when = describeStart(timeZone, new Date(booking.starts_at!));
                const first = booking.customer_name?.split(/\s+/)[0] ?? "there";
                const service = booking.service ?? "appointment";
                const text = which === "day_before"
                    ? `Hi ${first}, a reminder of your ${service} appointment at ${business} tomorrow, ${when}. Reply 1 to confirm, or 2 if you need another time.`
                    : `Hi ${first}, see you soon: your ${service} appointment at ${business} is at ${when}. Reply 1 to confirm, or 2 if you need another time.`;
                const outcome = await messageCustomer(db, projectId, booking, text, { values: [first, service, business, when] });
                const at = new Date().toISOString();
                await updateBooking(db, projectId, booking.id, (current) => ({
                    ...current,
                    reminders: { ...current.reminders, [which!]: outcome === "unreachable" ? `skipped ${at}` : at, ...(outcome === "unreachable" ? { skipped: "Couldn't reach them on WhatsApp (outside 24 hours and the reminder template isn't approved yet, or not a WhatsApp customer)." } : {}) },
                }));
                if (outcome === "unreachable") skipped++;
                else reminded++;
            }
        } catch (error) {
            console.error("[schedule] sweep failed for", projectId, error instanceof Error ? error.message : error);
        }
    }
    return { released, reminded, skipped };
}

/**
 * What the employee is told about the book, on every customer turn: the
 * services, hours and how to book. It replaces the older rule to ask for a
 * callback for appointments.
 */
export async function scheduleBriefing(db: Admin, projectId: string): Promise<string> {
    const schedule = await scheduleRow(db, projectId).catch(() => null);
    if (!schedule?.settings.services.length) return "";
    const { settings } = schedule;
    const [{ currency, payable }, timeZone] = await Promise.all([paymentOptions(db, projectId), businessTimeZone(db, projectId)]);
    const services = settings.services.map((service) => {
        const deposit = payable ? depositFor(settings, service) : 0;
        return `- ${service.name}: ${describeMinutes(service.minutes)}${service.price !== null ? `, ${formatMoney(service.price, currency)}` : ""}${deposit > 0 ? `, deposit ${formatMoney(deposit, currency)}` : ""}`;
    });
    return [
        "Appointments: you book them yourself, into the business's own appointment book. This replaces any instruction to request a callback for appointments.",
        "Services:",
        ...services,
        `Opening hours: ${describeHours(settings.hours)} (${timeZone} time). It's now ${describeStart(timeZone, new Date())} there.`,
        "How to book:",
        "- Find out which service and roughly when, then call check_availability. Offer two or three of the free times; never offer a time it didn't return.",
        "- Before booking, read back the service, day, time and their name, and get a yes. Then call book_appointment with the start as the business's local time, like 2026-11-03T14:00.",
        payable && settings.services.some((service) => depositFor(settings, service) > 0)
            ? `- When there's a deposit, the slot is held for ${describeMinutes(settings.hold_minutes)} while they pay: send the payment link or account details exactly as book_appointment returns them. It's only booked once paid; they hear automatically.`
            : null,
        "- To move or cancel one of their appointments, or when they reply to a reminder (1 means they're coming, 2 means they need another time), use change_appointment. Check availability before moving.",
        "- Only say a time is booked when book_appointment or change_appointment says so.",
    ].filter(Boolean).join("\n");
}

/** A booking as the app shows it. */
export function publicAppointment(booking: Booking) {
    return {
        id: booking.id,
        title: booking.title,
        service: booking.service ?? null,
        service_id: booking.service_id ?? null,
        starts_at: booking.starts_at ?? null,
        ends_at: booking.ends_at ?? null,
        status: booking.status,
        customer_name: booking.customer_name ?? null,
        customer_phone: booking.customer_phone ? `+${booking.customer_phone}` : null,
        price: booking.price ?? null,
        currency: booking.currency ?? "NGN",
        deposit: booking.deposit_due ? { amount: booking.deposit_due.amount, currency: booking.deposit_due.currency, method: booking.deposit_due.method, paid: !!booking.deposit_due.paid_at, claimed: !!booking.deposit_due.claimed_at } : null,
        held_until: booking.held_until ?? null,
        note: booking.detail,
        conversation_id: booking.conversation_id,
        reminders: booking.reminders ?? {},
        customer_confirmed: !!booking.customer_confirmed_at,
        source: booking.source ?? "calendar",
        created_at: booking.created_at,
    };
}

