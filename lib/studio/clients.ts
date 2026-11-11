import "server-only";

import type { createAdminClient } from "@/lib/supabaseAdmin";
import { listBookings, type Booking } from "@/lib/embedded/bookings";
import { getProjectCatalog, orderSummary, type CatalogOrder } from "@/lib/embedded/catalog";
import { businessTimeZone } from "@/lib/studio/business-zone";
import { describeStart } from "@/lib/studio/schedule-slots";
import { appointmentsOf, phoneDigits } from "@/lib/studio/schedule";

/**
 * A card per client, by phone number: their visits (appointments come, missed
 * or cancelled), what's coming up, their orders, what they've spent, and notes
 * the owner (or the employee) kept about them ("allergic to latex", "likes
 * medium knotless"). The history is read from the bookings and orders as they
 * are; only the notes are stored, one `tool_connections` row per project
 * (connector_slug 'clients'), keyed by number.
 *
 * The employee sees the card when that client writes, so it can say "Welcome
 * back Tolu, same knotless braids?"; the owner sees it in the chat.
 */

type Admin = ReturnType<typeof createAdminClient>;

export const CLIENTS_SLUG = "clients";
const NOTES_MAX = 30;
const NOTE_MAX = 300;

export interface ClientNote {
    id: string;
    text: string;
    at: string;
    by: "owner" | "employee";
}

interface ClientsMetadata {
    kind: "clients";
    clients: Record<string, { name?: string | null; notes: ClientNote[] }>;
    updated_at: string;
}

async function notesRow(db: Admin, projectId: string): Promise<{ id: string; metadata: ClientsMetadata } | null> {
    const { data } = await db.from("tool_connections").select("id, metadata").eq("project_id", projectId).eq("connector_slug", CLIENTS_SLUG).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const metadata = data?.metadata as ClientsMetadata | undefined;
    if (!data || metadata?.kind !== "clients") return null;
    return { id: data.id as string, metadata: { ...metadata, clients: metadata.clients && typeof metadata.clients === "object" ? metadata.clients : {} } };
}

async function writeNotes(db: Admin, projectId: string, phone: string, change: (notes: ClientNote[]) => ClientNote[], name?: string | null): Promise<ClientNote[] | null> {
    const row = await notesRow(db, projectId);
    const current = row?.metadata.clients[phone] ?? { notes: [] };
    const notes = change(current.notes ?? []).slice(-NOTES_MAX);
    const clients = { ...(row?.metadata.clients ?? {}), [phone]: { name: name ?? current.name ?? null, notes } };
    const metadata: ClientsMetadata = { kind: "clients", clients, updated_at: new Date().toISOString() };
    const { error } = row
        ? await db.from("tool_connections").update({ metadata }).eq("id", row.id)
        : await db.from("tool_connections").insert({ project_id: projectId, connector_slug: CLIENTS_SLUG, owner_type: "platform", status: "active", metadata });
    return error ? null : notes;
}

/** Keep a note about a client. */
export async function addClientNote(db: Admin, projectId: string, phoneInput: string, text: string, by: ClientNote["by"]): Promise<{ ok: true; note: ClientNote } | { ok: false; message: string }> {
    const phone = phoneDigits(phoneInput);
    const clean = text.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
    if (!phone) return { ok: false, message: "Which client? Give their phone number." };
    if (!clean) return { ok: false, message: "Say what to note." };
    const note: ClientNote = { id: `n_${Math.random().toString(36).slice(2, 10)}`, text: clean, at: new Date().toISOString(), by };
    const saved = await writeNotes(db, projectId, phone, (notes) => [...notes, note]);
    return saved ? { ok: true, note } : { ok: false, message: "Couldn't save the note just now." };
}

export async function removeClientNote(db: Admin, projectId: string, phoneInput: string, noteId: string): Promise<boolean> {
    const phone = phoneDigits(phoneInput);
    if (!phone) return false;
    let found = false;
    const saved = await writeNotes(db, projectId, phone, (notes) => notes.filter((note) => {
        if (note.id !== noteId) return true;
        found = true;
        return false;
    }));
    return !!saved && found;
}

export interface ClientCard {
    phone: string;
    name: string | null;
    visits: number;
    no_shows: number;
    cancelled: number;
    upcoming: Array<{ id: string; service: string | null; starts_at: string; status: string; deposit_paid: boolean; customer_confirmed: boolean; reminders: Booking["reminders"] }>;
    recent: Array<{ service: string | null; starts_at: string | null; status: string }>;
    orders: Array<{ id: string; summary: string; total: number; currency: string; status: string; created_at: string }>;
    spent: { amount: number; currency: string };
    notes: ClientNote[];
    first_seen: string | null;
    chats: string[];
}

