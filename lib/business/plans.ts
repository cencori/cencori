/**
 * Business plans: what an organization that builds agents for its own
 * business (a restaurant, a shop) pays for. A flat monthly naira price for a
 * number of conversations, instead of the developer track's credits. The
 * developer tier (`subscription_tier`) and credits are untouched; an
 * organization is on one track or the other (`account_type`).
 *
 * A conversation is what the channels already count as one: a visitor's
 * chat on the website or share link, or a WhatsApp thread, up to 40 messages
 * or a day of quiet.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export type BusinessPlanId = 'trial' | 'starter' | 'growth' | 'business';
export type PaidBusinessPlanId = Exclude<BusinessPlanId, 'trial'>;

export interface BusinessPlan {
    id: BusinessPlanId;
    name: string;
    /** Naira a month; 0 for the trial. */
    priceNgn: number;
    conversations: number;
    agents: number;
    /** Every model, or only the default one. */
    allModels: boolean;
}

export const BUSINESS_PLANS: Record<BusinessPlanId, BusinessPlan> = {
    trial: { id: 'trial', name: 'Free trial', priceNgn: 0, conversations: 50, agents: 1, allModels: false },
    starter: { id: 'starter', name: 'Starter', priceNgn: 15_000, conversations: 100, agents: 1, allModels: false },
    growth: { id: 'growth', name: 'Growth', priceNgn: 35_000, conversations: 500, agents: 3, allModels: false },
    business: { id: 'business', name: 'Business', priceNgn: 75_000, conversations: 1_000, agents: 10, allModels: true },
};

export const PAID_BUSINESS_PLANS: PaidBusinessPlanId[] = ['starter', 'growth', 'business'];
export const BUSINESS_TRIAL_DAYS = 14;

/**
 * Every new agent's model, and the only one below the Business plan. The
 * catalog id: agents are validated against the model registry, which doesn't
 * list the legacy `deepseek-v4-flash` alias.
 */
export const BUSINESS_DEFAULT_MODEL = 'deepseek-v4.1-flash';
/** Agents made before the switch still name the legacy id; it's the same model. */
const BUSINESS_LEGACY_MODEL = 'deepseek-v4-flash';

export function isBusinessPlanId(value: unknown): value is BusinessPlanId {
    return typeof value === 'string' && value in BUSINESS_PLANS;
}

export interface OrganizationPlan {
    accountType: 'developer' | 'business';
    plan: BusinessPlan | null;
    status: 'active' | 'past_due' | 'canceled' | null;
    periodStart: string | null;
    periodEnd: string | null;
    /** On a business plan that's paid up (or in trial) and inside its period. */
    active: boolean;
}

const DEVELOPER: OrganizationPlan = { accountType: 'developer', plan: null, status: null, periodStart: null, periodEnd: null, active: false };

/**
 * The organization's track and business plan. Anything unreadable (including
 * the columns not existing yet) reads as a developer organization, which is
 * how every organization behaved before business plans.
 */
export async function getOrganizationPlan(db: Admin, organizationId: string): Promise<OrganizationPlan> {
    if (!organizationId) return DEVELOPER;
    const { data, error } = await db.from('organizations')
        .select('account_type, business_plan, business_plan_status, business_period_start, business_period_end')
        .eq('id', organizationId)
        .maybeSingle();
    if (error || !data) return DEVELOPER;
    const row = data as Record<string, unknown>;
    if (row.account_type !== 'business') return DEVELOPER;
    return readPlan(row);
}

export function readPlan(row: Record<string, unknown>, now = Date.now()): OrganizationPlan {
    const plan = isBusinessPlanId(row.business_plan) ? BUSINESS_PLANS[row.business_plan] : null;
    const status = row.business_plan_status === 'active' || row.business_plan_status === 'past_due' || row.business_plan_status === 'canceled'
        ? row.business_plan_status
        : null;
    const periodStart = typeof row.business_period_start === 'string' ? row.business_period_start : null;
    const periodEnd = typeof row.business_period_end === 'string' ? row.business_period_end : null;
    const inPeriod = !!periodStart && !!periodEnd && Date.parse(periodStart) <= now && now < Date.parse(periodEnd);
    // A failed renewal keeps the plan running until its period ends; a cancelled one too.
    const active = !!plan && inPeriod && status !== null;
    return { accountType: 'business', plan, status, periodStart, periodEnd, active };
}

