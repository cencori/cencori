/**
 * POST  /api/studio/schedule/appointments  { project_id, service, start, name, phone?, note? }
 *       The owner books someone in (a walk-in, a call): `start` is the
 *       business's local time, "2026-11-03T14:00". No deposit is asked for.
 * PATCH /api/studio/schedule/appointments  { project_id, id, action: 'move' | 'cancelled' | 'done' | 'no_show', start?, tell_customer? }
 *       Move one (to `start`), cancel it, or mark it done or a no-show. A move
 *       or a cancellation is passed on to the customer in their chat, unless
 *       tell_customer is false.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { listBookings } from '@/lib/embedded/bookings';
import { businessTimeZone } from '@/lib/studio/business-zone';
import { bookAppointment, messageCustomer, moveAppointment, phoneDigits, publicAppointment, setAppointment } from '@/lib/studio/schedule';
import { describeStart, parseStart } from '@/lib/studio/schedule-slots';
import { studioStaff } from '@/lib/studio/owner-chat';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const text = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim().slice(0, max) : null);

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!isId(body?.project_id)) return fail('Say which project.');
    const projectId = body.project_id;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const timeZone = await businessTimeZone(db, projectId);
    const start = parseStart(body.start, timeZone);
    if (!start) return fail('Pick a day and time.');
    const name = text(body.name, 100);
    if (!name) return fail('Who is it for?');
    // The book belongs to the business; the main employee is who it's "with".
    const [employee] = await studioStaff(db as never, projectId);
    if (!employee) return fail('Set up your employee first.', 409);
    const result = await bookAppointment(
        { db, projectId, agentId: employee.id, agentName: employee.name, surface: 'owner', conversationId: isId(body.conversation_id) ? body.conversation_id : null },
        { service: body.service, start, name, phone: phoneDigits(body.phone), note: text(body.note, 500) },
    );
    if (!result.ok) return fail(result.message, 409);
    return NextResponse.json({ appointment: publicAppointment(result.booking) });
}

export async function PATCH(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!isId(body?.project_id)) return fail('Say which project.');
    const projectId = body.project_id;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    if (!isId(body.id)) return fail('Say which appointment.');
    const db = createAdminClient();
    const timeZone = await businessTimeZone(db, projectId);
    const before = (await listBookings(db, projectId)).find((booking) => booking.id === body.id);
    if (!before) return fail('That appointment isn\'t there any more.', 404);
    const tell = body.tell_customer !== false;
    let told: 'sent' | 'template' | 'unreachable' | null = null;

    if (body.action === 'move') {
        const start = parseStart(body.start, timeZone);
        if (!start) return fail('Pick the new day and time.');
        const moved = await moveAppointment(db, projectId, body.id, start, { byOwner: true });
        if (!moved.ok) return fail(moved.message, 409);
        if (tell) told = await messageCustomer(db, projectId, moved.booking, `Your ${moved.booking.service ?? 'appointment'} has moved to ${describeStart(timeZone, start)}. Reply if that doesn't work for you.`);
        return NextResponse.json({ appointment: publicAppointment(moved.booking), told });
    }
    if (body.action === 'cancelled' || body.action === 'done' || body.action === 'no_show') {
        const changed = await setAppointment(db, projectId, body.id, body.action);
        if (!changed.ok) return fail(changed.message, 409);
        if (tell && body.action === 'cancelled' && before.starts_at && Date.parse(before.starts_at) > Date.now()) {
            told = await messageCustomer(db, projectId, changed.booking, `Sorry, your ${changed.booking.service ?? 'appointment'} on ${describeStart(timeZone, new Date(before.starts_at))} has been cancelled. Message us to book another time.`);
        }
        return NextResponse.json({ appointment: publicAppointment(changed.booking), told });
    }
    return fail('Unknown change.');
}
