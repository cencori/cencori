import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/studio/push', () => ({ pushToOwners: vi.fn() }));
vi.mock('@/lib/email/sendbyte', () => ({ sendEmail: vi.fn(), escapeHtml: (s: string) => s }));

import { checkTierChanges, cleanEvent, eventsBriefing, slugify, ticketCode } from '@/lib/studio/events';
import { isStudioPassThrough, studioInternalPath } from '@/lib/studio/routing';

describe('events', () => {
    it('checks an event before it is made', () => {
        const made = cleanEvent({ name: ' Rooftop Party ', starts_at: '2026-12-20T19:00:00Z', tiers: [{ name: 'Regular', price: 10000, capacity: 250 }, { name: 'VIP table', price: '50000', capacity: '' }] });
        expect(made).toMatchObject({ ok: true, event: { name: 'Rooftop Party', currency: 'NGN', tiers: [{ name: 'Regular', price: 10000, capacity: 250 }, { name: 'VIP table', price: 50000, capacity: null }] } });
        expect(cleanEvent({ name: 'X', starts_at: 'soon', tiers: [{ name: 'A', price: 1 }] })).toMatchObject({ ok: false, message: 'When does it start?' });
        expect(cleanEvent({ name: 'X', starts_at: '2026-12-20T19:00:00Z', tiers: [] })).toMatchObject({ ok: false });
        expect(cleanEvent({ name: 'X', starts_at: '2026-12-20T19:00:00Z', ends_at: '2026-12-20T18:00:00Z', tiers: [{ name: 'A', price: 0 }] })).toMatchObject({ ok: false, message: 'It has to end after it starts.' });
    });

    it('makes readable addresses and codes the door can type', () => {
        expect(slugify("Tolu's Rooftop Party — Detty December!")).toBe('tolu-s-rooftop-party-detty-december');
        for (let i = 0; i < 50; i++) expect(ticketCode()).toMatch(/^[A-HJ-NP-Z2-9]{7}$/);
    });

    it('serves event pages on the Studio address without sign-in', () => {
        expect(isStudioPassThrough('/e/rooftop-party')).toBe(true);
        expect(isStudioPassThrough('/e/rooftop-party/order/EVT-1A2B3C4D')).toBe(true);
        expect(studioInternalPath('/e/rooftop-party')).toBeNull();
        expect(isStudioPassThrough('/events')).toBe(false);
    });

    it('briefs the assistant on events on sale, with what is left and the link', async () => {
        const event = { id: 'e1', project_id: 'p1', slug: 'rooftop-party', name: 'Rooftop Party', description: 'Afrobeats all night', venue: 'Lekki', starts_at: '2026-12-20T19:00:00Z', ends_at: null, currency: 'NGN', status: 'live', created_at: '', tiers: [{ id: 't_reg1', name: 'Regular', price: 10000, capacity: 100 }, { id: 't_vip1', name: 'VIP', price: 50000, capacity: 2 }] };
        const tickets = [
            ...Array.from({ length: 80 }, () => ({ tier_id: 't_reg1', status: 'paid', reserved_until: null })),
            { tier_id: 't_vip1', status: 'paid', reserved_until: null },
            { tier_id: 't_vip1', status: 'reserved', reserved_until: new Date(Date.now() + 60_000).toISOString() },
        ];
        const query = (rows: unknown[]) => {
            const builder: Record<string, unknown> = {};
            for (const method of ['select', 'eq', 'gte', 'order', 'limit', 'in']) builder[method] = () => builder;
            builder.then = (resolve: (value: { data: unknown[] }) => void) => resolve({ data: rows });
            return builder;
        };
        const db = { from: (table: string) => query(table === 'studio_events' ? [event] : tickets) };
        const text = await eventsBriefing(db as never, 'p1', Date.parse('2026-12-01T00:00:00Z'));
        expect(text).toContain('Rooftop Party: Sun 20 Dec, 8:00 pm (Lagos time), Lekki.');
        expect(text).toContain('Regular ₦10,000 (20 left), VIP ₦50,000 (sold out)');
        expect(text).toContain('https://studio.cencori.com/e/rooftop-party');
        expect(text).toContain("Don't take ticket payments in the chat.");
    });

    it('keeps sold tickets safe when the ticket types change', () => {
        const current = [{ id: 't_reg1', name: 'Regular', price: 10000, capacity: 100 }, { id: 't_vip1', name: 'VIP', price: 50000, capacity: 10 }, { id: 't_eb01', name: 'Early bird', price: 5000, capacity: 20 }];
        const taken = { t_reg1: 40, t_vip1: 6 };
        // New price and a new type: Regular keeps its id (matched by name), Early bird (none sold) can go.
        const changed = checkTierChanges(current, [{ id: 't_new1', name: 'regular', price: 12000, capacity: 100 }, { id: 't_vip1', name: 'VIP', price: 50000, capacity: 10 }, { id: 't_tab1', name: 'Table for 6', price: 300000, capacity: 5 }], taken);
        expect(changed).toMatchObject({ ok: true, tiers: [{ id: 't_reg1', price: 12000 }, { id: 't_vip1' }, { id: 't_tab1' }] });
        expect(checkTierChanges(current, [current[0]], taken)).toMatchObject({ ok: false, message: expect.stringContaining('VIP has 6 tickets sold') });
        expect(checkTierChanges(current, [current[0], { ...current[1], capacity: 5 }], taken)).toMatchObject({ ok: false, message: 'VIP has 6 sold already, so it needs at least 6.' });
    });
});
