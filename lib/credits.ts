/**
 * Credits Management System
 * 
 * Handles prepaid credits for multi-model AI usage
 */

import { createAdminClient } from './supabaseAdmin';
import { getCachedCreditsBalance, setCachedCreditsBalance, invalidateCreditsBalance } from './config-cache';

/**
 * Get organization's current credits balance
 * Tries Redis cache first for sub-1ms performance on hot paths.
 */
export async function getCreditsBalance(organizationId: string): Promise<number> {
    // 1. Try cache first
    const cached = await getCachedCreditsBalance(organizationId);
    if (cached !== null) {
        return cached;
    }

    // 2. Fallback to DB
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('organizations')
        .select('credits_balance')
        .eq('id', organizationId)
        .single();

    if (error || !data) {
        console.error('[Credits] Error fetching balance:', error);
        return 0;
    }

    const balance = parseFloat(data.credits_balance) || 0;

    // 3. Seed cache for next time, without making this request wait on the write.
    void setCachedCreditsBalance(organizationId, balance).catch(() => {});

    return balance;
}

/**
 * The balance as the gateway's credit gate reads it. Every charge clears the cached balance, so a
 * busy org paid a Redis miss, a database read and a Redis write before each request. While the
 * balance is comfortably positive the answer to "may this request run?" can't change in a few
 * seconds, so the last read is reused briefly; near or below zero it is always read fresh. A
 * request let through on a slightly stale balance is still charged in full (charges may go into
 * debt, which blocks the next request).
 */
const GATE_REUSE_MS = 10_000;
const GATE_REUSE_MIN_BALANCE_USD = 1;
const gateBalances = new Map<string, { balance: number; at: number }>();

export async function getCreditsBalanceForGate(organizationId: string): Promise<number> {
    const recent = gateBalances.get(organizationId);
    if (recent && recent.balance >= GATE_REUSE_MIN_BALANCE_USD && Date.now() - recent.at < GATE_REUSE_MS) {
        return recent.balance;
    }
    const balance = await getCreditsBalance(organizationId);
    gateBalances.set(organizationId, { balance, at: Date.now() });
    if (gateBalances.size > 10_000) {
        const oldest = gateBalances.keys().next().value;
        if (oldest !== undefined) gateBalances.delete(oldest);
    }
    return balance;
}

/**
 * Below this, an organization is out of credits and metered requests are
 * refused. Not zero: a balance can strand at a fraction of a cent (every
 * charge is larger than it), and a strictly-positive check let that serve
 * requests for free indefinitely.
 */
export const MIN_SERVABLE_CREDIT_BALANCE_USD = 0.01;

export function isCreditBalanceExhausted(balance: number): boolean {
    return !(balance >= MIN_SERVABLE_CREDIT_BALANCE_USD);
}

/**
 * Check if organization has insufficient credits for a request
 */
export async function hasInsufficientCredits(
    organizationId: string,
    estimatedCost: number
): Promise<boolean> {
    const balance = await getCreditsBalance(organizationId);
    return balance < estimatedCost;
}

/**
 * Deduct credits from organization balance
 * Logs the transaction and updates balance atomically via RPC.
 * Updates Redis cache on success.
 */
export async function deductCredits(
    organizationId: string,
    amount: number,
    description: string,
    referenceId?: string
): Promise<boolean> {
    if (!(amount > 0)) {
        return true;
    }

    return applyCreditDelta(
        organizationId,
        -amount,
        'usage',
        description,
        referenceId
    );
}

/**
 * Add credits to organization balance
 * Used for top-ups and refunds
 */
export async function addCredits(
    organizationId: string,
    amount: number,
    transactionType: 'topup' | 'refund' | 'adjustment',
    description: string,
    metadata?: Record<string, unknown>
): Promise<boolean> {
    if (!(amount > 0)) {
        return false;
    }

    return applyCreditDelta(
        organizationId,
        amount,
        transactionType,
        description,
        undefined,
        metadata
    );
}

/**
 * Apply manual credit adjustment/refund.
 * Positive amount credits the wallet, negative amount debits it.
 */
export async function adjustCredits(
    organizationId: string,
    amount: number,
    transactionType: 'refund' | 'adjustment',
    description: string,
    metadata?: Record<string, unknown>
): Promise<boolean> {
    if (!amount || !Number.isFinite(amount)) {
        return false;
    }

    return applyCreditDelta(
        organizationId,
        amount,
        transactionType,
        description,
        undefined,
        metadata
    );
}

/**
 * Fallback for the old all-or-nothing deduction: charge whatever balance is
 * left (read fresh, not from cache) so it reaches zero and the gateway blocks
 * the next request. The unpaid remainder is logged.
 */
async function drainRemainingBalance(
    organizationId: string,
    attemptedAmount: number,
    description: string,
    referenceId?: string,
): Promise<void> {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from('organizations')
        .select('credits_balance')
        .eq('id', organizationId)
        .single();
    const remaining = Number(data?.credits_balance) || 0;
    if (!(remaining > 0)) return;
    const { error } = await supabase.rpc('deduct_organization_credits', {
        p_org_id: organizationId,
        p_amount: remaining,
        p_description: `${description} (balance exhausted; $${(attemptedAmount - remaining).toFixed(6)} unbilled)`,
        p_reference_id: referenceId,
        p_metadata: { partial: true, attempted_usd: attemptedAmount },
    });
    if (error) console.error('[Credits] Failed to drain remaining balance:', error);
    console.warn(`[Credits] Org ${organizationId} exhausted: charged remaining $${remaining} of $${attemptedAmount}.`);
}

