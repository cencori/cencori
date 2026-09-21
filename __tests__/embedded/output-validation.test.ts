import { describe, expect, it } from 'vitest';
import { validateJsonSchema } from '@/lib/embedded/json-schema';
import { verifyClientToken } from '@/lib/embedded/client-tokens';

describe('json-schema output validation', () => {
    const schema = {
        type: 'object',
        required: ['plan', 'steps'],
        properties: {
            plan: { type: 'string' },
            steps: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number' },
        },
    };

    it('accepts conforming output', () => {
        expect(validateJsonSchema(schema, { plan: 'x', steps: ['a'] })).toEqual([]);
    });

    it('rejects missing required properties', () => {
        const errors = validateJsonSchema(schema, { plan: 'x' });
        expect(errors.some((e) => e.includes('steps'))).toBe(true);
    });

    it('rejects wrong types including nested items', () => {
        const errors = validateJsonSchema(schema, { plan: 'x', steps: [42] });
        expect(errors.some((e) => e.includes('string'))).toBe(true);
    });

    it('rejects non-objects at the root', () => {
        expect(validateJsonSchema(schema, 'nope').length).toBeGreaterThan(0);
    });
});

describe('client-token signature robustness', () => {
    it('rejects truncated signatures without throwing', () => {
        expect(() => verifyClientToken('ect_abc.def')).not.toThrow();
        const result = verifyClientToken('ect_abc.def.xyz');
        expect(result.ok).toBe(false);
    });

    it('rejects mismatched-length signatures without throwing', () => {
        expect(() => verifyClientToken('ect_aGVhZGVy.cGF5bG9hZA.short')).not.toThrow();
        expect(verifyClientToken('ect_aGVhZGVy.cGF5bG9hZA.short').ok).toBe(false);
    });
});