/** Everything about one client, by number. */
export async function clientCard(db: Admin, projectId: string, phoneInput: string, now = Date.now()): Promise<ClientCard | null> {
    const phone = phoneDigits(phoneInput);
    if (!phone) return null;
    const [{ data: sessions }, bookings, catalog, notes] = await Promise.all([
        db.from("sessions").select("id, metadata, created_at").eq("project_id", projectId).eq("external_user_id", `wa:${phone}`).order("created_at", { ascending: false }).limit(100),
        listBookings(db, projectId),
        getProjectCatalog(db, projectId).catch(() => null),
        notesRow(db, projectId),
    ]);
    const chats = ((sessions ?? []) as Array<{ id: string; metadata: Record<string, unknown> | null; created_at: string }>);
    const chatIds = new Set(chats.map((chat) => chat.id));
    const mine = (booking: Booking) => booking.customer_phone === phone || (!!booking.conversation_id && chatIds.has(booking.conversation_id));
    const theirs = appointmentsOf(bookings).filter(mine).sort((a, b) => Date.parse(a.starts_at ?? a.created_at) - Date.parse(b.starts_at ?? b.created_at));
    const calendar = bookings.filter((booking) => !appointmentsOf([booking]).length && mine(booking));
    const orders = (catalog?.metadata.orders ?? []).filter((order: CatalogOrder) => (!!order.conversation_id && chatIds.has(order.conversation_id)) || (order.customer ?? "").replace(/\D/g, "").endsWith(phone.slice(-10)));
    const stored = notes?.metadata.clients[phone];
    const named = chats.map((chat) => chat.metadata?.customer_name).find((value): value is string => typeof value === "string" && !!value.trim());
    const name = stored?.name ?? named ?? [...theirs].reverse().find((booking) => booking.customer_name)?.customer_name ?? null;
    if (!chats.length && !theirs.length && !orders.length && !stored) return null;

    const past = theirs.filter((booking) => booking.starts_at && Date.parse(booking.starts_at) < now);
    const services = theirs.filter((booking) => booking.status === "done").reduce((sum, booking) => sum + (booking.price ?? 0), 0);
    const paidOrders = orders.filter((order) => order.paid_at).reduce((sum, order) => sum + order.total, 0);
    const currency = theirs.find((booking) => booking.currency)?.currency ?? orders[0]?.currency ?? catalog?.metadata.currency ?? "NGN";
    return {
        phone: `+${phone}`,
        name,
        visits: theirs.filter((booking) => booking.status === "done").length + calendar.filter((booking) => booking.status === "done").length,
        no_shows: theirs.filter((booking) => booking.status === "no_show").length,
        cancelled: theirs.filter((booking) => booking.status === "cancelled").length,
        upcoming: theirs
            .filter((booking) => booking.starts_at && Date.parse(booking.starts_at) >= now && (booking.status === "confirmed" || booking.status === "held"))
            .map((booking) => ({ id: booking.id, service: booking.service ?? null, starts_at: booking.starts_at!, status: booking.status, deposit_paid: !!booking.deposit_due?.paid_at, customer_confirmed: !!booking.customer_confirmed_at, reminders: booking.reminders ?? {} })),
        recent: past.slice(-5).reverse().map((booking) => ({ service: booking.service ?? null, starts_at: booking.starts_at ?? null, status: booking.status })),
        orders: orders.slice(-5).reverse().map((order) => ({ id: order.id, summary: orderSummary(order), total: order.total, currency: order.currency, status: order.status, created_at: order.created_at })),
        // Done appointments at their price (the deposit's in it), deposits on ones still to come, and paid orders.
        spent: { amount: services + theirs.filter((booking) => booking.status !== "done" && booking.deposit_due?.paid_at).reduce((sum, booking) => sum + (booking.deposit_due?.amount ?? 0), 0) + paidOrders, currency },
        notes: stored?.notes ?? [],
        first_seen: [chats.at(-1)?.created_at, theirs[0]?.created_at].filter((value): value is string => !!value).sort()[0] ?? null,
        chats: chats.slice(0, 20).map((chat) => chat.id),
    };
}

/**
 * What the employee is told about the client it's talking to, on each turn:
 * nothing for someone new, a few lines for someone it knows.
 */
export async function clientBriefing(db: Admin, projectId: string, sessionMetadata: Record<string, unknown> | null | undefined): Promise<string> {
    const number = typeof sessionMetadata?.customer_number === "string" ? sessionMetadata.customer_number : null;
    if (!number) return "";
    const card = await clientCard(db, projectId, number).catch(() => null);
    if (!card || (!card.visits && !card.upcoming.length && !card.recent.length && !card.orders.length && !card.notes.length)) return "";
    const timeZone = await businessTimeZone(db, projectId);
    const when = (iso: string | null) => (iso ? describeStart(timeZone, new Date(iso)) : "no time");
    const lines = [
        `About this client (${card.name ?? "name not known"}, ${card.phone}): a returning client. Greet them as someone you know, without reciting this.`,
        card.visits ? `- Visits: ${card.visits}${card.no_shows ? `, missed ${card.no_shows}` : ""}${card.cancelled ? `, cancelled ${card.cancelled}` : ""}.` : card.no_shows ? `- Missed ${card.no_shows} appointment${card.no_shows === 1 ? "" : "s"}.` : null,
        card.recent.length ? `- Recent: ${card.recent.map((item) => `${item.service ?? "appointment"} (${when(item.starts_at)}, ${item.status.replace("_", " ")})`).join("; ")}.` : null,
        ...card.upcoming.map((item) => `- Upcoming: ${item.service ?? "appointment"}, ${when(item.starts_at)} [appointment_id ${item.id}], ${item.status === "held" ? "held for its deposit" : "confirmed"}${item.customer_confirmed ? ", they confirmed they're coming" : item.reminders?.day_before || item.reminders?.two_hours ? ", a reminder was sent (if they reply 1 or 2, it's about this)" : ""}.`),
        card.orders.length ? `- Orders: ${card.orders.slice(0, 3).map((order) => order.summary).join("; ")}.` : null,
        card.notes.length ? `- Notes from the business (use them, don't quote them): ${card.notes.slice(-8).map((note) => note.text).join("; ")}.` : null,
    ];
    return lines.filter(Boolean).join("\n");
}
