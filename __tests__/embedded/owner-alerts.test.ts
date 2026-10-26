import { beforeEach, describe, expect, it, vi } from 'vitest';

const sent = vi.hoisted(() => [] as Array<{ to: string[]; subject: string; html: string }>);
vi.mock('@/lib/email/sendbyte', async (original) => ({
    ...(await original<typeof import('@/lib/email/sendbyte')>()),
    sendEmail: async (message: { to: string[]; subject: string; html: string }) => {
        sent.push(message);
        return true;
    },
}));

import { bookingFromArgs, formatWhen, isBookingTool, localDateHour, sendDueSummaries, type OwnerAlertSettings } from '@/lib/embedded/owner-alerts';

/** A minimal stand-in for the Supabase client: tool_connections rows and agent names. */
function fakeDb(rows: Array<{ id: string; project_id: string; metadata: OwnerAlertSettings }>) {
    const updates: Array<{ id: string; metadata: OwnerAlertSettings }> = [];
    const db = {
        from(table: string) {
            const chain: Record<string, unknown> = {};
            let pendingUpdate: { metadata: OwnerAlertSettings } | null = null;
            Object.assign(chain, {
                select: () => chain,
                eq: (column: string, value: string) => {
                    if (pendingUpdate && column === 'id') {
                        updates.push({ id: value, metadata: pendingUpdate.metadata });
                        const row = rows.find((r) => r.id === value);
                        if (row) row.metadata = pendingUpdate.metadata;
                        return Promise.resolve({ error: null });
                    }
                    return chain;
                },
                limit: () => Promise.resolve({ data: table === 'tool_connections' ? rows : [] }),
                maybeSingle: () => Promise.resolve({ data: table === 'agents' ? { name: 'Kapadoccia Lagos' } : null }),
                update: (value: { metadata: OwnerAlertSettings }) => {
                    pendingUpdate = value;
                    return chain;
                },
            });
            return chain;
        },
    };
    return { db: db as never, updates };
}

const settings = (overrides: Partial<OwnerAlertSettings> = {}): OwnerAlertSettings => ({
    kind: 'owner_alerts', agent_id: 'agent-1', emails: ['owner@venue.ng'], bookings: true, callbacks: true,
    daily_summary: true, time_zone: 'Africa/Lagos', last_summary_for: null, log: [], ...overrides,
});

describe('owner alerts', () => {
    beforeEach(() => {
        sent.length = 0;
    });

    it('recognises booking tools and not other writes', () => {
        expect(isBookingTool('google-calendar__create-event')).toBe(true);
        expect(isBookingTool('create-event')).toBe(true);
        expect(isBookingTool('calendly__create-booking')).toBe(true);
        expect(isBookingTool('google-calendar__create-calendar')).toBe(false);
        expect(isBookingTool('google-calendar__list-events')).toBe(false);
        expect(isBookingTool('linear__create_issue')).toBe(false);
    });

    it('reads the booking from Google Calendar arguments and shows it in the owner\'s time', () => {
        const booking = bookingFromArgs(JSON.stringify({ summary: 'Reservation: Tolu (4 guests)', description: 'Phone: 08031234567', start: { dateTime: '2026-10-30T20:00:00+01:00' } }));
        expect(booking).toEqual({ title: 'Reservation: Tolu (4 guests)', start: '2026-10-30T20:00:00+01:00', detail: 'Phone: 08031234567' });
        expect(formatWhen(booking.start, 'Africa/Lagos')).toBe('Fri 30 Oct, 8:00 pm');
        expect(formatWhen('2026-12-24', 'Africa/Lagos')).toBe('Thu 24 Dec');
        expect(bookingFromArgs('not json').title).toBe('New booking');
    });

    it('gives the local date and hour in a time zone', () => {
        expect(localDateHour(new Date('2026-10-30T23:30:00Z'), 'Africa/Lagos')).toEqual({ date: '2026-10-31', hour: 0 });
        expect(localDateHour(new Date('2026-10-30T23:30:00Z'), 'UTC')).toEqual({ date: '2026-10-30', hour: 23 });
    });

    it('sends the morning summary once, at 8am local, about the day before', async () => {
        const log = [
            { type: 'booking' as const, at: '2026-10-30T15:00:00Z', title: 'Reservation: Tolu (4 guests)', when: 'Fri 30 Oct, 8:00 pm', source: 'WhatsApp' },
            { type: 'callback' as const, at: '2026-10-30T16:00:00Z', title: 'Birthday for 20 on Saturday', contact: '08031234567', detail: 'Ada' },
            { type: 'booking' as const, at: '2026-10-31T06:00:00Z', title: 'Today, not yesterday' },
        ];
        const { db } = fakeDb([{ id: 'c1', project_id: 'p1', metadata: settings({ log }) }]);

        // 6:00 in Lagos: too early.
        expect(await sendDueSummaries(db, new Date('2026-10-31T05:00:00Z'))).toEqual({ sent: 0, skipped: 0 });
        // 8:00 in Lagos: sent, about the 30th only.
        expect(await sendDueSummaries(db, new Date('2026-10-31T07:05:00Z'))).toEqual({ sent: 1, skipped: 0 });
        expect(sent[0].subject).toBe('Kapadoccia Lagos yesterday: 1 booking, 1 to call back');
        expect(sent[0].html).toContain('Reservation: Tolu (4 guests)');
        expect(sent[0].html).toContain('Birthday for 20 on Saturday');
        expect(sent[0].html).not.toContain('Today, not yesterday');
        // Later the same day: not again.
        expect(await sendDueSummaries(db, new Date('2026-10-31T09:05:00Z'))).toEqual({ sent: 0, skipped: 0 });
        expect(sent).toHaveLength(1);
    });

    it('skips quiet days and agents with the summary off', async () => {
        const { db } = fakeDb([
            { id: 'quiet', project_id: 'p1', metadata: settings() },
            { id: 'off', project_id: 'p1', metadata: settings({ daily_summary: false, log: [{ type: 'booking', at: '2026-10-30T15:00:00Z', title: 'x' }] }) },
        ]);
        expect(await sendDueSummaries(db, new Date('2026-10-31T07:05:00Z'))).toEqual({ sent: 0, skipped: 1 });
        expect(sent).toHaveLength(0);
    });
});
