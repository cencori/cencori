import { describe, expect, it } from 'vitest';
import { geminiCompletionTokens } from '../gemini';

describe('geminiCompletionTokens', () => {
    it('bills thinking tokens as output alongside the visible reply', () => {
        // Shape of a real gemini-4-hydrogen reply (2026-11-26).
        expect(geminiCompletionTokens({ candidatesTokenCount: 5, thoughtsTokenCount: 18 })).toBe(23);
    });

    it('counts only the reply when the model did not think', () => {
        expect(geminiCompletionTokens({ candidatesTokenCount: 7 })).toBe(7);
    });

    it('is zero without usage metadata', () => {
        expect(geminiCompletionTokens(undefined)).toBe(0);
        expect(geminiCompletionTokens(null)).toBe(0);
    });
});
