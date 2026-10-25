import { describe, expect, it } from 'vitest';
import { diffLines, diffStats } from '@/lib/agents/line-diff';

describe('diffLines', () => {
    it('marks nothing changed for identical text', () => {
        const rows = diffLines('a\nb', 'a\nb');
        expect(rows.every((row) => row.kind === 'same')).toBe(true);
        expect(diffStats(rows)).toEqual({ added: 0, removed: 0 });
    });

    it('pairs a replaced line side by side', () => {
        const rows = diffLines('You are Aura.\nBe kind.', 'You are Nicole.\nBe kind.');
        expect(rows[0]).toEqual({ kind: 'changed', left: 'You are Aura.', right: 'You are Nicole.' });
        expect(rows[1]).toEqual({ kind: 'same', left: 'Be kind.', right: 'Be kind.' });
        expect(diffStats(rows)).toEqual({ added: 1, removed: 1 });
    });

    it('shows pure additions and removals on one side only', () => {
        expect(diffLines('a', 'a\nb')).toContainEqual({ kind: 'changed', left: null, right: 'b' });
        expect(diffLines('a\nb', 'a')).toContainEqual({ kind: 'changed', left: 'b', right: null });
    });

    it('treats a first publish as all additions', () => {
        expect(diffStats(diffLines('', 'one\ntwo'))).toEqual({ added: 2, removed: 0 });
    });
});
