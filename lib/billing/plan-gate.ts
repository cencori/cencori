import 'server-only';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { planPausedBody, planState, type PlanState } from './plan-state';

const PLAN_COLUMNS = 'subscription_tier, subscription_status, subscription_current_period_start, subscription_current_period_end, billing_provider, account_type';

/**
 * The plan standing of an org, for paths that don't go through the gateway's
 * API-key check (browser client tokens, the website widget). Fails open on a
 * read error: a database hiccup shouldn't pause a paying customer.
 */
export async function orgPlanState(organizationId: string | null | undefined, admin = createAdminClient()): Promise<PlanState | null> {
    if (!organizationId) return null;
    const { data, error } = await admin.from('organizations').select(PLAN_COLUMNS).eq('id', organizationId).maybeSingle();
    if (error || !data) return null;
    const free = ((data as { subscription_tier?: string | null }).subscription_tier ?? 'free') === 'free';
    return planState({ ...data, requires_pro: free ? await orgRequiresPro(organizationId, admin) : false });
}

// requires_pro is read on its own, and a read error (e.g. the column isn't on
// this database yet) means "not required": the rule must never take a working
// org down. Memoized for a minute, like the rest of the gateway's org config.
const REQUIRES_PRO_MEMO_MS = 60_000;
const requiresProMemo = new Map<string, { value: boolean; at: number }>();

export async function orgRequiresPro(organizationId: string, admin = createAdminClient()): Promise<boolean> {
    const hit = requiresProMemo.get(organizationId);
    if (hit && Date.now() - hit.at < REQUIRES_PRO_MEMO_MS) return hit.value;
    let value = false;
    try {
        const { data, error } = await admin.from('organizations').select('requires_pro').eq('id', organizationId).maybeSingle();
        value = !error && (data as { requires_pro?: boolean } | null)?.requires_pro === true;
    } catch {
        value = false;
    }
    requiresProMemo.set(organizationId, { value, at: Date.now() });
    return value;
}

/** The 402 body when an org is paused, or null when it may proceed. */
export async function pausedPlanBody(organizationId: string | null | undefined, admin = createAdminClient()) {
    const state = await orgPlanState(organizationId, admin);
    return state?.standing === 'paused' ? planPausedBody(state) : null;
}
