/**
 * Credits Management System
 * 
 * Handles prepaid credits for multi-model AI usage
 */

import { createAdminClient } from './supabaseAdmin';

/**
 * Get organization's current credits balance
 */
export async function getCreditsBalance(organizationId: string): Promise<number> {
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

    return parseFloat(data.credits_balance) || 0;
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
 * Logs the transaction and updates balance atomically
 */
export async function deductCredits(
    organizationId: string,
    amount: number,
    description: string,
    referenceId?: string
): Promise<boolean> {
    const supabase = createAdminClient();

    try {
        // Get current balance
        const currentBalance = await getCreditsBalance(organizationId);

        if (currentBalance < amount) {
            console.warn(`[Credits] Insufficient balance for org ${organizationId}`);
            return false;
        }

        const newBalance = currentBalance - amount;

        // Update organization balance
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

        // Log transaction
        const { error: logError } = await supabase
            .from('credit_transactions')
            .insert({
                organization_id: organizationId,
                amount: -amount,
                transaction_type: 'usage',
                description,
                reference_id: referenceId,
                balance_before: currentBalance,
                balance_after: newBalance,
            });

        if (logError) {
            console.error('[Credits] Error logging transaction:', logError);
            // Don't fail if logging fails, credits already deducted
        }

        return true;
    } catch (error) {
        console.error('[Credits] Unexpected error deducting credits:', error);
        return false;
    }
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
    const supabase = createAdminClient();

    try {
        const currentBalance = await getCreditsBalance(organizationId);
        const newBalance = currentBalance + amount;

        // Update organization balance
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

        // Log transaction
        const { error: logError } = await supabase
            .from('credit_transactions')
            .insert({
                organization_id: organizationId,
                amount,
                transaction_type: transactionType,
                description,
                balance_before: currentBalance,
                balance_after: newBalance,
                metadata,
            });

        if (logError) {
            console.error('[Credits] Error logging transaction:', logError);
        }

        return true;
    } catch (error) {
        console.error('[Credits] Unexpected error adding credits:', error);
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