/** Can this organization's agents use `model`? Developer organizations can use any. */
export function modelAllowed(plan: OrganizationPlan, model: string | null | undefined): boolean {
    if (plan.accountType !== 'business') return true;
    if (plan.plan?.allModels && plan.active) return true;
    return !model || model === BUSINESS_DEFAULT_MODEL || model === BUSINESS_LEGACY_MODEL;
}

export type ConversationCheck =
    | { ok: true; used: number | null; limit: number | null }
    | { ok: false; reason: 'inactive' | 'limit'; message: string };

/**
 * Count a new conversation against the plan. Developer organizations aren't
 * counted (they pay per use). Business organizations need an active plan with
 * conversations left; the count is atomic, so two chats can't share the last one.
 */
export async function consumeConversation(db: Admin, organizationId: string): Promise<ConversationCheck> {
    const plan = await getOrganizationPlan(db, organizationId);
    if (plan.accountType !== 'business') return { ok: true, used: null, limit: null };
    if (!plan.active || !plan.plan || !plan.periodStart) {
        return { ok: false, reason: 'inactive', message: 'This business’s plan isn’t active.' };
    }
    const { data, error } = await db.rpc('consume_business_conversation' as never, {
        p_organization_id: organizationId,
        p_period_start: plan.periodStart,
        p_limit: plan.plan.conversations,
    } as never);
    // Fail open on a counting error: a customer mid-question shouldn't pay for our outage.
    if (error) return { ok: true, used: null, limit: plan.plan.conversations };
    const used = Number(data);
    if (used < 0) return { ok: false, reason: 'limit', message: 'This business has used all its conversations for this month.' };
    return { ok: true, used, limit: plan.plan.conversations };
}

/** Conversations used in the current period. */
export async function conversationsUsed(db: Admin, organizationId: string, periodStart: string): Promise<number> {
    const { data } = await db.from('business_usage' as never)
        .select('conversations')
        .eq('organization_id', organizationId)
        .eq('period_start', periodStart)
        .maybeSingle();
    return Number((data as { conversations?: number } | null)?.conversations ?? 0);
}

const PASS_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A paid 30-day pass: start the plan now with a fresh count of conversations.
 * Renewing the same plan before it runs out keeps the days that were left,
 * so paying early never loses time; a different plan starts its 30 days now.
 */
export function nextBusinessPeriod(current: OrganizationPlan, plan: PaidBusinessPlanId, now = Date.now()): { start: string; end: string } {
    const remaining = current.active && current.plan?.id === plan && current.periodEnd ? Math.max(0, Date.parse(current.periodEnd) - now) : 0;
    return { start: new Date(now).toISOString(), end: new Date(now + remaining + PASS_DAYS * DAY_MS).toISOString() };
}

export async function applyBusinessPass(db: Admin, organizationId: string, plan: PaidBusinessPlanId): Promise<{ start: string; end: string }> {
    const current = await getOrganizationPlan(db, organizationId);
    const period = nextBusinessPeriod(current, plan);
    const { error } = await db.from('organizations').update({
        account_type: 'business',
        business_plan: plan,
        business_plan_status: 'active',
        business_period_start: period.start,
        business_period_end: period.end,
    } as never).eq('id', organizationId);
    if (error) throw new Error(`Could not apply the ${plan} plan: ${error.message}`);
    return period;
}

/** Start a business organization's free trial (once). */
/** Credits every business gets once, with its trial: enough for setup and testing on the plan's model. */
export const BUSINESS_TRIAL_CREDITS_USD = 1;

/** Starts the trial; true only when this call started it (a repeat changes nothing). */
export async function startBusinessTrial(db: Admin, organizationId: string, now = Date.now()): Promise<boolean> {
    const { data, error } = await db.from('organizations').update({
        account_type: 'business',
        business_plan: 'trial',
        business_plan_status: 'active',
        business_period_start: new Date(now).toISOString(),
        business_period_end: new Date(now + BUSINESS_TRIAL_DAYS * DAY_MS).toISOString(),
    } as never).eq('id', organizationId).is('business_plan', null).select('id');
    if (error) throw new Error(`Could not start the trial: ${error.message}`);
    // The caller adds BUSINESS_TRIAL_CREDITS_USD when this is true (server-side: credits
    // can't be imported here, the pricing page uses this file in the browser).
    return (data ?? []).length > 0;
}
