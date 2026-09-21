import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export interface SpendBudget {
    max_spend_usd: number;
    window_days?: number;
}

function parseBudget(raw: unknown): SpendBudget | null {
    if (!raw || typeof raw !== 'object') return null;
    const max = (raw as { max_spend_usd?: unknown }).max_spend_usd;
    if (typeof max !== 'number' || !(max > 0)) return null;
    const windowDays = (raw as { window_days?: unknown }).window_days;
    return { max_spend_usd: max, window_days: typeof windowDays === 'number' && windowDays > 0 ? windowDays : 30 };
}

async function spendSince(supabase: Admin, filters: { projectId: string; tenantId?: string | null; installationId?: string | null; agentId?: string | null; since: string }): Promise<number> {
    let query = supabase.from('ai_requests').select('cencori_charge_usd').eq('project_id', filters.projectId).gte('created_at', filters.since);
    if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId) as typeof query;
    if (filters.installationId) query = query.eq('installation_id', filters.installationId) as typeof query;
    if (filters.agentId) query = query.eq('agent_id', filters.agentId) as typeof query;
    const { data } = await query;
    return ((data ?? []) as Array<{ cencori_charge_usd: number | null }>).reduce((n, r) => n + Number(r.cencori_charge_usd ?? 0), 0);
}

export interface BudgetDecision {
    ok: boolean;
    scope?: 'tenant' | 'installation' | 'agent';
    spent?: number;
    budget?: number;
}

/**
 * Enforce tenant/installation/agent spend budgets before enqueueing runs.
 * Budgets live on installations (`budget: {max_spend_usd, window_days}`) and
 * tenants (`metadata.budget`). Turns are metered, not gated (latency); runs
 * and delegations — the spend-heavy paths — are gated here.
 */
export async function checkSpendBudgets(
    supabase: Admin,
    opts: { projectId: string; tenantId: string | null; installationId: string | null; agentId: string | null },
): Promise<BudgetDecision> {
    // Installation budget (most specific wins, checked first).
    if (opts.installationId) {
        const { data: ins } = await supabase.from('agent_installations').select('budget').eq('id', opts.installationId).maybeSingle();
        const budget = parseBudget((ins as { budget?: unknown } | null)?.budget);
        if (budget) {
            const since = new Date(Date.now() - budget.window_days! * 86400 * 1000).toISOString();
            const spent = await spendSince(supabase, { projectId: opts.projectId, installationId: opts.installationId, since });
            if (spent >= budget.max_spend_usd) {
                return { ok: false, scope: 'installation', spent, budget: budget.max_spend_usd };
            }
        }
    }
    if (opts.tenantId) {
        const { data: tenant } = await supabase.from('platform_tenants').select('metadata').eq('id', opts.tenantId).maybeSingle();
        const budget = parseBudget((tenant as { metadata?: Record<string, unknown> } | null)?.metadata?.budget);
        if (budget) {
            const since = new Date(Date.now() - budget.window_days! * 86400 * 1000).toISOString();
            const spent = await spendSince(supabase, { projectId: opts.projectId, tenantId: opts.tenantId, since });
            if (spent >= budget.max_spend_usd) {
                return { ok: false, scope: 'tenant', spent, budget: budget.max_spend_usd };
            }
        }
    }
    return { ok: true };
}
