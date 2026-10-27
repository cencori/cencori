import { describe, expect, it } from 'vitest';
import { OWNER_IDLE_MS, addManualMessage, flagNeedsOwner, handBack, isOwnerActive, needsOwner, stepIn, takeUnseenManualMessages, withoutCatchUpNote, isUnread, markRead, markUnread, readAt } from '@/lib/studio/takeover';

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

describe('withoutCatchUpNote', () => {
    it('shows the customer only what they typed, not the note the assistant was given', async () => {
        const { db } = fakeDb();
        await addManualMessage(db, 's1', { from: 'owner', text: 'Yes we deliver' });
        const note = await takeUnseenManualMessages(db, 's1');
        expect(withoutCatchUpNote(`${note}\n\nHow much is it?`)).toBe('How much is it?');
        expect(withoutCatchUpNote('Plain message')).toBe('Plain message');
    });
});

describe('read and unread', () => {
    const after = Date.parse('2026-11-01T10:00:00Z');

    it('is unread when the customer wrote after you last opened it', () => {
        expect(isUnread(after, null, null)).toBe(true);
        expect(isUnread(after, null, after - 60_000)).toBe(true);
        expect(isUnread(after, null, after + 60_000)).toBe(false);
    });

    it('counts a reply from the business as read', () => {
        expect(isUnread(after, after + 1_000, null)).toBe(false);
    });

    it('leaves chats from before read tracking alone', () => {
        expect(isUnread(Date.parse('2026-10-20T10:00:00Z'), null, null)).toBe(false);
        expect(isUnread(null, null, null)).toBe(false);
    });

    it('marks read for one person, and unread again', async () => {
        const { db, row } = fakeDb();
        await markRead(db, 's1', 'u1');
        expect(readAt(row.metadata, 'u1')).not.toBeNull();
        expect(readAt(row.metadata, 'u2')).toBeNull();
        await markUnread(db, 's1', 'u1');
        expect(readAt(row.metadata, 'u1')).toBeNull();
    });
});
