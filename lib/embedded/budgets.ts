import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export interface SpendBudget {
    max_spend_usd: number;
    window_days?: number;
    /**
     * Accounting window. `rolling` (default) looks back window_days;
     * `calendar_month` bounds to the current calendar month in `timezone`.
     */
    window?: 'rolling' | 'calendar_month';
    timezone?: string;
    /**
     * Breach action. `pause` (default) disables the breached scope so no
     * new work is admitted; `alert` only refuses the current request.
     */
    action?: 'pause' | 'alert';
}

function parseBudget(raw: unknown): SpendBudget | null {
    if (!raw || typeof raw !== 'object') return null;
    const max = (raw as { max_spend_usd?: unknown }).max_spend_usd;
    if (typeof max !== 'number' || !(max > 0)) return null;
    const windowDays = (raw as { window_days?: unknown }).window_days;
    const window = (raw as { window?: unknown }).window;
    const timezone = (raw as { timezone?: unknown }).timezone;
    const action = (raw as { action?: unknown }).action;
    return {
        max_spend_usd: max,
        window_days: typeof windowDays === 'number' && windowDays > 0 ? windowDays : 30,
        window: window === 'calendar_month' ? 'calendar_month' : 'rolling',
        timezone: typeof timezone === 'string' && timezone ? timezone : 'UTC',
        action: action === 'alert' ? 'alert' : 'pause',
    };
}

/** Start of the current calendar month in the budget's timezone. */
export function calendarMonthStart(timezone: string, nowMs = Date.now()): string {
    const wallParts = (t: number) => {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }).formatToParts(new Date(t));
        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '01';
        const hour = Number(get('hour')) === 24 ? 0 : Number(get('hour'));
        return Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')), hour, Number(get('minute')), Number(get('second')));
    };
    try {
        const head = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(nowMs));
        const year = Number(head.find((p) => p.type === 'year')?.value);
        const month = Number(head.find((p) => p.type === 'month')?.value);
        if (!Number.isFinite(year) || !Number.isFinite(month)) throw new Error('bad zone');
        // Interpret month-start wall time in the zone: naive UTC guess minus
        // the zone offset measured there (two passes for DST edges).
        let guess = Date.UTC(year, month - 1, 1);
        for (let i = 0; i < 2; i++) guess = Date.UTC(year, month - 1, 1) - (wallParts(guess) - guess);
        return new Date(guess).toISOString();
    } catch {
        return new Date(Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), 1)).toISOString();
    }
}

function windowStart(budget: SpendBudget, nowMs = Date.now()): string {
    if (budget.window === 'calendar_month') return calendarMonthStart(budget.timezone ?? 'UTC', nowMs);
    return new Date(nowMs - (budget.window_days ?? 30) * 86400 * 1000).toISOString();
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
    /** Breach action from the budget definition (default pause). */
    action?: 'pause' | 'alert';
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
            const spent = await spendSince(supabase, { projectId: opts.projectId, installationId: opts.installationId, since: windowStart(budget) });
            if (spent >= budget.max_spend_usd) {
                return { ok: false, scope: 'installation', spent, budget: budget.max_spend_usd, action: budget.action ?? 'pause' };
            }
        }
    }
    if (opts.tenantId) {
        const { data: tenant, error } = await supabase.from('platform_tenants').select('metadata').eq('project_id', opts.projectId).eq('id', opts.tenantId).maybeSingle();
        if (error || !tenant) throw new Error(`Unable to verify tenant budget: ${error?.message ?? 'tenant missing'}`);
        const budget = parseBudget((tenant as { metadata?: Record<string, unknown> } | null)?.metadata?.budget);
        if (budget) {
            const spent = await spendSince(supabase, { projectId: opts.projectId, tenantId: opts.tenantId, since: windowStart(budget) });
            if (spent >= budget.max_spend_usd) {
                return { ok: false, scope: 'tenant', spent, budget: budget.max_spend_usd, action: budget.action ?? 'pause' };
            }
        }
    }
    return { ok: true };
}

/**
 * Pause action for a breached scope: disable the installation (or suspend
 * the tenant) so no new work is admitted anywhere, then record why.
 * Best-effort and idempotent — the admission refusal itself is what
 * enforces the budget; this stops the next request too.
 */export async function pauseBreachedScope(
    supabase: Admin,
    opts: { projectId: string; tenantId: string | null; installationId: string | null; scope: 'tenant' | 'installation'; spent: number; budget: number },
): Promise<void> {
    try {
        if (opts.scope === 'installation' && opts.installationId) {
            await supabase.from('agent_installations').update({ status: 'disabled' }).eq('project_id', opts.projectId).eq('id', opts.installationId).eq('status', 'active');
        } else if (opts.scope === 'tenant' && opts.tenantId) {
            await supabase.from('platform_tenants').update({ status: 'suspended' }).eq('project_id', opts.projectId).eq('id', opts.tenantId).eq('status', 'active');
        } else {
            return;
        }
        const { emitEmbeddedEvent } = await import('./runs');
        await emitEmbeddedEvent(opts.projectId, 'budget.pause', {
            scope: opts.scope,
            tenant_id: opts.tenantId,
            installation_id: opts.installationId,
            spent: opts.spent,
            budget: opts.budget,
        });
    } catch (e) {
        console.warn('[Budgets] Pause action failed (budget still enforced by refusal):', e instanceof Error ? e.message : e);
    }
}

export type SpendGateResult =
    | { ok: true }
    | { ok: false; status: 402 | 500; code: 'budget_exceeded' | 'budget_check_failed'; message: string };

/**
 * Shared admission gate for runs, turns, and tool-loop iterations: check
 * spend, pause the breached scope unless the budget asks for alert-only,
 * and refuse with a descriptor the caller maps to its own error shape.
 */
export async function enforceSpendGate(
    supabase: Admin,
    scope: { projectId: string; tenantId: string | null; installationId: string | null; agentId: string | null },
): Promise<SpendGateResult> {
    let decision: BudgetDecision;
    try {
        decision = await checkSpendBudgets(supabase, scope);
    } catch (e) {
        return { ok: false, status: 500, code: 'budget_check_failed', message: e instanceof Error ? e.message : 'Unable to verify spend budget' };
    }
    if (decision.ok) return { ok: true };
    if (decision.action !== 'alert' && (decision.scope === 'installation' || decision.scope === 'tenant')) {
        await pauseBreachedScope(supabase, {
            projectId: scope.projectId,
            tenantId: scope.tenantId,
            installationId: scope.installationId,
            scope: decision.scope,
            spent: decision.spent ?? 0,
            budget: decision.budget ?? 0,
        });
    }
    return {
        ok: false,
        status: 402,
        code: 'budget_exceeded',
        message: `${decision.scope} spend budget exceeded (spent $${(decision.spent ?? 0).toFixed(2)} of $${(decision.budget ?? 0).toFixed(2)})`,
    };
}
