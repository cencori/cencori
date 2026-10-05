/**
 * @vitest-environment node
 *
 * Safety classification surfacing: scanned verdicts (with category-level
 * reasons, never excerpts) on bodies, compact headers on streams, and an
 * explicit unscanned marker for passthrough — never silent absence.
 */
import { describe, expect, it } from 'vitest';
import { buildInputSafetyBlock, safetyHeaders } from '../safety-response';

function pipeline(overrides: Record<string, unknown> = {}) {
    return {
        ok: true as const,
        messages: [],
        inputText: 'hi',
        inputSecurity: {
            safe: true,
            reasons: [],
            layer: 'multi',
            riskScore: 0.12,
            confidence: 0.9,
        },
        securityEnabled: true,
        customRules: { rules: [] },
        ...overrides,
    };
}

describe('buildInputSafetyBlock', () => {
    it('reports a scanned safe verdict with the score', () => {
        expect(buildInputSafetyBlock(pipeline())).toEqual({
            scanned: true,
            input: { safe: true, layer: 'multi', riskScore: 0.12, reasons: [] },
        });
    });

    it('reports a flagged verdict with capped category reasons', () => {
        const block = buildInputSafetyBlock(
            pipeline({
                inputSecurity: {
                    safe: false,
                    reasons: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
                    layer: 'jailbreak',
                    riskScore: 0.856,
                    confidence: 0.8,
                },
            })
        );
        expect(block).toEqual({
            scanned: true,
            input: {
                safe: false,
                layer: 'jailbreak',
                riskScore: 0.86,
                reasons: ['a', 'b', 'c', 'd', 'e'],
            },
        });
    });

    it('marks passthrough explicitly unscanned instead of omitting', () => {
        expect(buildInputSafetyBlock(pipeline({ securityEnabled: false }))).toEqual({
            scanned: false,
        });
        expect(buildInputSafetyBlock({ ok: true } as never)).toEqual({ scanned: false });
    });
});

describe('safetyHeaders', () => {
    it('encodes the verdict compactly for streams', () => {
        expect(
            safetyHeaders({
                scanned: true,
                input: { safe: false, layer: 'jailbreak', riskScore: 0.86, reasons: [] },
            })
        ).toEqual({
            'X-Cencori-Safety-Scanned': 'true',
            'X-Cencori-Safety-Input': 'flagged',
            'X-Cencori-Safety-Score': '0.86',
        });
        expect(
            safetyHeaders({
                scanned: true,
                input: { safe: true, layer: 'input', riskScore: 0, reasons: [] },
            })['X-Cencori-Safety-Input']
        ).toBe('safe');
    });

    it('marks unscanned streams explicitly', () => {
        expect(safetyHeaders({ scanned: false })).toEqual({ 'X-Cencori-Safety-Scanned': 'false' });
    });
});
