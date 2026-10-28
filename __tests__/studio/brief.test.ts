import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/studio/push', () => ({ pushToOwners: vi.fn() }));

import { briefScript, plainBrief, quietDay, type BriefFacts } from '@/lib/studio/brief';

const facts = (overrides: Partial<BriefFacts> = {}): BriefFacts => ({
    business: 'Suya Spot', currency: 'NGN', chats: 0, earned: 0, payments: 0, earnedWeekBefore: 0, orders: 0, topItems: [],
    bookingsMade: 0, bookingsToday: 0, waitingForOwner: 0, products: [], messages: [], ...overrides,
});

describe('morning brief', () => {
    it('sends nothing after a quiet day with nothing waiting', () => {
        expect(quietDay(facts())).toBe(true);
        expect(quietDay(facts({ chats: 1 }))).toBe(false);
        expect(quietDay(facts({ bookingsToday: 2 }))).toBe(false);
        expect(quietDay(facts({ waitingForOwner: 1 }))).toBe(false);
    });

    it('leads with money, else chats, when written without the model', () => {
        expect(plainBrief(facts({ chats: 14, earned: 486_500, payments: 9, topItems: [{ name: 'Beef suya', quantity: 21 }], bookingsToday: 1 }))).toEqual({
            headline: '₦487k yesterday',
            points: ['14 chats, 9 payments.', 'Top seller: Beef suya (21).', '1 booking today.'],
        });
        expect(plainBrief(facts({ chats: 1, waitingForOwner: 2 }))).toEqual({ headline: '1 chat yesterday', points: ['2 customers are waiting for you.'] });
        expect(plainBrief(facts({ earned: 2_400_000, payments: 3 })).headline).toBe('₦2.4m yesterday');
    });

    it('reads money in words when spoken', () => {
        expect(briefScript({ headline: '₦187k yesterday', points: ['₦2.4m this week', 'A deposit of ₦12,500 came in.'] }))
            .toBe('Good morning. 187 thousand naira yesterday. 2.4 million naira this week. A deposit of 12,500 naira came in.');
    });
});
