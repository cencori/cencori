import { describe, expect, it } from 'vitest';
import { summarizeMoney, type MoneyOrder, type MoneyPayment } from '@/lib/studio/money';
import { localDate, localMidnight, periodStarts } from '@/lib/studio/time';

// Tue 27 Oct 2026, 22:30 UTC = Tue 23:30 in Lagos.
const NOW = new Date('2026-10-27T22:30:00Z');
const paid = (amount: number, at: string): MoneyPayment => ({ amount, currency: 'NGN', status: 'paid', paid_at: at });

describe('Studio time', () => {
    it("uses the business's own day", () => {
        // 23:30 UTC is already Wednesday in Lagos.
        expect(localDate('Africa/Lagos', new Date('2026-10-27T23:30:00Z'))).toMatchObject({ day: 28, weekday: 3 });
        expect(localMidnight('Africa/Lagos', 2026, 10, 28).toISOString()).toBe('2026-10-27T23:00:00.000Z');
        expect(periodStarts('Africa/Lagos', NOW).month.toISOString()).toBe('2026-09-30T23:00:00.000Z');
    });
});

describe('Money', () => {
    const payments = [
        paid(20000, '2026-10-27T19:00:00Z'), // today
        paid(50000, '2026-10-25T12:00:00Z'), // Sunday
        paid(9000, '2026-10-12T12:00:00Z'), // earlier this month
        { ...paid(99999, '2026-10-27T10:00:00Z'), status: 'pending' }, // not paid
        { ...paid(5000, '2026-10-27T10:00:00Z'), currency: 'USD' }, // another currency
    ];
    const orders: MoneyOrder[] = [
        // Paid by link: counted through its payment, not again here.
        { total: 50000, currency: 'NGN', status: 'paid', paid_at: '2026-10-25T12:00:00Z', paid_by: 'link', items: [{ name: 'Signature Platter', quantity: 1, price: 50000 }] },
        // Paid in cash.
        { total: 13000, currency: 'NGN', status: 'paid', paid_at: '2026-10-26T18:00:00Z', paid_by: 'owner', items: [{ name: 'Jollof Rice', quantity: 2, price: 6500 }] },
        { total: 19500, currency: 'NGN', status: 'new', paid_at: null, items: [{ name: 'Jollof Rice', quantity: 3, price: 6500 }] },
        { total: 8000, currency: 'NGN', status: 'cancelled', paid_at: '2026-10-26T18:00:00Z', paid_by: 'owner', items: [] },
    ];

    it('counts each amount once, by link or marked paid, in the last seven days', () => {
        const week = summarizeMoney({ payments, orders, period: 'week', timeZone: 'Africa/Lagos', currency: 'NGN', now: NOW });
        expect(week).toMatchObject({ total: 83000, by_link: 70000, marked_paid: 13000, to_collect: 19500, paid_count: 3 });
        expect(week.bars.map((b) => b.label)).toEqual(['W', 'T', 'F', 'S', 'S', 'M', 'T']);
        expect(week.bars.at(-1)).toMatchObject({ amount: 20000, current: true });
        expect(week.top_items[0]).toEqual({ name: 'Signature Platter', quantity: 1, amount: 50000 });
    });

    it('splits the month into weeks and the year into months', () => {
        const month = summarizeMoney({ payments, orders, period: 'month', timeZone: 'Africa/Lagos', currency: 'NGN', now: NOW });
        expect(month.total).toBe(92000);
        expect(month.bars.map((b) => b.amount)).toEqual([0, 9000, 0, 83000, 0]);
        const year = summarizeMoney({ payments, orders, period: 'year', timeZone: 'Africa/Lagos', currency: 'NGN', now: NOW });
        expect(year.bars).toHaveLength(12);
        expect(year.bars[9]).toMatchObject({ label: 'O', amount: 92000, current: true });
    });
});

describe('Money with transfers', () => {
    it('counts confirmed transfers once, in their own line', () => {
        const summary = summarizeMoney({
            payments: [],
            transfers: [
                paid(15000, '2026-10-27T12:00:00Z'), // confirmed today
                { ...paid(8000, '2026-10-27T12:00:00Z'), status: 'claimed', paid_at: null }, // said they paid, not confirmed
            ],
            // The order the confirmed transfer paid for: counted through the transfer, not again.
            orders: [{ total: 15000, currency: 'NGN', status: 'paid', paid_at: '2026-10-27T12:00:00Z', paid_by: 'transfer', items: [{ name: 'Suya', quantity: 3, price: 5000 }] }],
            period: 'week', timeZone: 'Africa/Lagos', currency: 'NGN', now: NOW,
        });
        expect(summary.total).toBe(15000);
        expect(summary.by_transfer).toBe(15000);
        expect(summary.marked_paid).toBe(0);
        expect(summary.top_items[0]).toMatchObject({ name: 'Suya', quantity: 3 });
    });
});
