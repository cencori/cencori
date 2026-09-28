import type { SecurityCheckResult } from '@/lib/safety/multi-layer-check';
import type { GatewayInputPipelineSuccess } from '@/lib/gateway/guard-types';
import type { UnifiedMessage } from '@/lib/providers/base';

/**
 * Fast-lane (passthrough) mode for callers that run their own safety layers.
 *
 * Opt-in per request via body `{ passthrough: true }` / `{ fast_lane: true }`
 * or header `x-cencori-passthrough: true` / `x-cencori-fast-lane: true`.
 * When active the gateway skips, in the critical path:
 * - input pipeline (security scan, custom data rules, governance policies)
 * - prompt-cache lookup/store
 * - output guard (per-chunk + final)
 * - gateway retries + cross-provider fallback (single upstream attempt, so
 *   the caller's own fallback layers trigger in seconds, not after our
 *   60s x 3 retry chain)
 *
 * Auth, rate limiting, credits, provider routing, and async observability
 * (ai_requests logging, usage) still run. The passthrough is recorded in
 * request metadata so logs stay attributable.
 */

const FAST_LANE_HEADERS = ['x-cencori-passthrough', 'x-cencori-fast-lane'];

export function isFastLaneBody(body: unknown): boolean {
    if (!body || typeof body !== 'object') return false;
    const record = body as Record<string, unknown>;
    return record.passthrough === true || record.fast_lane === true;
}

export function isFastLaneRequest(
    body: unknown,
    headers: Headers | Record<string, string | null | undefined>,
): boolean {
    if (isFastLaneBody(body)) return true;
    const get = (name: string): string | null | undefined =>
        typeof (headers as Headers).get === 'function'
            ? (headers as Headers).get(name)
            : (headers as Record<string, string | null | undefined>)[name];
    return FAST_LANE_HEADERS.some((name) => get(name)?.toLowerCase() === 'true');
}

/** Safe-default input pipeline result: nothing scanned, nothing rewritten. */
export function buildPassthroughInputPipeline(
    messages: UnifiedMessage[],
): GatewayInputPipelineSuccess {
    const lastUser = messages.slice().reverse().find((m) => m.role === 'user');
    const inputText = typeof lastUser?.content === 'string' ? lastUser.content : '';
    const inputSecurity: SecurityCheckResult = {
        safe: true,
        reasons: [],
        layer: 'input',
        riskScore: 0,
        confidence: 1,
    };
    return {
        ok: true,
        messages,
        inputText,
        inputSecurity,
        securityEnabled: false,
        customRules: {
            rules: [],
            inputResult: {
                content: inputText,
                wasProcessed: false,
                matchedRules: [],
                shouldBlock: false,
            },
        },
    };
}
