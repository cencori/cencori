/**
 * The appointment tools a business's employee uses with customers, on when
 * the business has its appointment book set up in Studio (services, hours):
 * check what's free, book (held for a deposit when there is one), move,
 * cancel or confirm one of the customer's own appointments, and keep a note
 * about the client for next time. See lib/studio/schedule.ts.
 */

import type { AgentToolContext, AgentToolOutcome, FunctionToolDefinition } from './agent-tools';

export const CHECK_AVAILABILITY_TOOL = 'check_availability';
export const BOOK_APPOINTMENT_TOOL = 'book_appointment';
export const CHANGE_APPOINTMENT_TOOL = 'change_appointment';
export const NOTE_CLIENT_TOOL = 'note_about_client';
export const APPOINTMENT_TOOL_NAMES = [CHECK_AVAILABILITY_TOOL, BOOK_APPOINTMENT_TOOL, CHANGE_APPOINTMENT_TOOL, NOTE_CLIENT_TOOL] as const;

export const APPOINTMENT_DEFINITIONS: FunctionToolDefinition[] = [
    {
        type: 'function',
        function: {
            name: CHECK_AVAILABILITY_TOOL,
            description: 'See the free start times for a service: on one day, or the next few open days when no day is given. Only offer times this returns.',
            parameters: {
                type: 'object',
                properties: {
                    service: { type: 'string', description: 'The service, as the business names it.' },
                    date: { type: 'string', description: 'A day, as YYYY-MM-DD in the business\'s time zone. Omit for the next few open days.' },
                },
                required: ['service'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: BOOK_APPOINTMENT_TOOL,
            description: 'Book the customer in, once they\'ve agreed the service, day and time and you\'ve read it back. With a deposit, the slot is held while they pay and this returns the payment link or account details to send.',
            parameters: {
                type: 'object',
                properties: {
                    service: { type: 'string', description: 'The service, as the business names it.' },
                    start: { type: 'string', description: 'The start, in the business\'s local time: YYYY-MM-DDTHH:MM, e.g. 2026-11-03T14:00.' },
                    name: { type: 'string', description: 'The customer\'s name.' },
                    phone: { type: 'string', description: 'Their phone number, when they aren\'t on WhatsApp (website or link chats).' },
                    note: { type: 'string', description: 'Anything the business should know, e.g. "medium length, colour 1B". Optional.' },
                },
                required: ['service', 'start', 'name'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: CHANGE_APPOINTMENT_TOOL,
            description: 'Change one of this customer\'s own appointments (the appointment_id is in what you know about them): confirm (they say they\'re coming, e.g. they replied 1 to a reminder), move (to a free start from check_availability), or cancel (they can\'t come).',
            parameters: {
                type: 'object',
                properties: {
                    appointment_id: { type: 'string' },
                    action: { type: 'string', enum: ['confirm', 'move', 'cancel'] },
                    start: { type: 'string', description: 'For move: the new start, YYYY-MM-DDTHH:MM in the business\'s local time.' },
                },
                required: ['appointment_id', 'action'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: NOTE_CLIENT_TOOL,
            description: 'Keep a short note about this client for next time, when they tell you a lasting preference: their usual style or length, a stylist they prefer, an allergy. Never for payment details or anything they wouldn\'t want kept.',
            parameters: { type: 'object', properties: { note: { type: 'string', description: 'The note, e.g. "Prefers medium knotless, colour 1B".' } }, required: ['note'] },
        },
    },
];

function parse(argumentsJson: string): Record<string, unknown> | null {
    try {
        const value = JSON.parse(argumentsJson || '{}');
        return value && typeof value === 'object' ? value as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

const text = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim().slice(0, max) : null);

export async function runAppointmentTool(name: string, argumentsJson: string, context: AgentToolContext): Promise<AgentToolOutcome> {
    const args = parse(argumentsJson);
    if (!args) return { ok: false, output: 'The details weren\'t valid JSON.' };
    const [{ createAdminClient }, schedule, slots, { businessTimeZone }, { customerOf }] = await Promise.all([
        import('@/lib/supabaseAdmin'),
        import('@/lib/studio/schedule'),
        import('@/lib/studio/schedule-slots'),
        import('@/lib/studio/business-zone'),
        import('./payments'),
    ]);
    const db = createAdminClient();
    const timeZone = await businessTimeZone(db, context.projectId);

    if (name === CHECK_AVAILABILITY_TOOL) {
        const book = await schedule.getSchedule(db, context.projectId);
        if (!book?.settings.services.length) return { ok: false, output: 'The business hasn\'t set up booking. Offer to have the team call them back.' };
        const service = slots.findService(book.settings.services, args.service);
        if (!service) return { ok: false, output: `No service called "${String(args.service ?? '')}". The services: ${book.settings.services.map((item) => item.name).join(', ')}.` };
        const { listBookings } = await import('./bookings');
        const appointments = schedule.appointmentsOf(await listBookings(db, context.projectId));
        const now = new Date();
        const asked = args.date ? slots.parseDay(args.date) : null;
        if (args.date && !asked) return { ok: false, output: 'Give the day as YYYY-MM-DD.' };
        const days = asked ? [asked] : slots.nextDays(timeZone, now, Math.min(book.settings.days_ahead, 21));
        const found: string[] = [];
        for (const day of days) {
            const free = slots.freeSlots({ settings: book.settings, service, day, timeZone, appointments, now });
            if (!free.length) continue;
            const label = new Date(Date.UTC(day.year, day.month - 1, day.day)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
            found.push(`${label} (${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}): ${slots.describeSlots(timeZone, free)}`);
            if (!asked && found.length >= 3) break;
        }
        const about = `${service.name} takes ${slots.describeMinutes(service.minutes)}.`;
        if (!found.length) return { ok: true, output: asked ? `${about} Nothing free that day. Offer to check another day.` : `${about} Nothing free in the next few weeks. Offer to have the team call them back.` };
        return { ok: true, output: `${about} Free start times:\n${found.join('\n')}` };
    }

    if (name === BOOK_APPOINTMENT_TOOL) {
        const start = slots.parseStart(args.start, timeZone);
        if (!start) return { ok: false, output: 'Give the start as YYYY-MM-DDTHH:MM in the business\'s local time.' };
        const customer = await customerOf(db, context.conversationId);
        const phone = schedule.phoneDigits(customer.number) ?? schedule.phoneDigits(args.phone);
        const result = await schedule.bookAppointment(
            { db, projectId: context.projectId, agentId: context.agentId, agentName: context.agentName, surface: context.surface, conversationId: context.conversationId },
            { service: args.service, start, name: text(args.name, 100), phone, note: text(args.note, 500) },
        );
        if (!result.ok) return { ok: false, output: `${result.message} Check availability and offer another time.` };
        const when = slots.describeStart(timeZone, start);
        const what = `${result.booking.service}, ${when}`;
        if (!result.payment) return { ok: true, output: `Booked: ${what}, for ${result.booking.customer_name ?? 'them'}. Tell them they're booked; they'll get a reminder before.` };
        const hold = `The slot is held for ${slots.describeMinutes(result.heldMinutes ?? 30)} while they pay the ${result.payment.amount} deposit; it's booked once paid.`;
        if (result.payment.kind === 'link') return { ok: true, output: `Held: ${what}. ${hold} Payment link: ${result.payment.link}\nSend the link as it is. They'll get a confirmation here automatically once paid.` };
        return { ok: true, output: `Held: ${what}. ${hold} The business takes it by bank transfer. Give them exactly: ${result.payment.instructions}\nAsk them to put the reference in the narration and tell you once they've sent it; then call check_payment. Don't say it's booked until the business confirms the transfer.` };
    }

    if (name === CHANGE_APPOINTMENT_TOOL) {
        const id = text(args.appointment_id, 64);
        if (!id) return { ok: false, output: 'Which appointment? Use the appointment_id from what you know about them.' };
        const { listBookings } = await import('./bookings');
        const booking = (await listBookings(db, context.projectId)).find((item) => item.id === id);
        const customer = await customerOf(db, context.conversationId);
        const phone = schedule.phoneDigits(customer.number);
        // Only their own: booked in this chat, or under their number.
        if (!booking || !(booking.conversation_id === context.conversationId || (phone && booking.customer_phone === phone))) return { ok: false, output: 'That appointment isn\'t one of theirs.' };
        if (context.surface === 'preview') return { ok: true, output: 'Done (in a preview nothing changes).' };
        const when = (iso: string | null | undefined) => (iso ? slots.describeStart(timeZone, new Date(iso)) : '');
        if (args.action === 'confirm') {
            const done = await schedule.setAppointment(db, context.projectId, id, 'customer_confirmed');
            return done.ok ? { ok: true, output: `Noted they're coming: ${booking.service}, ${when(booking.starts_at)}. Thank them.` } : { ok: false, output: done.message };
        }
        if (args.action === 'move') {
            const start = slots.parseStart(args.start, timeZone);
            if (!start) return { ok: false, output: 'Give the new start as YYYY-MM-DDTHH:MM, from check_availability.' };
            const moved = await schedule.moveAppointment(db, context.projectId, id, start);
            if (!moved.ok) return { ok: false, output: `${moved.message} Check availability and offer another time.` };
            await tellOwner(db, context.projectId, 'Appointment moved', `${booking.title}: now ${when(moved.booking.starts_at)} (was ${when(booking.starts_at)}).`);
            return { ok: true, output: `Moved: ${moved.booking.service}, now ${when(moved.booking.starts_at)}. Tell them; any deposit they paid still counts.` };
        }
        if (args.action === 'cancel') {
            const cancelled = await schedule.setAppointment(db, context.projectId, id, 'cancelled');
            if (!cancelled.ok) return { ok: false, output: cancelled.message };
            await tellOwner(db, context.projectId, 'Appointment cancelled', `${booking.title}, ${when(booking.starts_at)}: cancelled by the client.${booking.deposit_due?.paid_at ? ' They paid a deposit.' : ''}`);
            return { ok: true, output: `Cancelled: ${booking.service}, ${when(booking.starts_at)}.${booking.deposit_due?.paid_at ? ' They paid a deposit: don\'t promise a refund; say the business will be in touch about it.' : ''}` };
        }
        return { ok: false, output: 'Say confirm, move or cancel.' };
    }

    if (name === NOTE_CLIENT_TOOL) {
        const note = text(args.note, 300);
        const customer = await customerOf(db, context.conversationId);
        if (!note) return { ok: false, output: 'Say what to note.' };
        if (!customer.number) return { ok: true, output: 'Not kept: notes are for clients on WhatsApp, by their number.' };
        if (context.surface === 'preview') return { ok: true, output: 'Noted (in a preview nothing is kept).' };
        const { addClientNote } = await import('@/lib/studio/clients');
        const saved = await addClientNote(db, context.projectId, customer.number, note, 'employee');
        return saved.ok ? { ok: true, output: 'Noted for next time. No need to mention it.' } : { ok: false, output: saved.message };
    }

    return { ok: false, output: `There's no tool named ${name}.` };
}

async function tellOwner(db: Parameters<typeof import('@/lib/studio/push').pushToOwners>[0], projectId: string, title: string, body: string): Promise<void> {
    await import('@/lib/studio/push').then(({ pushToOwners }) => pushToOwners(db, projectId, { title, body: body.slice(0, 200), url: '/schedule', tag: `schedule-${title}` })).catch(() => undefined);
}
