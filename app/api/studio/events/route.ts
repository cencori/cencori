/**
 * /api/studio/events?project_id=[&event_id=]
 *
 * The business's events, for Studio.
 *   GET    every event with tickets sold, money in and check-ins; with
 *          event_id, that event and its guest list
 *   POST   { project_id, action: 'create', name, starts_at, ends_at?, venue?, description?, tiers }
 *          { project_id, action: 'update', event_id, ...fields or status }
 *          (ticket holders are emailed when the date, time or place changes, or it's cancelled)
 *          { project_id, action: 'checkin', event_id, code }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { checkIn, createEvent, eventSummaries, guestList, updateEvent } from '@/lib/studio/events';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id');
    if (!isId(projectId)) return fail('Say which project.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const events = await eventSummaries(db, projectId);
    const eventId = req.nextUrl.searchParams.get('event_id');
    if (isId(eventId)) {
        const summary = events.find((item) => item.event.id === eventId);
        if (!summary) return fail('Event not found.', 404);
        return NextResponse.json({ event: summary, guests: await guestList(db, projectId, eventId) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ events }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!isId(body?.project_id)) return fail('Say which project.');
    const projectId = body.project_id;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();

    if (body.action === 'create') {
        const created = await createEvent(db, projectId, access.userId, body);
        if (!created.ok) return fail(created.message);
        return NextResponse.json({ event: created.event }, { status: 201 });
    }
    if (!isId(body.event_id)) return fail('Say which event.');
    if (body.action === 'update') {
        const updated = await updateEvent(db, projectId, body.event_id, body);
        if (!updated.ok) return fail(updated.message);
        return NextResponse.json({ event: updated.event, told: updated.told });
    }
    if (body.action === 'checkin') {
        const result = await checkIn(db, projectId, body.event_id, typeof body.code === 'string' ? body.code : '');
        return NextResponse.json(result);
    }
    return fail('Unknown action.');
}
