import { describe, expect, it } from 'vitest';
import { SUPPORTED_PROVIDERS } from '@/lib/providers/config';
import { MODEL_RETIREMENTS, modelRetirement } from '@/lib/providers/retirements';

describe('model retirement dates', () => {
    const ids = new Set(SUPPORTED_PROVIDERS.flatMap((p) => p.models.map((m) => m.id)));

    it('every entry is a model in the catalog, with a real date', () => {
        for (const [id, entry] of Object.entries(MODEL_RETIREMENTS)) {
            expect(ids.has(id), id).toBe(true);
            expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(Number.isNaN(Date.parse(entry.date)), id).toBe(false);
        }
    });

    it('answers null for a model with no announced date', () => {
        expect(modelRetirement('gpt-5-nano')).toEqual({ date: '2026-12-11', replacedBy: 'gpt-6-luna' });
        expect(modelRetirement('gpt-6-luna')).toBeNull();
    });
});
