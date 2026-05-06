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
    
    // 3. Seed cache for next time
    await setCachedCreditsBalance(organizationId, balance);
    
    return balance;
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

async function applyCreditDelta(
    organizationId: string,
    delta: number,
    transactionType: 'topup' | 'usage' | 'refund' | 'adjustment',
    description: string,
    referenceId?: string,
    metadata?: Record<string, unknown>
): Promise<boolean> {
    const supabase = createAdminClient();

    // Use the atomic RPC for usage-based deductions to prevent race conditions
    if (transactionType === 'usage' && delta < 0) {
        const amount = Math.abs(delta);
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
            // If it failed due to insufficient funds, update cache to reflect reality
            if (result.error_message === 'Insufficient balance') {
                await setCachedCreditsBalance(organizationId, result.new_balance);
            }
            return false;
        }

        // SUCCESS: Update Redis cache with the exact balance returned by the DB
        await setCachedCreditsBalance(organizationId, result.new_balance);
        return true;
    }

    // For top-ups and adjustments, we still use the manual path for now, 
    // but we invalidate the cache to ensure the next read is fresh.
    try {
        const currentBalance = await getCreditsBalance(organizationId);
        const newBalance = currentBalance + delta;

        if (newBalance < 0) {
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
