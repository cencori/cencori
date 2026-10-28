import "server-only";

import { randomBytes, randomInt } from "crypto";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import { escapeHtml, sendEmail } from "@/lib/email/sendbyte";
import { pushToOwners } from "@/lib/studio/push";

/**
 * Events: a business sells tickets for a party, a show, a dinner. A public
 * page (studio.cencori.com/e/<slug>) takes the order; seats are reserved in
 * the database (reserve_studio_tickets), so a tier can't oversell; the buyer
 * pays by the business's own payment link, or by transfer the owner confirms;
 * each paid ticket has a QR code the door scans (or types) to check in.
 */

type Admin = ReturnType<typeof createAdminClient>;

export interface EventTier { id: string; name: string; price: number; capacity: number | null }

export interface StudioEvent {
    id: string;
    project_id: string;
    slug: string;
    name: string;
    description: string;
    venue: string;
    starts_at: string;
    ends_at: string | null;
    currency: string;
    tiers: EventTier[];
    status: "live" | "closed" | "cancelled";
    /** The banner or flyer the owner uploaded, null for none. */
    banner_url: string | null;
    created_at: string;
}

export interface Ticket {
    id: string;
    event_id: string;
    tier_id: string;
    code: string;
    order_ref: string;
    buyer_name: string;
    buyer_phone: string | null;
    buyer_email: string | null;
    price: number;
    status: "reserved" | "paid" | "cancelled";
    payment_reference: string | null;
    reserved_until: string | null;
    paid_at: string | null;
    checked_in_at: string | null;
    created_at: string;
}

const EVENT_COLUMNS = "id, project_id, slug, name, description, venue, starts_at, ends_at, currency, tiers, status, banner_url, created_at";
const TICKET_COLUMNS = "id, event_id, tier_id, code, order_ref, buyer_name, buyer_phone, buyer_email, price, status, payment_reference, reserved_until, paid_at, checked_in_at, created_at";
/** How long a seat is held while the buyer pays (a transfer takes longer than a card). */
const HOLD_CARD_MINUTES = 30;
const HOLD_TRANSFER_MINUTES = 24 * 60;
const MAX_PER_ORDER = 20;
/** The assistant's events briefing, per project (eventsBriefing); cleared when an event changes. */
const briefingCache = new Map<string, { text: string; at: number }>();
const BRIEFING_TTL_MS = 60_000;
const TIERS_MAX = 8;
/** No 0/O, 1/I/L: codes are read out and typed at the door. */
const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function ticketCode(): string {
    return Array.from({ length: 7 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join("");
}

export function slugify(name: string): string {
    return name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "event";
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Check what the owner (or Copilot) sends to make an event. */
export function cleanEvent(input: Record<string, unknown>): { ok: true; event: Omit<StudioEvent, "id" | "project_id" | "slug" | "status" | "created_at" | "banner_url"> } | { ok: false; message: string } {
    const name = text(input.name, 120);
    if (!name) return { ok: false, message: "Give the event a name." };
    const startsAt = typeof input.starts_at === "string" ? new Date(input.starts_at) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) return { ok: false, message: "When does it start?" };
    const endsAt = typeof input.ends_at === "string" && input.ends_at ? new Date(input.ends_at) : null;
    if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt)) return { ok: false, message: "It has to end after it starts." };
    const rawTiers = Array.isArray(input.tiers) ? input.tiers.slice(0, TIERS_MAX) : [];
    const tiers: EventTier[] = [];
    for (const raw of rawTiers) {
        const tier = (raw ?? {}) as Record<string, unknown>;
        const tierName = text(tier.name, 60);
        const price = Number(tier.price);
        const capacity = tier.capacity === null || tier.capacity === undefined || tier.capacity === "" ? null : Math.floor(Number(tier.capacity));
        if (!tierName) return { ok: false, message: "Every ticket type needs a name." };
        if (!(price >= 0 && price <= 100_000_000)) return { ok: false, message: `${tierName} needs a price (0 for free).` };
        if (capacity !== null && !(capacity >= 1 && capacity <= 100_000)) return { ok: false, message: `How many ${tierName} tickets?` };
        tiers.push({ id: typeof tier.id === "string" && /^t_[a-z0-9]{4,12}$/.test(tier.id) ? tier.id : `t_${randomBytes(3).toString("hex")}`, name: tierName, price: Math.round(price * 100) / 100, capacity });
    }
    if (!tiers.length) return { ok: false, message: "Add at least one ticket type (Regular ₦10,000, say)." };
    const currency = typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency) ? input.currency : "NGN";
    return { ok: true, event: { name, description: text(input.description, 2000), venue: text(input.venue, 200), starts_at: startsAt.toISOString(), ends_at: endsAt?.toISOString() ?? null, currency, tiers } };
}

