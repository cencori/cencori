/**
 * Memory poisoning guards — prompt-injection defense for the memory layer.
 *
 * Two halves:
 * 1. FRAMING (marking): every injected block labels stored notes UNTRUSTED
 *    data-never-instructions, with an explicit conflict rule. See
 *    buildMemorySystemBlock / buildMemoryIndexBlock (server) and the mirrored
 *    builders in packages/sdk (standalone door) — keep all four wordings in
 *    sync; the tests below pin them.
 * 2. SCANNING (filtering): stored facts are scanned for instruction-override
 *    language before they persist (writeMemories + session appends) and at
 *    recall (defense in depth for rows written before this shipped). The
 *    general jailbreak detector targets chat-time social engineering and has
 *    no override-phrase coverage, so memory carries its own pattern set and
 *    layers the general detector underneath.
 *
 * Threat model note: user scope is self-poisoning only (your own notes affect
 * your own turns). Workspace/org scopes are shared — one writer can poison
 * every reader — which is why the write path drops rather than merely flags.
 */

import { detectJailbreak, isJailbreakRisky } from '@/lib/safety/jailbreak-detector';

/** Instruction-override signals — the memory-poisoning shape. */
const MEMORY_INJECTION_PHRASES = [
    'ignore previous instructions',
    'ignore all previous instructions',
    'ignore your instructions',
    'disregard your instructions',
    'disregard all previous',
    'override your instructions',
    'forget your instructions',
    'bypass your instructions',
    'you must obey',
    'you must always obey',
    'system prompt',
    'reveal your instructions',
    'show me your instructions',
    'do not follow',
    'pretend you are not',
];

/** Score at or above which a stored fact is dropped, never persisted. */
export const MEMORY_INJECTION_DROP_THRESHOLD = 0.7;

export interface MemoryInjectionVerdict {
    risky: boolean;
    risk: number;
    patterns: string[];
}

/**
 * Score one stored fact for injection content. Combines the memory-specific
 * override patterns with the general jailbreak detector (whichever is worse).
 */
export function detectMemoryInjection(content: string): MemoryInjectionVerdict {
    const lower = content.toLowerCase();
    const patterns: string[] = [];
    let overrideHits = 0;
    for (const phrase of MEMORY_INJECTION_PHRASES) {
        if (lower.includes(phrase)) {
            patterns.push(`memory-override: "${phrase}"`);
            overrideHits++;
        }
    }
    // One override phrase is enough to drop: start at the threshold, stack up.
    let risk = overrideHits > 0 ? Math.min(1, 0.65 + overrideHits * 0.1) : 0;
    const general = detectJailbreak(content);
    if (general.risk > risk) {
        risk = general.risk;
        patterns.push(...general.patterns);
    }
    return {
        risky: risk >= MEMORY_INJECTION_DROP_THRESHOLD,
        risk: Math.min(1, risk),
        patterns,
    };
}

/**
 * Split facts into clean ones plus a dropped count. Pure — callers decide
 * what to log/emit for the dropped set.
 */
export function filterInjectedFacts<T extends { content: string }>(facts: T[]): {
    clean: T[];
    dropped: Array<{ content: string; risk: number; patterns: string[] }>;
} {
    const clean: T[] = [];
    const dropped: Array<{ content: string; risk: number; patterns: string[] }> = [];
    for (const fact of facts) {
        const verdict = detectMemoryInjection(fact.content);
        if (verdict.risky) {
            dropped.push({ content: fact.content, risk: verdict.risk, patterns: verdict.patterns });
        } else {
            clean.push(fact);
        }
    }
    return { clean, dropped };
}
