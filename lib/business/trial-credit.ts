/**
 * The trial's welcome credit (BUSINESS_TRIAL_CREDITS_USD), given once per
 * business. Server-only: plans.ts is also read in the browser, credits isn't.
 *
 * Granted when the trial starts; `ensureTrialCredit` gives it again to a
 * business on the trial that never got it (the first grant failed), so a
 * failure there can't leave an owner without it.
 */

import { addCredits } from '@/lib/credits';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { BUSINESS_TRIAL_CREDITS_USD } from '@/lib/business/plans';

type Admin = ReturnType<typeof createAdminClient>;

const REASON = 'business_trial_welcome';

/** Gives the welcome credit; true when it landed. Failures are logged, never thrown. */
export async function grantTrialCredit(organizationId: string): Promise<boolean> {
    const granted = await addCredits(organizationId, BUSINESS_TRIAL_CREDITS_USD, 'adjustment', 'Free trial credit', { reason: REASON })
        .catch((error) => {
            console.error('[business] trial credit failed', organizationId, error);
            return false;
        });
    if (!granted) console.error('[business] trial credit not added', organizationId);
    return granted;
}

/** A business on the trial that has no welcome credit yet gets it now. */
export async function ensureTrialCredit(db: Admin, organizationId: string): Promise<void> {
    const { data: organization } = await db.from('organizations').select('account_type, business_plan').eq('id', organizationId).maybeSingle();
    if (organization?.account_type !== 'business' || organization.business_plan !== 'trial') return;
    const { data: given, error } = await db.from('credit_transactions').select('id').eq('organization_id', organizationId).eq('metadata->>reason', REASON).limit(1);
    // Unsure whether it was given: don't risk giving it twice.
    if (error || (given ?? []).length > 0) return;
    await grantTrialCredit(organizationId);
}
