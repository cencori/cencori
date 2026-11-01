/**
 * Bookings: tables, appointments, viewings. Two kinds share one list:
 * - Made in the owner's calendar (Google Calendar through the agent's apps):
 *   this keeps Cencori's own record of it so Studio's Sales tab can list it.
 * - Made in Studio's own appointment book (lib/studio/schedule.ts): this list
 *   is the book itself, with the service, start and end, the customer, the
 *   deposit and the reminders sent.
 *
 * One `tool_connections` row per project (`connector_slug = 'bookings'`),
 * with a rolling list in metadata, like the catalog's orders. Every write is a
 * compare-and-swap on `metadata.rev`, so two customers booking the last chair
 * at the same moment can't both get it.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';
import { bookingFromArgs } from '@/lib/embedded/owner-alerts';

type Admin = ReturnType<typeof createAdminClient>;

export const BOOKINGS_SLUG = 'bookings';
const BOOKINGS_KEPT = 1_000;
const WRITE_ATTEMPTS = 5;

/** held: waiting for its deposit; no_show: booked and never came. */
export type BookingStatus = 'held' | 'confirmed' | 'done' | 'cancelled' | 'no_show';

export interface BookingDeposit {
    amount: number;
    currency: string;
    /** The payment link's reference (cen_…) or the transfer's (TRF-…). */
    reference: string;
    method: 'link' | 'transfer';
    link: string | null;
    /** The customer said they sent the transfer; the slot waits for the owner to confirm it. */
    claimed_at: string | null;
    paid_at: string | null;
}

export interface Booking {
    id: string;
    agent_id: string;
    conversation_id: string | null;
    /** What it's called, e.g. "Table for 4: Kemi" or "Knotless braids: Tolu". */
    title: string;
    /** When it starts: an ISO date-time or date, or the raw text the agent gave. */
    start: string | null;
    detail: string | null;
    status: BookingStatus;
    created_at: string;
    // Studio's appointment book (absent on calendar bookings):
    source?: 'calendar' | 'schedule' | 'owner';
    service_id?: string | null;
    service?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    customer_name?: string | null;
    /** Digits with the country code, as WhatsApp gives it ("2348012345678"). */
    customer_phone?: string | null;
    price?: number | null;
    currency?: string | null;
    deposit_due?: BookingDeposit | null;
    /** A held booking is let go after this, unless its deposit is paid (or a transfer is claimed). */
    held_until?: string | null;
    /** When each reminder went out, or why it couldn't. */
    reminders?: { day_before?: string; two_hours?: string; skipped?: string };
    /** The customer replied to a reminder to say they're coming. */
    customer_confirmed_at?: string | null;
    updated_at?: string;
}

interface BookingsMetadata {
    kind: 'bookings';
    rev?: number;
    bookings: Booking[];
}

const COLUMNS = 'id, project_id, metadata';

async function getRow(db: Admin, projectId: string): Promise<{ id: string; metadata: BookingsMetadata } | null> {
    const { data } = await db.from('tool_connections').select(COLUMNS).eq('project_id', projectId).eq('connector_slug', BOOKINGS_SLUG).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const metadata = (data?.metadata ?? null) as BookingsMetadata | null;
    if (!data || metadata?.kind !== 'bookings') return null;
    return { id: data.id as string, metadata: { kind: 'bookings', rev: typeof metadata.rev === 'number' ? metadata.rev : undefined, bookings: Array.isArray(metadata.bookings) ? metadata.bookings : [] } };
}

export async function listBookings(db: Admin, projectId: string): Promise<Booking[]> {
    return (await getRow(db, projectId))?.metadata.bookings ?? [];
}

export type BookingsChange<T> = { bookings: Booking[]; result: T } | { error: string };

/**
 * Change the list: `change` sees the current bookings and returns the new
 * list (and what to hand back), or an error to change nothing. If someone else
 * wrote in between, it runs again on their version, so a slot check inside
 * `change` always holds when the write lands.
 */
export async function changeBookings<T>(db: Admin, projectId: string, change: (bookings: Booking[]) => BookingsChange<T>): Promise<{ ok: true; result: T } | { ok: false; message: string }> {
    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
        const row = await getRow(db, projectId);
        const outcome = change(row?.metadata.bookings ?? []);
        if ('error' in outcome) return { ok: false, message: outcome.error };
        const rev = (row?.metadata.rev ?? 0) + 1;
        const metadata: BookingsMetadata = { kind: 'bookings', rev, bookings: outcome.bookings.slice(-BOOKINGS_KEPT) };
        if (!row) {
            const { error } = await db.from('tool_connections').insert({ project_id: projectId, connector_slug: BOOKINGS_SLUG, owner_type: 'platform', status: 'active', metadata });
            if (!error) return { ok: true, result: outcome.result };
            continue;
        }
        // Only lands if nobody wrote since we read: the rev we read is still there.
        const query = db.from('tool_connections').update({ metadata }).eq('id', row.id);
        const { data, error } = await (row.metadata.rev === undefined ? query.is('metadata->rev', null) : query.eq('metadata->>rev', String(row.metadata.rev))).select('id');
        if (!error && Array.isArray(data) && data.length > 0) return { ok: true, result: outcome.result };
    }
    return { ok: false, message: 'The appointment book is busy. Try again in a moment.' };
}

/** Change one booking by id. */
export async function updateBooking(db: Admin, projectId: string, bookingId: string, change: (booking: Booking) => Booking | { error: string }): Promise<{ ok: true; result: Booking } | { ok: false; message: string }> {
    return changeBookings(db, projectId, (bookings) => {
        const current = bookings.find((booking) => booking.id === bookingId);
        if (!current) return { error: 'That booking isn\'t there any more.' };
        const next = change(current);
        if ('error' in next) return next;
        const updated = { ...next, updated_at: new Date().toISOString() };
        return { bookings: bookings.map((booking) => (booking.id === bookingId ? updated : booking)), result: updated };
    });
}

/** Record a booking the agent just made with its calendar tool (from the tool's own arguments). */
export async function recordBooking(db: Admin, opts: { projectId: string; agentId: string; conversationId: string | null; argsJson: string }): Promise<void> {
    const parsed = bookingFromArgs(opts.argsJson);
    const booking: Booking = {
        id: crypto.randomUUID(),
        agent_id: opts.agentId,
        conversation_id: opts.conversationId,
        title: parsed.title,
        start: parsed.start,
        detail: parsed.detail,
        status: 'confirmed',
        created_at: new Date().toISOString(),
        source: 'calendar',
    };
    await changeBookings(db, opts.projectId, (bookings) => ({ bookings: [...bookings, booking], result: booking }));
}

/** The owner marks a booking done (they came), a no-show, or cancelled. */
export async function setBookingStatus(db: Admin, projectId: string, bookingId: string, status: 'done' | 'cancelled' | 'no_show'): Promise<boolean> {
    const result = await updateBooking(db, projectId, bookingId, (booking) => ({ ...booking, status }));
    return result.ok;
}
