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
    let spent = 0;
    // PostgREST caps a single result page. Sum every page or large tenants
    // would silently spend past their configured limits after 1,000 requests.
    for (let offset = 0; ; offset += 1000) {
        let query = supabase.from('ai_requests').select('cencori_charge_usd, metadata').eq('project_id', filters.projectId).gte('created_at', filters.since);
        if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId) as typeof query;
        if (filters.installationId) query = query.eq('installation_id', filters.installationId) as typeof query;
        if (filters.agentId) query = query.eq('agent_id', filters.agentId) as typeof query;
        const { data, error } = await query.order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 999);
        if (error) throw new Error(`Unable to verify spend budget: ${error.message}`);
        const rows = (data ?? []) as Array<{ cencori_charge_usd: number | null; metadata?: { billing_reconciliation_required?: boolean } }>;
        if (rows.some((r) => r.metadata?.billing_reconciliation_required === true)) {
            throw new Error('Spend budget has an unresolved provider charge; reconcile it before more runs');
        }
        spent += rows.reduce((n, r) => n + Number(r.cencori_charge_usd ?? 0), 0);
        if (rows.length < 1000) break;
    }
    let unresolved = supabase.from('embedded_runs').select('id', { count: 'exact', head: true })
        .eq('project_id', filters.projectId).gte('created_at', filters.since).like('error', 'billing_reconciliation_required:%');
    if (filters.tenantId) unresolved = unresolved.eq('tenant_id', filters.tenantId) as typeof unresolved;
    if (filters.installationId) unresolved = unresolved.eq('installation_id', filters.installationId) as typeof unresolved;
    if (filters.agentId) unresolved = unresolved.eq('agent_id', filters.agentId) as typeof unresolved;
    const { count: unresolvedCount, error: unresolvedError } = await unresolved;
    if (unresolvedError) throw new Error(`Unable to verify unresolved charges: ${unresolvedError.message}`);
    if ((unresolvedCount ?? 0) > 0) throw new Error('Spend budget has an unresolved provider charge; reconcile it before more runs');
    return spent;
}

export interface BudgetDecision {
    ok: boolean;
    scope?: 'tenant' | 'installation' | 'agent';
    spent?: number;
    budget?: number;
}

/**
 * Enforce tenant and installation spend budgets before enqueueing runs.
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
        const { data: ins, error } = await supabase.from('agent_installations').select('budget').eq('project_id', opts.projectId).eq('id', opts.installationId).maybeSingle();
        if (error || !ins) throw new Error(`Unable to verify installation budget: ${error?.message ?? 'installation missing'}`);
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
        const { data: tenant, error } = await supabase.from('platform_tenants').select('metadata').eq('project_id', opts.projectId).eq('id', opts.tenantId).maybeSingle();
        if (error || !tenant) throw new Error(`Unable to verify tenant budget: ${error?.message ?? 'tenant missing'}`);
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
