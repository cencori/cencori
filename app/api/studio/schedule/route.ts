/**
 * GET /api/studio/schedule?project_id=&from=YYYY-MM-DD&days=7
 *     The appointment book: its settings (services, hours, chairs, deposit,
 *     reminders), the business's time zone, and the appointments from `from`
 *     (today by default) for `days` days, plus anything held or upcoming.
 * PUT /api/studio/schedule  { project_id, settings }
 *     Save the settings (owners and admins). With reminders on, the reminder
 *     template goes to Meta for approval on the business's WhatsApp accounts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { listBookings } from '@/lib/embedded/bookings';
import { getPaymentsConnection } from '@/lib/embedded/payments';
import { getTransfers } from '@/lib/embedded/transfers';
import { businessTimeZone } from '@/lib/studio/business-zone';
import { appointmentsOf, getSchedule, publicAppointment, saveSchedule, syncReminderTemplates } from '@/lib/studio/schedule';
import { DEFAULT_SETTINGS, parseDay } from '@/lib/studio/schedule-slots';
import { localDate, localMidnight } from '@/lib/studio/time';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

async function view(projectId: string, fromText: string | null, daysText: string | null) {
    const db = createAdminClient();
    const [schedule, bookings, timeZone, payments, transfers] = await Promise.all([
        getSchedule(db, projectId),
        listBookings(db, projectId),
        businessTimeZone(db, projectId),
        getPaymentsConnection(db, projectId).catch(() => null),
        getTransfers(db, projectId).catch(() => null),
    ]);
    const today = localDate(timeZone, new Date());
    const day = parseDay(fromText) ?? today;
    const days = Math.min(62, Math.max(1, Number(daysText) || 7));
    const from = localMidnight(timeZone, day.year, day.month, day.day).getTime();
    const to = localMidnight(timeZone, day.year, day.month, day.day + days).getTime();
    const appointments = appointmentsOf(bookings)
        .filter((booking) => {
            const at = booking.starts_at ? Date.parse(booking.starts_at) : Number.NaN;
            return at >= from && at < to;
        })
        .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!));
    const templates = Object.values(schedule?.templates ?? {});
    return {
        set_up: !!schedule?.settings.services.length,
        settings: schedule?.settings ?? DEFAULT_SETTINGS,
        time_zone: timeZone,
        currency: payments?.metadata.currency ?? 'NGN',
        // A deposit needs a way to pay it: a payment provider or a bank account.
        takes_deposits: !!payments || !!transfers,
        reminder_template: templates.some((t) => t.status === 'APPROVED') ? 'approved' : templates.some((t) => t.status === 'PENDING') ? 'pending' : templates.some((t) => t.status === 'REJECTED') ? 'rejected' : templates.length ? 'error' : 'none',
        from: `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`,
        days,
        appointments: appointments.map(publicAppointment),
    };
}

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id');
    if (!isId(projectId)) return fail('Say which project.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    return NextResponse.json(await view(projectId, req.nextUrl.searchParams.get('from'), req.nextUrl.searchParams.get('days')), { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; settings?: unknown } | null;
    if (!isId(body?.project_id)) return fail('Say which project.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    if (!['owner', 'admin'].includes(access.role)) return fail('Only owners and admins can change the schedule.', 403);
    if (!body.settings || typeof body.settings !== 'object') return fail('Send the settings.');
    const db = createAdminClient();
    const saved = await saveSchedule(db, body.project_id, body.settings);
    if (!saved) return fail('Couldn\'t save the schedule. Try again.', 502);
    // The reminder template takes Meta a few minutes to approve: ask now, so it's ready for the first reminder.
    if (saved.settings.reminders) waitUntil(syncReminderTemplates(db, body.project_id).catch(() => undefined));
    return NextResponse.json(await view(body.project_id, null, null), { headers: { 'Cache-Control': 'no-store' } });
}