export async function createEvent(db: Admin, projectId: string, userId: string, input: Record<string, unknown>): Promise<{ ok: true; event: StudioEvent } | { ok: false; message: string }> {
    const cleaned = cleanEvent(input);
    if (!cleaned.ok) return cleaned;
    const base = slugify(cleaned.event.name);
    for (let attempt = 0; attempt < 5; attempt++) {
        const slug = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
        const { data, error } = await db.from("studio_events" as never).insert({ ...cleaned.event, project_id: projectId, slug, created_by: userId } as never).select(EVENT_COLUMNS).single();
        if (!error && data) return { ok: true, event: data as StudioEvent };
        if ((error as { code?: string } | null)?.code !== "23505") return { ok: false, message: "Couldn't save the event." };
    }
    return { ok: false, message: "Couldn't find a free address for that name. Try another name." };
}

const EDITABLE = ["name", "description", "venue", "starts_at", "ends_at", "tiers", "currency"] as const;

/**
 * New ticket types against what's sold: a type keeps its id when it's the same
 * one (by id, or by name, as Copilot refers to them), so sold tickets still
 * point at it; a type with tickets sold can't be removed, nor cut below what's
 * sold. Prices may change: tickets already bought keep what was paid.
 */
export function checkTierChanges(current: EventTier[], next: EventTier[], taken: Record<string, number>): { ok: true; tiers: EventTier[] } | { ok: false; message: string } {
    const byName = new Map(current.map((tier) => [tier.name.trim().toLowerCase(), tier]));
    const tiers = next.map((tier) => {
        const same = current.find((item) => item.id === tier.id) ?? byName.get(tier.name.trim().toLowerCase());
        return same ? { ...tier, id: same.id } : tier;
    });
    for (const old of current) {
        const sold = taken[old.id] ?? 0;
        const kept = tiers.find((tier) => tier.id === old.id);
        if (!kept && sold > 0) return { ok: false, message: `${old.name} has ${sold} ticket${sold === 1 ? "" : "s"} sold, so it can't be removed. Stop selling the event instead, or keep it.` };
        if (kept && kept.capacity !== null && kept.capacity < sold) return { ok: false, message: `${old.name} has ${sold} sold already, so it needs at least ${sold}.` };
    }
    return { ok: true, tiers };
}

/** Tickets that count against each tier now: paid, or reserved and still held. */
async function takenByTier(db: Admin, eventId: string): Promise<Record<string, number>> {
    const { data } = await db.from("studio_tickets" as never).select("tier_id, status, reserved_until").eq("event_id", eventId).in("status", ["paid", "reserved"]);
    const taken: Record<string, number> = {};
    for (const ticket of (data ?? []) as Array<Pick<Ticket, "tier_id" | "status" | "reserved_until">>) if (counts(ticket)) taken[ticket.tier_id] = (taken[ticket.tier_id] ?? 0) + 1;
    return taken;
}

/**
 * Change an event: its details, its ticket types, or whether it's selling.
 * The address (slug) stays, since the link is already shared. When the date,
 * time or place changes, everyone who has a ticket is emailed.
 */
