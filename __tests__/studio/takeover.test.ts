import { describe, expect, it } from 'vitest';
import { OWNER_IDLE_MS, addManualMessage, flagNeedsOwner, handBack, isOwnerActive, needsOwner, stepIn, takeUnseenManualMessages } from '@/lib/studio/takeover';

/** One sessions row, read and written the way the module does. */
function fakeDb(metadata: Record<string, unknown> = {}) {
    const row = { metadata, updated_at: '' };
    const db = {
        from: () => {
            let patch: Record<string, unknown> | null = null;
            const builder = {
                select: () => builder,
                update: (value: Record<string, unknown>) => { patch = value; return builder; },
                eq: () => (patch ? Promise.resolve(Object.assign(row, patch)).then(() => ({ error: null })) : builder),
                maybeSingle: async () => ({ data: { metadata: row.metadata } }),
            };
            return builder;
        },
    };
    return { db: db as never, row };
}

describe('stepping in', () => {
    it('pauses the assistant while the owner is active, and lets it back after 30 quiet minutes', () => {
        const now = Date.now();
        expect(isOwnerActive({ owner_active_at: new Date(now - 60_000).toISOString() }, now)).toBe(true);
        expect(isOwnerActive({ owner_active_at: new Date(now - OWNER_IDLE_MS - 1).toISOString() }, now)).toBe(false);
        expect(isOwnerActive({ owner_active_at: null }, now)).toBe(false);
        expect(isOwnerActive(null, now)).toBe(false);
    });

    it('flags a chat for the owner, and clears it when they step in or hand back', async () => {
        const { db, row } = fakeDb();
        await flagNeedsOwner(db, 's1', 'Wants a call back: table for 14');
        expect(needsOwner(row.metadata)?.reason).toBe('Wants a call back: table for 14');
        await stepIn(db, 's1');
        expect(needsOwner(row.metadata)).toBeNull();
        expect(isOwnerActive(row.metadata)).toBe(true);
        await handBack(db, 's1');
        expect(isOwnerActive(row.metadata)).toBe(false);
    });

    it('keeps what was said while paused and tells the assistant once, on its next turn', async () => {
        const { db, row } = fakeDb();
        await addManualMessage(db, 's1', { from: 'customer', text: 'Can we have the terrace?' });
        await addManualMessage(db, 's1', { from: 'owner', text: 'Yes, terrace at 8pm.' });
        expect(isOwnerActive(row.metadata)).toBe(true);
        const note = await takeUnseenManualMessages(db, 's1');
        expect(note).toContain('Customer: Can we have the terrace?');
        expect(note).toContain('Owner: Yes, terrace at 8pm.');
        expect(await takeUnseenManualMessages(db, 's1')).toBeNull();
    });
});
