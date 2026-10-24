import { detectPII } from './content-filter';

/**
 * Gateway input protection: PII only, and only when the project opted in.
 *
 * Cencori does not make security decisions for users by default. Jailbreak,
 * prompt-injection keyword, intent and output scanning were removed: they were
 * heuristic, produced false positives, and added latency to every request.
 */

export interface SecurityCheckResult {
    safe: boolean;
    reasons: string[];
    layer: 'input' | 'output';
    riskScore: number;
    confidence: number;
}

export interface ProjectSecurityConfig {
    /** Dashboard opt-in for PII protection. Absent/false = nothing is checked. */
    enabled?: boolean;
    filterPII?: boolean;
}

const PASS: SecurityCheckResult = {
    safe: true,
    reasons: [],
    layer: 'input',
    riskScore: 0,
    confidence: 1,
};

/**
 * Check user input before it reaches the model. Blocks when PII protection is
 * on and any PII is found.
 */
export function checkInputSecurity(
    inputText: string,
    _conversationHistory?: Array<{ role: string; content: string }>,
    config?: ProjectSecurityConfig
): SecurityCheckResult {
    if (config?.enabled !== true || config.filterPII === false) {
        return PASS;
    }

    const pii = detectPII(inputText);
    if (pii.safe) return PASS;

    return {
        safe: false,
        reasons: pii.reasons.map((reason) => `[PII] ${reason}`),
        layer: 'input',
        riskScore: 1,
        confidence: 1,
    };
}
