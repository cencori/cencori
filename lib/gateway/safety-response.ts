/**
 * Safety classification surfacing — what the caller sees about guardrails.
 *
 * The input pipeline already verdicts every request (jailbreak/content/PII
 * layers with scores); historically that verdict lived only in server logs,
 * so a 200 whose model "resisted on its own" looked identical to a request
 * that was never scanned. This module formats the verdict for responses:
 * a `safety` object on non-streaming JSON bodies, compact headers on streams.
 *
 * Only category-level reasons are exposed (never matched excerpts or raw
 * payload slices) — the caller learns the classification, not the ammunition.
 */

import type { GatewayInputPipelineSuccess } from './guard-types';

export interface SafetyInputBlock {
    safe: boolean;
    layer: string;
    riskScore: number;
    reasons: string[];
}

export interface SafetyBlock {
    scanned: boolean;
    input?: SafetyInputBlock;
}

type PipelineLike =
    | GatewayInputPipelineSuccess
    | { ok: true; securityEnabled?: boolean; inputSecurity?: unknown };

function round2(value: number): number {
    return Math.round(Number(value) * 100) / 100;
}

/** Build the `safety` response block from a successful input pipeline. */
export function buildInputSafetyBlock(pipeline: PipelineLike): SafetyBlock {
    const security = (pipeline as { inputSecurity?: unknown }).inputSecurity as
        | {
            safe?: boolean;
            layer?: string;
            riskScore?: number;
            reasons?: string[];
        }
        | undefined;
    const enabled =
        (pipeline as { securityEnabled?: boolean }).securityEnabled !== false && !!security;
    if (!enabled || !security) {
        // Fast-lane/passthrough: the caller runs its own safety layers, so
        // there is no gateway verdict to report. Explicit, not absent.
        return { scanned: false };
    }
    return {
        scanned: true,
        input: {
            safe: security.safe !== false,
            layer: typeof security.layer === 'string' ? security.layer : 'input',
            riskScore: round2(typeof security.riskScore === 'number' ? security.riskScore : 0),
            reasons: Array.isArray(security.reasons) ? security.reasons.slice(0, 5).map(String) : [],
        },
    };
}

/** Compact streaming headers carrying the same verdict as the body block. */
export function safetyHeaders(block: SafetyBlock): Record<string, string> {
    if (!block.scanned || !block.input) {
        return { 'X-Cencori-Safety-Scanned': 'false' };
    }
    return {
        'X-Cencori-Safety-Scanned': 'true',
        'X-Cencori-Safety-Input': block.input.safe ? 'safe' : 'flagged',
        'X-Cencori-Safety-Score': String(block.input.riskScore),
    };
}