export async function updateEvent(db: Admin, projectId: string, eventId: string, input: Record<string, unknown>): Promise<{ ok: true; event: StudioEvent; told: number } | { ok: false; message: string }> {
    const current = await eventById(db, projectId, eventId);
    if (!current) return { ok: false, message: "That event wasn't found." };
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.status === "live" || input.status === "closed" || input.status === "cancelled") patch.status = input.status;
    const edits = Object.fromEntries(EDITABLE.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
    if (Object.keys(edits).length) {
        const cleaned = cleanEvent({ ...current, ...edits });
        if (!cleaned.ok) return cleaned;
        const tiers = checkTierChanges(current.tiers, cleaned.event.tiers, await takenByTier(db, eventId));
        if (!tiers.ok) return tiers;
        Object.assign(patch, cleaned.event, { tiers: tiers.tiers });
    }
    const { data, error } = await db.from("studio_events" as never).update(patch as never).eq("id", eventId).eq("project_id", projectId).select(EVENT_COLUMNS).single();
    if (error || !data) return { ok: false, message: "Couldn't save the event." };
    const event = data as StudioEvent;
    briefingCache.delete(projectId);
    const moved = event.starts_at !== current.starts_at || event.venue !== current.venue || event.ends_at !== current.ends_at;
    const told = moved || patch.status === "cancelled" ? await tellTicketHolders(db, event, patch.status === "cancelled" ? "cancelled" : "moved") : 0;
    return { ok: true, event, told };
}

