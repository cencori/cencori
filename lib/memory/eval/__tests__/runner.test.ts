/**
 * @vitest-environment node
 *
 * resolveAsOf — temporal questions resolve to an explicit ISO instant, or to
 * the replay timestamp captured after a transcript turn (the only instants
 * that fall inside validity windows, which are stamped at write time).
 */
import { describe, expect, it } from 'vitest';
import { resolveAsOf } from '../runner';
import type { EvalQuestion } from '../types';

function question(partial: Partial<EvalQuestion>): EvalQuestion {
    return { id: 'q', category: 'temporal', query: '?', ...partial };
}

describe('resolveAsOf', () => {
    it('prefers an explicit ISO asOf', () => {
        expect(
            resolveAsOf(question({ asOf: '2026-01-01T00:00:00Z', asOfTurn: 0 }), ['2026-06-01T00:00:00Z'])
        ).toBe('2026-01-01T00:00:00Z');
    });

    it('resolves asOfTurn to the replay timestamp after that turn', () => {
        expect(resolveAsOf(question({ asOfTurn: 1 }), ['t0', 't1', 't2'])).toBe('t1');
    });

    it('returns null without any temporal marker', () => {
        expect(resolveAsOf(question({}), ['t0'])).toBeNull();
    });

    it('returns null when the turn index is out of range', () => {
        expect(resolveAsOf(question({ asOfTurn: 9 }), ['t0'])).toBeNull();
    });
});
