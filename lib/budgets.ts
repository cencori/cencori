/**
 * Budget Management for Projects
 *
 * Handles budget alerts and spend caps for AI Gateway usage.
 * Uses Redis for fast per-request spend cap checks, with DB as fallback.
 */

import { createAdminClient } from '@/lib/supabaseAdmin';
import { triggerCostThresholdWebhook } from '@/lib/webhooks/trigger';
import { Redis } from '@upstash/redis';

let redis: Redis | null | undefined;

function getRedisClient(): Redis | null {
    if (redis !== undefined) return redis;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) { redis = null; return null; }
    redis = new Redis({ url, token });
    return redis;
}

function getSpendMonthKey(projectId: string): string {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `spend:${projectId}:${month}`;
}

function getSpendCapConfigKey(projectId: string): string {
    return `cfg:spend_cap:${projectId}`;
}

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
 * Get current month spend for a project.
 * Uses Redis counter first (fast), falls back to DB aggregate (slow).
 */
export async function getCurrentMonthSpend(projectId: string): Promise<number> {
    // Try Redis counter first (~10ms)
    const client = getRedisClient();
    if (client) {
        try {
            const cached = await client.get<string>(getSpendMonthKey(projectId));
            if (cached !== null && cached !== undefined) {
                return parseFloat(String(cached)) || 0;
            }
        } catch {
            // Fall through to DB
        }
    }

    // DB fallback — only on cold start or Redis miss
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

    const total = data?.reduce((sum, req) => sum + (req.cencori_charge_usd || 0), 0) || 0;

    // Seed Redis so subsequent requests are fast
    if (client) {
        try {
            // Set with TTL = seconds until end of month + 1 day buffer
            const ttl = Math.max(60, Math.ceil((end.getTime() - Date.now()) / 1000) + 86400);
            await client.set(getSpendMonthKey(projectId), String(total), { ex: ttl });
        } catch {
            // Non-critical
        }
    }

    return total;
}

/**
 * Increment the running spend counter after a successful request.
 * Fire-and-forget — never blocks the response.
 */
export function incrementSpendCounter(projectId: string, costUsd: number): void {
    if (!(costUsd > 0)) return;
    const client = getRedisClient();
    if (!client) return;

    const key = getSpendMonthKey(projectId);
    // INCRBYFLOAT is atomic — safe for concurrent requests
    client.incrbyfloat(key, costUsd).catch((err) => {
        console.error('[Budget] Failed to increment spend counter:', err);
    });
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
 * Fast spend cap check using Redis-cached config and spend counter.
 * Falls back to full DB path if Redis is unavailable.
 */
export async function checkSpendCap(projectId: string): Promise<BudgetCheckResult> {
    const client = getRedisClient();

    // Fast path: check Redis-cached config + spend counter (~20ms total)
    if (client) {
        try {
            const configKey = getSpendCapConfigKey(projectId);
            const [cachedConfig, cachedSpend] = await Promise.all([
                client.get<{ spendCap: number | null; enforce: boolean }>(configKey),
                client.get<string>(getSpendMonthKey(projectId)),
            ]);

            if (cachedConfig !== null) {
                const currentSpend = cachedSpend !== null ? (parseFloat(String(cachedSpend)) || 0) : 0;
                const isCapReached = cachedConfig.enforce && cachedConfig.spendCap !== null && currentSpend >= cachedConfig.spendCap;

                if (isCapReached) {
                    return {
                        allowed: false,
                        reason: `Spend cap of $${cachedConfig.spendCap?.toFixed(2)} reached. Current spend: $${currentSpend.toFixed(2)}`,
                        status: {
                            currentSpend,
                            monthlyBudget: null,
                            spendCap: cachedConfig.spendCap,
                            enforceSpendCap: cachedConfig.enforce,
                            percentUsed: null,
                            isCapReached: true,
                            alertsEnabled: true,
                        },
                    };
                }

                return {
                    allowed: true,
                    status: {
                        currentSpend,
                        monthlyBudget: null,
                        spendCap: cachedConfig.spendCap,
                        enforceSpendCap: cachedConfig.enforce,
                        percentUsed: null,
                        isCapReached: false,
                        alertsEnabled: true,
                    },
                };
            }
        } catch {
            // Fall through to DB path
        }
    }

    // Slow path: full DB query (only on cold start)
    const status = await getBudgetStatus(projectId);

    // Cache the config for fast checks next time
    if (client) {
        try {
            await client.set(getSpendCapConfigKey(projectId), {
                spendCap: status.spendCap,
                enforce: status.enforceSpendCap,
            }, { ex: 300 }); // 5 min TTL
        } catch {
            // Non-critical
        }
    }

    if (status.isCapReached) {
        return {
            allowed: false,
            reason: `Spend cap of $${status.spendCap?.toFixed(2)} reached. Current spend: $${status.currentSpend.toFixed(2)}`,
            status,
        };
    }

    return { allowed: true, status };
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

    const percentUsed = (currentSpend / budget) * 100;

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
                percentUsed,
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

    // Trigger cost.threshold webhook
    void triggerCostThresholdWebhook(projectId, {
        threshold_percent: threshold,
        current_spend: currentSpend,
        monthly_budget: budget,
        percent_used: percentUsed,
        is_cap_reached: threshold >= 100,
    });

    // Send Slack/Discord notifications if configured
    void sendSlackDiscordBudgetAlert(projectId, projectName, threshold, currentSpend, budget, percentUsed);
}

/**
 * Send budget alert to Slack/Discord webhooks configured on the project
 */
async function sendSlackDiscordBudgetAlert(
    projectId: string,
    projectName: string,
    threshold: number,
    currentSpend: number,
    budget: number,
    percentUsed: number,
): Promise<void> {
    const supabase = createAdminClient();

    // Check for Slack/Discord webhook URLs in project settings
    const { data: project } = await supabase
        .from('projects')
        .select('slack_webhook_url, discord_webhook_url')
        .eq('id', projectId)
        .single();

    if (!project) return;

    const isOverBudget = threshold >= 100;
    const emoji = isOverBudget ? '🚨' : threshold >= 80 ? '⚠️' : '📊';
    const title = isOverBudget
        ? `Budget exceeded for ${projectName}`
        : `Budget alert: ${projectName} at ${threshold}%`;

    // Slack
    if (project.slack_webhook_url) {
        try {
            await fetch(project.slack_webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `${emoji} *${title}*`,
                    blocks: [
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: `${emoji} *${title}*\n\n*Current spend:* $${currentSpend.toFixed(2)}\n*Monthly budget:* $${budget.toFixed(2)}\n*Usage:* ${Math.round(percentUsed)}%`,
                            },
                        },
                    ],
                }),
                signal: AbortSignal.timeout(5000),
            });
        } catch (error) {
            console.error('[Budget] Slack notification failed:', error);
        }
    }

    // Discord
    if (project.discord_webhook_url) {
        try {
            await fetch(project.discord_webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: `${emoji} ${title}`,
                        color: isOverBudget ? 0xDC2626 : threshold >= 80 ? 0xF59E0B : 0x3B82F6,
                        fields: [
                            { name: 'Current Spend', value: `$${currentSpend.toFixed(2)}`, inline: true },
                            { name: 'Monthly Budget', value: `$${budget.toFixed(2)}`, inline: true },
                            { name: 'Usage', value: `${Math.round(percentUsed)}%`, inline: true },
                        ],
                        timestamp: new Date().toISOString(),
                    }],
                }),
                signal: AbortSignal.timeout(5000),
            });
        } catch (error) {
            console.error('[Budget] Discord notification failed:', error);
        }
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
