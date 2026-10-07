/**
 * First-class per-request controls shared by the chat and responses bodies.
 *
 * `timeout_ms` bounds one provider attempt (sanitized and capped downstream;
 * the adapter enforces its own attempt deadline underneath the gateway's
 * outer bound). `max_cost_usd` fails unary calls exactly before returning
 * and throws at stream tally as a stop signal for the issuing loop.
 */

export interface ParsedRequestControls {
    timeoutMs?: number;
    maxCostUsd?: number;
}

/** Upper bound so one call cannot pin a worker. Mirrors the executor cap. */
export const MAX_REQUEST_TIMEOUT_MS = 300_000;

export function parseRequestControls(body: {
    timeout_ms?: unknown;
    timeoutMs?: unknown;
    max_cost_usd?: unknown;
    maxCostUsd?: unknown;
}): ParsedRequestControls | { error: string } {
    const rawTimeout = body.timeout_ms ?? body.timeoutMs;
    let timeoutMs: number | undefined;
    if (rawTimeout !== undefined && rawTimeout !== null) {
        if (typeof rawTimeout !== 'number' || !Number.isFinite(rawTimeout) || rawTimeout <= 0) {
            return { error: '`timeout_ms` must be a positive number of milliseconds' };
        }
        timeoutMs = Math.min(rawTimeout, MAX_REQUEST_TIMEOUT_MS);
    }
    const rawBudget = body.max_cost_usd ?? body.maxCostUsd;
    let maxCostUsd: number | undefined;
    if (rawBudget !== undefined && rawBudget !== null) {
        if (typeof rawBudget !== 'number' || !Number.isFinite(rawBudget) || rawBudget < 0) {
            return { error: '`max_cost_usd` must be a non-negative number (USD)' };
        }
        maxCostUsd = rawBudget;
    }
    return { timeoutMs, maxCostUsd };
}
