/**
 * Memory operations quotas — the spend guard on the shared managed keys.
 *
 * Stored-count quota (quota.ts) caps what sits in Postgres. This caps what
 * RUNS: every opted-in turn costs a search embedding plus ~2–3 managed LLM
 * calls (extraction + reconciliation, +1 with the entity graph). All of it
 * is absorbed by Cencori on shared Groq/Cerebras/Gemini quota, so volume —
 * not stored rows — is the abuse and cost vector (MON-6).
 *
 * Two dimensions, project-monthly first (protects the shared keys), then
 * per-end-user daily (a single hot user). Both ride the shared Redis
 * fixed-window limiter; checking IS counting (INCR on check).
 *
 * Fail-open by contract on the chat path: when Redis is unavailable the
 * limiter follows the gateway fail-open flag and retrieval proceeds. Direct
 * endpoints surface denials as 429 with an upgrade payload.
 */

import { checkCustomRateLimit } from '@/lib/rate-limit';
import {
    getMemoryOpsQuota,
    getMemoryOpsUserDailyQuota,
    type SubscriptionTier,
} from '@/lib/entitlements';

export type MemoryOpsOp = 'search' | 'write';

export interface MemoryOpsStatus {
    allowed: boolean;
    used: number;
    limit: number;
    /** ms until the denying window resets (0 when allowed). */
    resetMs: number;
    /** Which dimension denied (null when allowed). */
    scope: 'project' | 'user' | null;
}

const MONTH_SECONDS = 30 * 24 * 60 * 60;
const DAY_SECONDS = 24 * 60 * 60;

export class MemoryOpsExceededError extends Error {
    op: MemoryOpsOp;
    status: MemoryOpsStatus;
    constructor(op: MemoryOpsOp, status: MemoryOpsStatus) {
        super(`Memory ${op} operations quota exceeded`);
        this.name = 'MemoryOpsExceededError';
        this.op = op;
        this.status = status;
    }
}

export function isMemoryOpsExceededError(error: unknown): error is MemoryOpsExceededError {
    return error instanceof MemoryOpsExceededError;
}

/**
 * Check (and consume one unit of) the ops allowance for a memory operation.
 * Project-monthly is checked first so shared-key protection binds before any
 * single user is blamed. Session scope is never counted — it is Redis-only,
 * no managed LLM spend.
 */
export async function checkMemoryOpsQuota(
    projectId: string,
    tier: SubscriptionTier,
    scopeKey: string,
    op: MemoryOpsOp
): Promise<MemoryOpsStatus> {
    const field = op === 'search' ? 'searches' : 'writes';

    const monthlyLimit = getMemoryOpsQuota(tier)[field];
    if (Number.isFinite(monthlyLimit)) {
        const m = await checkCustomRateLimit(
            `memory_ops:v1:${projectId}:${op}:month`,
            monthlyLimit,
            MONTH_SECONDS
        );
        if (!m.allowed) {
            return {
                allowed: false,
                used: monthlyLimit - m.remaining,
                limit: monthlyLimit,
                resetMs: Math.max(0, m.reset - Date.now()),
                scope: 'project',
            };
        }
    }

    const dailyLimit = getMemoryOpsUserDailyQuota(tier)[field];
    if (Number.isFinite(dailyLimit)) {
        const d = await checkCustomRateLimit(
            `memory_ops:v1:${projectId}:${scopeKey}:${op}:day`,
            dailyLimit,
            DAY_SECONDS
        );
        if (!d.allowed) {
            return {
                allowed: false,
                used: dailyLimit - d.remaining,
                limit: dailyLimit,
                resetMs: Math.max(0, d.reset - Date.now()),
                scope: 'user',
            };
        }
    }

    const effectiveLimit = Number.isFinite(monthlyLimit) ? monthlyLimit : dailyLimit;
    return { allowed: true, used: 0, limit: effectiveLimit, resetMs: 0, scope: null };
}

/** Roadmap-style 429 payload for memory_ops_quota_exceeded. */
export function buildMemoryOpsExceededBody(
    projectId: string,
    tier: SubscriptionTier,
    op: MemoryOpsOp,
    status: MemoryOpsStatus
) {
    return {
        error: {
            code: 'memory_ops_quota_exceeded',
            message: `Project has exceeded its memory ${op} operations allowance for this period.`,
            upgradeUrl: `https://cencori.com/pricing?upgrade=memory&project=${projectId}`,
            tier,
            op,
            scope: status.scope,
            used: status.used,
            limit: status.limit,
            retryAfterMs: status.resetMs,
        },
    };
}
