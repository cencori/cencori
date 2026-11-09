/**
 * Whether a developer org's paid plan is in good standing, in grace, or paused.
 *
 * A Pro subscription that lapses (renewal payment failed, or the paid period
 * ended without a renewal) gets PRO_GRACE_DAYS of grace, counted from when it
 * lapsed; after that the org's projects pause: the API refuses requests until
 * the subscription is paid. Nothing is deleted.
 *
 * Computed from the subscription columns, so no job has to flip a flag: the
 * moment the grace ends, requests stop; the moment Stripe (or Bachs) reports
 * the subscription paid, they start again.
 */

export const PRO_GRACE_DAYS = 7;

const DAY_MS = 86_400_000;
/** Webhooks can arrive a little after a period rolls over: don't call that a lapse. */
const PERIOD_END_SLACK_MS = DAY_MS;

export type PlanStanding = 'active' | 'grace' | 'paused';

export interface PlanState {
    standing: PlanStanding;
    /** When the plan lapsed (null while active). */
    lapsedAt: string | null;
    /** When requests stop (grace) or stopped (paused). */
    graceEndsAt: string | null;
    reason: 'payment_failed' | 'period_ended' | 'pro_required' | null;
}

export interface OrgPlanColumns {
    subscription_tier?: string | null;
    subscription_status?: string | null;
    subscription_current_period_start?: string | null;
    subscription_current_period_end?: string | null;
    billing_provider?: string | null;
    account_type?: string | null;
    /** An extra org (the owner already has a Free one): it must be on Pro. See database/brimble/0800_plan_enforcement.sql. */
    requires_pro?: boolean | null;
}

const ACTIVE: PlanState = { standing: 'active', lapsedAt: null, graceEndsAt: null, reason: null };
const PAID_TIERS = new Set(['pro', 'team']);
const PAYMENT_FAILED = new Set(['past_due', 'unpaid']);

export function planState(org: OrgPlanColumns | null | undefined, now: Date = new Date()): PlanState {
    if (!org) return ACTIVE;
    // One Free org per person: an extra org stays paused until it's on Pro.
    if (org.requires_pro && (org.subscription_tier ?? 'free') === 'free' && org.account_type !== 'business') {
        return { standing: 'paused', lapsedAt: null, graceEndsAt: null, reason: 'pro_required' };
    }
    // Free has nothing to lapse; Enterprise is contracted, not self-serve; business
    // accounts run their own plan system (lib/business/plans.ts).
    if (!PAID_TIERS.has(org.subscription_tier ?? 'free')) return ACTIVE;
    if (org.account_type === 'business') return ACTIVE;

    const status = org.subscription_status ?? 'active';
    const start = parse(org.subscription_current_period_start);
    const end = parse(org.subscription_current_period_end);

    let lapsedAt: Date | null = null;
    let reason: PlanState['reason'] = null;
    if (PAYMENT_FAILED.has(status)) {
        // Stripe starts the new period even when its invoice fails, so the lapse
        // began when the current period did. Bachs only marks the failure, so it
        // lapsed when the paid period ended.
        lapsedAt = org.billing_provider === 'stripe' ? (start ?? end) : (end ?? start);
        reason = 'payment_failed';
    } else if (status === 'cancelled' || status === 'canceled' || status === 'paused' || status === 'incomplete') {
        // Still marked paid but not being paid: lapsed when the period ended.
        lapsedAt = end ?? start;
        reason = 'period_ended';
    } else if (end && now.getTime() > end.getTime() + PERIOD_END_SLACK_MS) {
        // Marked active, but the paid period ended with no renewal recorded
        // (a missed webhook, or a one-off Bachs period).
        lapsedAt = end;
        reason = 'period_ended';
    }

    // Unknown dates: never pause on a guess.
    if (!lapsedAt) return ACTIVE;

    const graceEnd = new Date(lapsedAt.getTime() + PRO_GRACE_DAYS * DAY_MS);
    return {
        standing: now.getTime() < graceEnd.getTime() ? 'grace' : 'paused',
        lapsedAt: lapsedAt.toISOString(),
        graceEndsAt: graceEnd.toISOString(),
        reason,
    };
}

/** The API's answer once an org is paused: a clear, actionable 402. */
export function planPausedBody(state: PlanState): { error: string; message: string; code: 'plan_paused'; grace_ended_at: string | null; billing_url: string } {
    return {
        error: 'Projects paused',
        message: state.reason === 'pro_required'
            ? 'This organization needs Pro. Each person gets one Free organization; others are on Pro. Upgrade this organization to start using it.'
            : state.reason === 'payment_failed'
                ? 'The Pro subscription payment failed and the 7-day grace period has ended, so this organization\'s projects are paused. Update the payment method to resume.'
                : 'The Pro subscription ended and the 7-day grace period is over, so this organization\'s projects are paused. Renew Pro to resume.',
        code: 'plan_paused',
        grace_ended_at: state.graceEndsAt,
        billing_url: 'https://cencori.com/billing',
    };
}

function parse(value: string | null | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}
