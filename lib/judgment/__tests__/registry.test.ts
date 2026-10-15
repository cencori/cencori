/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { getJudgmentAdapter, resolveJudgmentAdapter } from '../registry';

describe('judgment provider registry', () => {
    it('serves every catalog judgment model through the same route contract', () => {
        for (const id of ['jev-latest', 'jev-preview', 'jev-1.13.0']) {
            const adapter = resolveJudgmentAdapter(id);
            expect(adapter.provider).toBe('typesafe');
            expect(typeof adapter.evaluate).toBe('function');
            expect(typeof adapter.price).toBe('function');
            expect(typeof adapter.resolveKey).toBe('function');
        }
    });

    it('fails closed on unknown ids', () => {
        expect(() => resolveJudgmentAdapter('gpt-5')).toThrowError(
            expect.objectContaining({ code: 'unknown_model' }),
        );
    });

    it('returns null for vendors with no adapter', () => {
        expect(getJudgmentAdapter('openai')).toBeNull();
        expect(getJudgmentAdapter('typesafe')?.provider).toBe('typesafe');
    });
});
