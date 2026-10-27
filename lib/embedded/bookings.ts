/**
 * Bookings the assistant made: tables, appointments, viewings. The booking
 * itself lives in the owner's calendar (Google Calendar through the agent's
 * apps); this keeps Cencori's own record of it so Studio's Sales tab can
 * list them, and the owner can mark one done or cancelled.
 *
 * One `tool_connections` row per project (`connector_slug = 'bookings'`),
 * with a rolling list in metadata, like the catalog's orders.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';
import { bookingFromArgs } from '@/lib/embedded/owner-alerts';

type Admin = ReturnType<typeof createAdminClient>;

export const BOOKINGS_SLUG = 'bookings';
const BOOKINGS_KEPT = 500;

export type BookingStatus = 'confirmed' | 'done' | 'cancelled';

export interface Booking {
    id: string;
    agent_id: string;
    conversation_id: string | null;
    /** What the calendar event is called, e.g. "Table for 4: Kemi". */
    title: string;
    /** When it starts: an ISO date-time or date, or the raw text the agent gave. */
    start: string | null;
    detail: string | null;
    status: BookingStatus;
    created_at: string;
}

interface BookingsMetadata {
    kind: 'bookings';
    bookings: Booking[];
}

const COLUMNS = 'id, project_id, metadata';

async function getRow(db: Admin, projectId: string): Promise<{ id: string; metadata: BookingsMetadata } | null> {
    const { data } = await db.from('tool_connections').select(COLUMNS).eq('project_id', projectId).eq('connector_slug', BOOKINGS_SLUG).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const metadata = (data?.metadata ?? null) as BookingsMetadata | null;
    if (!data || metadata?.kind !== 'bookings') return null;
    return { id: data.id as string, metadata: { kind: 'bookings', bookings: Array.isArray(metadata.bookings) ? metadata.bookings : [] } };
}

export async function listBookings(db: Admin, projectId: string): Promise<Booking[]> {
    return (await getRow(db, projectId))?.metadata.bookings ?? [];
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
    };
    const row = await getRow(db, opts.projectId);
    if (!row) {
        await db.from('tool_connections').insert({ project_id: opts.projectId, connector_slug: BOOKINGS_SLUG, owner_type: 'platform', status: 'active', metadata: { kind: 'bookings', bookings: [booking] } });
        return;
    }
    // Re-read just before writing, so two bookings at once both land.
    const fresh = await getRow(db, opts.projectId);
    const list = [...(fresh?.metadata.bookings ?? row.metadata.bookings), booking].slice(-BOOKINGS_KEPT);
    await db.from('tool_connections').update({ metadata: { kind: 'bookings', bookings: list } }).eq('id', row.id);
}

/** The owner marks a booking done (they came) or cancelled. */
export async function setBookingStatus(db: Admin, projectId: string, bookingId: string, status: 'done' | 'cancelled'): Promise<boolean> {
    const row = await getRow(db, projectId);
    if (!row || !row.metadata.bookings.some((b) => b.id === bookingId)) return false;
    const { error } = await db.from('tool_connections').update({
        metadata: { kind: 'bookings', bookings: row.metadata.bookings.map((b) => (b.id === bookingId ? { ...b, status } : b)) },
    }).eq('id', row.id);
    return !error;
}
