import type { createAdminClient } from '@/lib/supabaseAdmin';
import { getEmbeddedLimits, type SubscriptionTier } from '@/lib/entitlements';
import { checkCustomRateLimit } from '@/lib/rate-limit';

type Admin = ReturnType<typeof createAdminClient>;

export type LimitCheck = {
    ok: true;
    tier: SubscriptionTier;
} | {
    ok: false;
    code: 'tenant_limit_exceeded' | 'installation_limit_exceeded' | 'provider_connection_limit_exceeded' | 'knowledge_limit_exceeded' | 'run_rate_exceeded' | 'run_concurrency_exceeded';
    message: string;
    retryAfterSeconds?: number;
};

async function count(supabase: Admin, table: string, filters: Record<string, string>): Promise<number> {
    // Intentionally loose: supabase-js postgrest generics recurse deeply here.
    const client = supabase as unknown as {
        from(t: string): {
            select(c: string, o?: Record<string, unknown>): {
                eq(c: string, v: string): unknown;
            };
        };
    };
    let query: unknown = client.from(table).select('id', { count: 'exact', head: true });
    for (const [col, val] of Object.entries(filters)) {
        query = (query as { eq(c: string, v: string): unknown }).eq(col, val);
    }
    const { count: n } = (await (query as unknown as Promise<{ count: number | null }>)) ?? { count: null };
    return n ?? 0;
}

export async function checkTenantCap(supabase: Admin, projectId: string, tier: SubscriptionTier): Promise<LimitCheck> {
    const limits = getEmbeddedLimits(tier);
    const current = await count(supabase, 'platform_tenants', { project_id: projectId });
    if (current >= limits.maxTenants) {
        return { ok: false, code: 'tenant_limit_exceeded', message: `Tenant limit reached for this plan (${limits.maxTenants})` };
    }
    return { ok: true, tier };
}

export async function checkInstallationCap(supabase: Admin, tenantId: string, tier: SubscriptionTier): Promise<LimitCheck> {
    const limits = getEmbeddedLimits(tier);
    const current = await count(supabase, 'agent_installations', { tenant_id: tenantId });
    if (current >= limits.maxInstallationsPerTenant) {
        return { ok: false, code: 'installation_limit_exceeded', message: `Installation limit reached for this tenant (${limits.maxInstallationsPerTenant})` };
    }
    return { ok: true, tier };
}

export async function checkProviderConnectionCap(supabase: Admin, projectId: string, tier: SubscriptionTier): Promise<LimitCheck> {
    const limits = getEmbeddedLimits(tier);
    const current = await count(supabase, 'provider_connections', { project_id: projectId });
    if (current >= limits.maxProviderConnections) {
        return { ok: false, code: 'provider_connection_limit_exceeded', message: `Provider connection limit reached (${limits.maxProviderConnections})` };
    }
    return { ok: true, tier };
}

export async function checkRunRate(scopeKey: string, tier: SubscriptionTier): Promise<LimitCheck> {
    const limits = getEmbeddedLimits(tier);
    const result = await checkCustomRateLimit(`embedded_runs:${scopeKey}`, limits.runsPerMinute, 60);
    if (!result.allowed) {
        return { ok: false, code: 'run_rate_exceeded', message: 'Run rate limit exceeded; retry shortly', retryAfterSeconds: result.reset };
    }
    return { ok: true, tier };
}

export async function checkRunConcurrency(supabase: Admin, installationId: string | null, tenantId: string | null, tier: SubscriptionTier): Promise<LimitCheck> {
    const limits = getEmbeddedLimits(tier);
    let query = supabase.from('embedded_runs').select('id', { count: 'exact', head: true }).in('status', ['queued', 'running']);
    if (installationId) query = query.eq('installation_id', installationId) as typeof query;
    else if (tenantId) query = query.eq('tenant_id', tenantId) as typeof query;
    else return { ok: true, tier };
    const { count: n } = await (query as unknown as Promise<{ count: number | null }>);
    if ((n ?? 0) >= limits.maxConcurrentRuns) {
        return { ok: false, code: 'run_concurrency_exceeded', message: `Too many concurrent runs (${limits.maxConcurrentRuns})` };
    }
    return { ok: true, tier };
}