/** Email everyone with a paid ticket that the event moved (date, time, place) or was cancelled. */
async function tellTicketHolders(db: Admin, event: StudioEvent, what: "moved" | "cancelled"): Promise<number> {
    const { data } = await db.from("studio_tickets" as never).select("buyer_email, buyer_name, order_ref").eq("event_id", event.id).eq("status", "paid").not("buyer_email", "is", null).limit(5_000);
    const byEmail = new Map<string, { name: string; order: string }>();
    for (const row of (data ?? []) as Array<{ buyer_email: string; buyer_name: string; order_ref: string }>) byEmail.set(row.buyer_email.toLowerCase(), { name: row.buyer_name, order: row.order_ref });
    const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(event.starts_at));
    let sent = 0;
    for (const [email, holder] of byEmail) {
        const link = `https://studio.cencori.com/e/${event.slug}/order/${holder.order}`;
        const ok = await sendEmail({
            to: [email],
            subject: what === "cancelled" ? `Cancelled: ${event.name}` : `Change to ${event.name}`,
            html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<h1 style="margin:0 0 10px;font-size:20px;color:#18181b">${escapeHtml(what === "cancelled" ? `${event.name} is cancelled` : `${event.name} has changed`)}</h1>
<p style="margin:0 0 18px;color:#3f3f46;font-size:15px;line-height:22px">${what === "cancelled" ? "The organiser has cancelled this event. Contact them about your ticket." : `It's now on <b>${escapeHtml(date)}</b>${event.venue ? ` at <b>${escapeHtml(event.venue)}</b>` : ""}. Your ticket${holder.name ? `, ${escapeHtml(holder.name)},` : ""} still works.`}</p>
${what === "cancelled" ? "" : `<a href="${link}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:999px">Show my ticket</a>`}
</div></body></html>`,
        }).catch(() => false);
        if (ok) sent++;
    }
    return sent;
}

/** Set or clear an event's banner (the upload route stores the file first). */
export async function setEventBanner(db: Admin, projectId: string, eventId: string, bannerUrl: string | null): Promise<StudioEvent | null> {
    const { data } = await db.from("studio_events" as never).update({ banner_url: bannerUrl, updated_at: new Date().toISOString() } as never).eq("id", eventId).eq("project_id", projectId).select(EVENT_COLUMNS).maybeSingle();
    return (data as StudioEvent | null) ?? null;
}

export async function eventById(db: Admin, projectId: string, eventId: string): Promise<StudioEvent | null> {
    const { data } = await db.from("studio_events" as never).select(EVENT_COLUMNS).eq("id", eventId).eq("project_id", projectId).maybeSingle();
    return (data as StudioEvent | null) ?? null;
}

/** Who's hosting: the business's name (its organization in Studio). */
export async function eventHost(db: Admin, event: Pick<StudioEvent, "project_id">): Promise<string> {
    const { data } = await db.from("projects").select("name, organizations!inner(name)").eq("id", event.project_id).maybeSingle();
    const row = data as unknown as { name?: string; organizations?: { name?: string } } | null;
    return row?.organizations?.name?.trim() || row?.name?.trim() || "";
}

export async function eventBySlug(db: Admin, slug: string): Promise<StudioEvent | null> {
    if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) return null;
    const { data } = await db.from("studio_events" as never).select(EVENT_COLUMNS).eq("slug", slug).maybeSingle();
    return (data as StudioEvent | null) ?? null;
}

/** Tickets that count: paid, or reserved and still held. */
function counts(ticket: Pick<Ticket, "status" | "reserved_until">, now = Date.now()): boolean {
    return ticket.status === "paid" || (ticket.status === "reserved" && !!ticket.reserved_until && Date.parse(ticket.reserved_until) > now);
}

/** Seats left in each tier (null: no limit). */
export async function seatsLeft(db: Admin, event: StudioEvent): Promise<Record<string, number | null>> {
    const { data } = await db.from("studio_tickets" as never).select("tier_id, status, reserved_until").eq("event_id", event.id).in("status", ["paid", "reserved"]);
    const taken = new Map<string, number>();
    for (const ticket of (data ?? []) as Array<Pick<Ticket, "tier_id" | "status" | "reserved_until">>) if (counts(ticket)) taken.set(ticket.tier_id, (taken.get(ticket.tier_id) ?? 0) + 1);
    return Object.fromEntries(event.tiers.map((tier) => [tier.id, tier.capacity === null ? null : Math.max(0, tier.capacity - (taken.get(tier.id) ?? 0))]));
}

export interface EventSummary {
    event: StudioEvent;
    sold: number;
    capacity: number | null;
    earned: number;
    checked_in: number;
    by_tier: Array<{ id: string; name: string; price: number; capacity: number | null; sold: number }>;
}

export async function eventSummaries(db: Admin, projectId: string): Promise<EventSummary[]> {
    const { data: events } = await db.from("studio_events" as never).select(EVENT_COLUMNS).eq("project_id", projectId).neq("status", "cancelled").order("starts_at", { ascending: false }).limit(100);
    const list = (events ?? []) as StudioEvent[];
    if (!list.length) return [];
    const { data: tickets } = await db.from("studio_tickets" as never).select("event_id, tier_id, price, checked_in_at").eq("project_id", projectId).eq("status", "paid").limit(20_000);
    const paid = (tickets ?? []) as Array<Pick<Ticket, "event_id" | "tier_id" | "price" | "checked_in_at">>;
    return list.map((event) => {
        const mine = paid.filter((ticket) => ticket.event_id === event.id);
        const capacity = event.tiers.every((tier) => tier.capacity !== null) ? event.tiers.reduce((sum, tier) => sum + (tier.capacity ?? 0), 0) : null;
        return {
            event,
            sold: mine.length,
            capacity,
            earned: mine.reduce((sum, ticket) => sum + Number(ticket.price), 0),
            checked_in: mine.filter((ticket) => ticket.checked_in_at).length,
            by_tier: event.tiers.map((tier) => ({ ...tier, sold: mine.filter((ticket) => ticket.tier_id === tier.id).length })),
        };
    });
}

export async function guestList(db: Admin, projectId: string, eventId: string): Promise<Ticket[]> {
    const { data } = await db.from("studio_tickets" as never).select(TICKET_COLUMNS).eq("project_id", projectId).eq("event_id", eventId).eq("status", "paid").order("paid_at", { ascending: false }).limit(5_000);
    return (data ?? []) as Ticket[];
}

export async function orderTickets(db: Admin, orderRef: string): Promise<Ticket[]> {
    if (!/^EVT-[A-Z0-9]{8}$/.test(orderRef)) return [];
    const { data } = await db.from("studio_tickets" as never).select(TICKET_COLUMNS).eq("order_ref", orderRef).order("created_at", { ascending: true });
    return (data ?? []) as Ticket[];
}

export type BuyResult =
    | { ok: true; orderRef: string; paid: true }
    | { ok: true; orderRef: string; paid: false; link: string }
    | { ok: true; orderRef: string; paid: false; transfer: { reference: string; instructions: string } }
    | { ok: false; message: string };

/**
 * A buyer's order from the event page: seats reserved first (so a tier can't
 * oversell), then paid by the business's payment link, or by transfer.
 */
export async function buyTickets(db: Admin, event: StudioEvent, request: { tierId: string; quantity: number; name: string; phone: string | null; email: string | null }): Promise<BuyResult> {
    if (event.status !== "live") return { ok: false, message: "Tickets for this event aren't on sale." };
    if (Date.parse(event.ends_at ?? event.starts_at) + 6 * 3_600_000 < Date.now()) return { ok: false, message: "This event has already happened." };
    const tier = event.tiers.find((item) => item.id === request.tierId);
    if (!tier) return { ok: false, message: "Choose a ticket type." };
    const quantity = Math.floor(request.quantity);
    if (!(quantity >= 1 && quantity <= MAX_PER_ORDER)) return { ok: false, message: `Choose 1 to ${MAX_PER_ORDER} tickets.` };
    const name = request.name.trim().slice(0, 80);
    if (!name) return { ok: false, message: "Add your name." };
    const total = Math.round(tier.price * quantity * 100) / 100;

    // How it'll be paid decides how long the seats are held.
    const [{ getPaymentsConnection, requestPayment }, { getTransfers, startTransfer }] = await Promise.all([import("@/lib/embedded/payments"), import("@/lib/embedded/transfers")]);
    const [payments, transfers] = total > 0 ? await Promise.all([getPaymentsConnection(db, event.project_id), getTransfers(db, event.project_id)]) : [null, null];
    const byCard = !!payments && payments.metadata.currency === event.currency;
    const byTransfer = !byCard && !!transfers && event.currency === "NGN";
    if (total > 0 && !byCard && !byTransfer) return { ok: false, message: "This event isn't taking payments yet. Contact the organiser." };

    const orderRef = `EVT-${randomBytes(4).toString("hex").toUpperCase()}`;
    const codes = Array.from({ length: quantity }, ticketCode);
    const { data: reserved, error } = await db.rpc("reserve_studio_tickets" as never, {
        p_event_id: event.id, p_tier_id: tier.id, p_quantity: quantity, p_capacity: tier.capacity, p_price: tier.price,
        p_order_ref: orderRef, p_codes: codes, p_buyer_name: name, p_buyer_phone: request.phone, p_buyer_email: request.email,
        p_hold_minutes: byTransfer ? HOLD_TRANSFER_MINUTES : HOLD_CARD_MINUTES,
    } as never);
    if (error) return { ok: false, message: "Couldn't reserve the tickets. Try again." };
    if (!reserved) return { ok: false, message: tier.capacity === null ? "Tickets aren't on sale right now." : `Not enough ${tier.name} tickets left.` };
    if (total === 0) {
        await afterPaid(db, orderRef);
        return { ok: true, orderRef, paid: true };
    }

    const { data: agent } = await db.from("agents").select("id").eq("project_id", event.project_id).order("created_at", { ascending: true }).limit(1).maybeSingle();
    const agentId = (agent?.id as string | undefined) ?? "";
    const description = `${quantity} × ${tier.name}, ${event.name} (${orderRef})`.slice(0, 200);
    const release = () => db.from("studio_tickets" as never).update({ status: "cancelled" } as never).eq("order_ref", orderRef).eq("status", "reserved");
    if (byCard) {
        const started = await requestPayment({ db, projectId: event.project_id, agentId, surface: "event", conversationId: null }, { amount: total, description, email: request.email });
        if (!started.ok) {
            await release();
            return { ok: false, message: started.message };
        }
        await db.from("studio_tickets" as never).update({ payment_reference: started.reference } as never).eq("order_ref", orderRef);
        return { ok: true, orderRef, paid: false, link: started.link };
    }
    const started = await startTransfer({ db, projectId: event.project_id, agentId, conversationId: null }, { amount: total, description, orderId: orderRef, customer: [name, request.phone].filter(Boolean).join(", ") });
    if (!started.ok) {
        await release();
        return { ok: false, message: started.message };
    }
    await db.from("studio_tickets" as never).update({ payment_reference: started.reference } as never).eq("order_ref", orderRef);
    return { ok: true, orderRef, paid: false, transfer: { reference: started.reference, instructions: started.instructions } };
}

/**
 * The payment for an order came in (a link paid, a transfer confirmed): its
 * tickets are paid, even if the hold ran out meanwhile (a payment wins), and
 * the buyer gets their tickets by email, the owner a notification.
 */
export async function markTicketsPaid(db: Admin, by: { paymentReference?: string; orderRef?: string }): Promise<boolean> {
    let query = db.from("studio_tickets" as never).update({ status: "paid", paid_at: new Date().toISOString(), reserved_until: null } as never).neq("status", "paid");
    if (by.paymentReference) query = query.eq("payment_reference", by.paymentReference);
    else if (by.orderRef && /^EVT-[A-Z0-9]{8}$/.test(by.orderRef)) query = query.eq("order_ref", by.orderRef);
    else return false;
    const { data } = await query.select("order_ref");
    const orderRef = ((data ?? []) as Array<{ order_ref: string }>)[0]?.order_ref;
    if (!orderRef) return false;
    await afterPaid(db, orderRef);
    return true;
}

async function afterPaid(db: Admin, orderRef: string): Promise<void> {
    const tickets = await orderTickets(db, orderRef);
    const first = tickets[0];
    if (!first) return;
    const { data } = await db.from("studio_events" as never).select(EVENT_COLUMNS).eq("id", first.event_id).maybeSingle();
    const event = data as StudioEvent | null;
    if (!event) return;
    const tier = event.tiers.find((item) => item.id === first.tier_id);
    const total = tickets.reduce((sum, ticket) => sum + Number(ticket.price), 0);
    const link = `https://studio.cencori.com/e/${event.slug}/order/${orderRef}`;
    await Promise.allSettled([
        pushToOwners(db, event.project_id, { title: `${tickets.length} ticket${tickets.length === 1 ? "" : "s"} sold`, body: `${first.buyer_name} · ${tier?.name ?? ""} · ${event.name}`, url: "/sales?view=events", tag: `event-${event.id}` }),
        first.buyer_email ? sendEmail({
            to: [first.buyer_email],
            subject: `Your ticket${tickets.length === 1 ? "" : "s"}: ${event.name}`,
            html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<h1 style="margin:0 0 6px;font-size:20px;color:#18181b">${escapeHtml(event.name)}</h1>
<p style="margin:0 0 18px;color:#52525b;font-size:14px">${tickets.length} × ${escapeHtml(tier?.name ?? "Ticket")}${total ? ` · ${escapeHtml(event.currency === "NGN" ? `₦${total.toLocaleString("en-NG")}` : `${event.currency} ${total}`)}` : ""}</p>
<a href="${link}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:999px">Show my ticket${tickets.length === 1 ? "" : "s"}</a>
<p style="margin:18px 0 0;color:#a1a1aa;font-size:12px">Show the QR code at the door. Order ${escapeHtml(orderRef)}.</p></div></body></html>`,
        }) : Promise.resolve(false),
    ]);
}

export type CheckInResult =
    | { ok: true; ticket: Ticket; tier: string; already: false }
    | { ok: false; reason: "not_found" | "not_paid" | "already"; ticket?: Ticket; tier?: string };

/** The door: a ticket's code (scanned or typed) checks its holder in, once. */
export async function checkIn(db: Admin, projectId: string, eventId: string, rawCode: string): Promise<CheckInResult> {
    // The QR holds the ticket page address; the door may scan that or type the code.
    const code = rawCode.trim().toUpperCase().replace(/^.*\/T\//, "").replace(/[^A-Z0-9]/g, "").slice(0, 12);
    const event = await eventById(db, projectId, eventId);
    if (!event || !code) return { ok: false, reason: "not_found" };
    const { data } = await db.from("studio_tickets" as never).select(TICKET_COLUMNS).eq("event_id", eventId).eq("code", code).maybeSingle();
    const ticket = data as Ticket | null;
    if (!ticket) return { ok: false, reason: "not_found" };
    const tier = event.tiers.find((item) => item.id === ticket.tier_id)?.name ?? "";
    if (ticket.status !== "paid") return { ok: false, reason: "not_paid", ticket, tier };
    // Only one scan wins: the row changes only while it hasn't been checked in.
    const { data: updated } = await db.from("studio_tickets" as never).update({ checked_in_at: new Date().toISOString() } as never).eq("id", ticket.id).is("checked_in_at", null).select(TICKET_COLUMNS);
    const done = ((updated ?? []) as Ticket[])[0];
    if (!done) return { ok: false, reason: "already", ticket, tier };
    return { ok: true, ticket: done, tier, already: false };
}


/**
 * What the business's assistant knows about its events, added to its
 * instructions each turn: what's on, when, where, the prices and what's left,
 * and the link where people buy. Empty when nothing's on sale. Cached a
 * minute, so most turns don't read the database for it.
 */
export async function eventsBriefing(db: Admin, projectId: string, now = Date.now()): Promise<string> {
    const cached = briefingCache.get(projectId);
    if (cached && now - cached.at < BRIEFING_TTL_MS) return cached.text;
    let text = "";
    try {
        const { data } = await db.from("studio_events" as never).select(EVENT_COLUMNS).eq("project_id", projectId).eq("status", "live")
            .gte("starts_at", new Date(now - 12 * 3_600_000).toISOString()).order("starts_at", { ascending: true }).limit(5);
        const events = (data ?? []) as StudioEvent[];
        if (events.length) {
            const lines = await Promise.all(events.map(async (event) => {
                const left = await seatsLeft(db, event);
                const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(event.starts_at));
                const tiers = event.tiers.map((tier) => {
                    const price = tier.price === 0 ? "free" : event.currency === "NGN" ? `₦${tier.price.toLocaleString("en-NG")}` : `${event.currency} ${tier.price}`;
                    const seats = left[tier.id];
                    return `${tier.name} ${price}${seats === 0 ? " (sold out)" : seats !== null && seats <= 30 ? ` (${seats} left)` : ""}`;
                }).join(", ");
                return `- ${event.name}: ${date} (Lagos time)${event.venue ? `, ${event.venue}` : ""}. Tickets: ${tiers}. Buy here: https://studio.cencori.com/e/${event.slug}${event.description ? `\n  ${event.description.replace(/\s+/g, " ").slice(0, 300)}` : ""}`;
            }));
            text = `Events this business is selling tickets for. When someone asks about one, or wants to come, answer from this and send the ticket link: tickets are chosen and paid for on that page, and the QR ticket comes right after. Don't take ticket payments in the chat.\n${lines.join("\n")}`;
        }
    } catch {
        // No events table yet, or a read failed: the assistant just doesn't mention events.
        text = "";
    }
    briefingCache.set(projectId, { text, at: now });
    return text;
}