async function applyCreditDelta(
    organizationId: string,
    delta: number,
    transactionType: 'topup' | 'usage' | 'refund' | 'adjustment',
    description: string,
    referenceId?: string,
    metadata?: Record<string, unknown>
): Promise<boolean> {
    const supabase = createAdminClient();

    if (transactionType === 'usage' && delta < 0) {
        const amount = Math.abs(delta);

        // Usage is charged after the request was served, so it must always be
        // recorded in full. charge_organization_credits takes the balance
        // negative by any shortfall (debt that blocks the next request and is
        // repaid by the next top-up) instead of refusing the charge.
        const { data: chargeData, error: chargeError } = await supabase.rpc('charge_organization_credits', {
            p_org_id: organizationId,
            p_amount: amount,
            p_description: description,
            p_reference_id: referenceId ?? null,
            p_metadata: metadata || {},
        });

        if (!chargeError) {
            const charged = (Array.isArray(chargeData) ? chargeData[0] : chargeData) as {
                success?: boolean; shortfall?: number; error_message?: string;
            } | null;
            await invalidateCreditsBalance(organizationId);
            if (!charged?.success) {
                console.warn(`[Credits] Charge failed for org ${organizationId}: ${charged?.error_message}`);
                return false;
            }
            if (Number(charged.shortfall) > 0) {
                console.warn(`[Credits] Org ${organizationId} went into debt by $${charged.shortfall}; next request will be blocked until top-up.`);
            }
            return true;
        }

        // PGRST202 / 42883: the new function isn't deployed yet. Fall back to
        // the old all-or-nothing deduction below.
        if (chargeError.code !== 'PGRST202' && chargeError.code !== '42883') {
            console.error('[Credits] RPC Error charging credits:', chargeError);
            return false;
        }

        const { data, error } = await supabase.rpc('deduct_organization_credits', {
            p_org_id: organizationId,
            p_amount: amount,
            p_description: description,
            p_reference_id: referenceId,
            p_metadata: metadata || {}
        });

        if (error) {
            console.error('[Credits] RPC Error deducting credits:', error);
            return false;
        }

        // The RPC returns a table/array in some Supabase client versions
        const resultData = Array.isArray(data) ? data[0] : data;
        const result = resultData as unknown as { success: boolean, new_balance: number, error_message: string };

        if (!result.success) {
            console.warn(`[Credits] Deduction failed: ${result.error_message}`);
            if (result.error_message === 'Insufficient balance') {
                // The old function refuses a charge bigger than the balance,
                // leaving the balance untouched, so every later request would
                // pass the balance check and go unbilled. Drain what's left to
                // zero so the next request is blocked.
                await drainRemainingBalance(organizationId, amount, description, referenceId);
                await invalidateCreditsBalance(organizationId);
            }
            return false;
        }

        // Concurrent RPCs can return out of order. Writing each returned value
        // to cache can resurrect an older, higher balance after a newer debit.
        await invalidateCreditsBalance(organizationId);
        return true;
    }

    // For top-ups and adjustments, we still use the manual path for now, 
    // but we invalidate the cache to ensure the next read is fresh.
    try {
        const currentBalance = await getCreditsBalance(organizationId);
        const newBalance = currentBalance + delta;

        // Only a deduction can be refused for going negative. A top-up must
        // always land, even if it leaves the org still in debt from usage.
        if (delta < 0 && newBalance < 0) {
            console.warn(`[Credits] Insufficient balance for org ${organizationId}`);
            return false;
        }

        const { error: updateError } = await supabase
            .from('organizations')
            .update({
                credits_balance: newBalance,
                credits_updated_at: new Date().toISOString(),
            })
            .eq('id', organizationId);

        if (updateError) {
            console.error('[Credits] Error updating balance:', updateError);
            return false;
        }

        const { error: logError } = await supabase
            .from('credit_transactions')
            .insert({
                organization_id: organizationId,
                amount: delta,
                transaction_type: transactionType,
                description,
                reference_id: referenceId,
                balance_before: currentBalance,
                balance_after: newBalance,
                metadata,
            });

        if (logError) {
            console.error('[Credits] Error logging transaction:', logError);
        }

        // Invalidate cache so the next request gets the new balance from DB
        await invalidateCreditsBalance(organizationId);
        return true;
    } catch (error) {
        console.error('[Credits] Unexpected error applying credit delta:', error);
        return false;
    }
}

/**
 * Get credit transaction history for an organization
 */
export async function getCreditTransactions(
    organizationId: string,
    limit = 50
): Promise<Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: string;
}>> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error || !data) {
        console.error('[Credits] Error fetching transactions:', error);
        return [];
    }

    return data.map(tx => ({
        id: tx.id,
        amount: parseFloat(tx.amount),
        type: tx.transaction_type,
        description: tx.description || '',
        balanceBefore: parseFloat(tx.balance_before),
        balanceAfter: parseFloat(tx.balance_after),
        createdAt: tx.created_at,
    }));
}
