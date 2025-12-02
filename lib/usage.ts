/**
 * Usage Management Utilities
 * 
 * Functions for managing monthly usage tracking and resets
 */

import { createAdminClient } from './supabaseAdmin';

/**
 * Reset monthly usage counters for all organizations
 * Should be called on the 1st of each month via cron job
 */
export async function resetMonthlyUsage(): Promise<{ success: boolean; count: number; error?: string }> {
    const supabase = createAdminClient();

    try {
        const { data, error } = await supabase
            .from('organizations')
            .update({ monthly_requests_used: 0 })
            .neq('id', '00000000-0000-0000-0000-000000000000') // Reset all orgs
            .select('id');

        if (error) {
            console.error('[Usage Reset] Failed:', error);
            return { success: false, count: 0, error: error.message };
        }

        const count = data?.length || 0;
        console.log(`[Usage Reset] ✓ Reset ${count} organization usage counters`);

        return { success: true, count };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Usage Reset] Unexpected error:', error);
        return { success: false, count: 0, error: message };
    }
}

/**
 * Check if an organization is approaching their limit (>= 80%)
 */
export async function checkUsageAlerts(organizationId: string): Promise<{
    isNearLimit: boolean;
    isAtLimit: boolean;
    usage: number;
    limit: number;
    percentage: number;
}> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('organizations')
        .select('monthly_requests_used, monthly_request_limit')
        .eq('id', organizationId)
        .single();

    if (error || !data) {
        return { isNearLimit: false, isAtLimit: false, usage: 0, limit: 0, percentage: 0 };
    }

    const usage = data.monthly_requests_used || 0;
    const limit = data.monthly_request_limit || 1000;
    const percentage = Math.round((usage / limit) * 100);

    return {
        isNearLimit: percentage >= 80,
        isAtLimit: percentage >= 100,
        usage,
        limit,
        percentage
    };
}
