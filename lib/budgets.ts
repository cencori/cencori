/**
 * Budget Management for Projects
 * 
 * Handles budget alerts and spend caps for AI Gateway usage.
 */

import { createAdminClient } from '@/lib/supabaseAdmin';

// Alert thresholds (percentage of budget)
const ALERT_THRESHOLDS = [50, 80, 100];

export interface BudgetStatus {
    currentSpend: number;
    monthlyBudget: number | null;
    spendCap: number | null;
    enforceSpendCap: boolean;
    percentUsed: number | null;
    isCapReached: boolean;
    alertsEnabled: boolean;
}

export interface BudgetCheckResult {
    allowed: boolean;
    reason?: string;
    status: BudgetStatus;
}

/**
 * Get the current month's date range
 */
function getCurrentMonthRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
}

/**
 * Get current month spend for a project
 */
export async function getCurrentMonthSpend(projectId: string): Promise<number> {
    const supabase = createAdminClient();
    const { start, end } = getCurrentMonthRange();

    const { data, error } = await supabase
        .from('ai_requests')
        .select('cencori_charge_usd')
        .eq('project_id', projectId)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString());

    if (error) {
        console.error('[Budget] Error fetching spend:', error);
        return 0;
    }

    return data?.reduce((sum, req) => sum + (req.cencori_charge_usd || 0), 0) || 0;
}

/**
 * Get budget status for a project
 */
export async function getBudgetStatus(projectId: string): Promise<BudgetStatus> {
    const supabase = createAdminClient();

    // Get project budget settings
    const { data: project, error } = await supabase
        .from('projects')
        .select('monthly_budget, spend_cap, enforce_spend_cap, budget_alerts_enabled')
        .eq('id', projectId)
        .single();

    if (error || !project) {
        console.error('[Budget] Error fetching project:', error);
        return {
            currentSpend: 0,
            monthlyBudget: null,
            spendCap: null,
            enforceSpendCap: false,
            percentUsed: null,
            isCapReached: false,
            alertsEnabled: true,
        };
    }

    const currentSpend = await getCurrentMonthSpend(projectId);
    const monthlyBudget = project.monthly_budget ? parseFloat(project.monthly_budget) : null;
    const spendCap = project.spend_cap ? parseFloat(project.spend_cap) : null;
    const enforceSpendCap = project.enforce_spend_cap || false;

    const percentUsed = monthlyBudget ? (currentSpend / monthlyBudget) * 100 : null;
    const isCapReached = enforceSpendCap && spendCap !== null && currentSpend >= spendCap;

    return {
        currentSpend,
        monthlyBudget,
        spendCap,
        enforceSpendCap,
        percentUsed,
        isCapReached,
        alertsEnabled: project.budget_alerts_enabled ?? true,
    };
}

/**
 * Check if a request is allowed based on spend cap
 */
export async function checkSpendCap(projectId: string): Promise<BudgetCheckResult> {
    const status = await getBudgetStatus(projectId);

    if (status.isCapReached) {
        return {
            allowed: false,
            reason: `Spend cap of $${status.spendCap?.toFixed(2)} reached. Current spend: $${status.currentSpend.toFixed(2)}`,
            status,
        };
    }

    return {
        allowed: true,
        status,
    };
}

/**
 * Check and send budget alerts if thresholds are crossed
 */
export async function checkAndSendBudgetAlerts(
    projectId: string,
    projectName: string,
    organizationId: string
): Promise<void> {
    const supabase = createAdminClient();
    const status = await getBudgetStatus(projectId);

    // Skip if no budget set or alerts disabled
    if (!status.monthlyBudget || !status.alertsEnabled || status.percentUsed === null) {
        return;
    }

    const { start } = getCurrentMonthRange();

    // Get already sent alerts for this period
    const { data: sentAlerts } = await supabase
        .from('budget_alerts')
        .select('threshold_percent')
        .eq('project_id', projectId)
        .gte('period_start', start.toISOString());

    const sentThresholds = new Set(sentAlerts?.map(a => a.threshold_percent) || []);

    // Find thresholds that should be triggered
    for (const threshold of ALERT_THRESHOLDS) {
        if (status.percentUsed >= threshold && !sentThresholds.has(threshold)) {
            await sendBudgetAlert(
                projectId,
                projectName,
                organizationId,
                threshold,
                status.currentSpend,
                status.monthlyBudget
            );
        }
    }
}

/**
 * Send a budget alert email
 */
async function sendBudgetAlert(
    projectId: string,
    projectName: string,
    organizationId: string,
    threshold: number,
    currentSpend: number,
    budget: number
): Promise<void> {
    const supabase = createAdminClient();
    const { start, end } = getCurrentMonthRange();

    // Get organization members to notify
    const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, profiles:user_id(email)')
        .eq('organization_id', organizationId)
        .in('role', ['owner', 'admin']);

    const emails = members
        ?.map((m) => (m.profiles as { email?: string })?.email)
        .filter((e): e is string => !!e) || [];

    if (emails.length === 0) {
        console.warn('[Budget] No emails found for organization:', organizationId);
        return;
    }

    // Record the alert
    await supabase.from('budget_alerts').insert({
        project_id: projectId,
        threshold_percent: threshold,
        current_spend: currentSpend,
        budget_amount: budget,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        sent_to: emails,
    });

    // Send email via internal API
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/budget-alert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: emails,
                projectName,
                threshold,
                currentSpend,
                budget,
                percentUsed: (currentSpend / budget) * 100,
            }),
        });

        if (!response.ok) {
            console.error('[Budget] Failed to send alert email:', await response.text());
        } else {
            console.log(`[Budget] Alert sent for ${projectName}: ${threshold}% threshold (${currentSpend.toFixed(2)}/${budget.toFixed(2)})`);
        }
    } catch (error) {
        console.error('[Budget] Error sending alert email:', error);
    }
}

/**
 * Update project budget settings
 */
export async function updateBudgetSettings(
    projectId: string,
    settings: {
        monthlyBudget?: number | null;
        spendCap?: number | null;
        enforceSpendCap?: boolean;
        alertsEnabled?: boolean;
    }
): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();

    const updateData: Record<string, unknown> = {};

    if (settings.monthlyBudget !== undefined) {
        updateData.monthly_budget = settings.monthlyBudget;
    }
    if (settings.spendCap !== undefined) {
        updateData.spend_cap = settings.spendCap;
    }
    if (settings.enforceSpendCap !== undefined) {
        updateData.enforce_spend_cap = settings.enforceSpendCap;
    }
    if (settings.alertsEnabled !== undefined) {
        updateData.budget_alerts_enabled = settings.alertsEnabled;
    }

    const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId);

    if (error) {
        console.error('[Budget] Error updating settings:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}
