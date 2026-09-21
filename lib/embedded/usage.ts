export const USAGE_MAX_WINDOW_DAYS = 90;
export const USAGE_EXPORT_ROW_LIMIT = 5000;

export interface UsageGroupKey {
    tenant_id: string | null;
    agent_id: string | null;
    installation_id: string | null;
    model: string;
    day: string;
}

export interface UsageRow {
    tenant_id: string | null;
    agent_id: string | null;
    installation_id: string | null;
    model: string;
    provider: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd: number;
    provider_cost_usd: number;
    cencori_charge_usd: number;
    created_at: string;
}

export function parseWindow(searchParams: URLSearchParams): { since: string; until: string; days: number } | { error: string } {
    const daysRaw = Number.parseInt(searchParams.get('days') ?? '30', 10);
    const days = Number.isFinite(daysRaw) ? Math.min(USAGE_MAX_WINDOW_DAYS, Math.max(1, daysRaw)) : 30;
    const until = searchParams.get('until') ? new Date(searchParams.get('until') as string) : new Date();
    if (Number.isNaN(until.getTime())) return { error: 'Invalid until date' };
    const sinceParam = searchParams.get('since');
    const since = sinceParam ? new Date(sinceParam) : new Date(until.getTime() - days * 86400 * 1000);
    if (Number.isNaN(since.getTime())) return { error: 'Invalid since date' };
    if (since > until) return { error: 'since must precede until' };
    if ((until.getTime() - since.getTime()) / 86400000 > USAGE_MAX_WINDOW_DAYS) {
        return { error: `Window exceeds ${USAGE_MAX_WINDOW_DAYS} days` };
    }
    return { since: since.toISOString(), until: until.toISOString(), days };
}

export function groupUsage(rows: UsageRow[]): Array<UsageGroupKey & { requests: number; prompt_tokens: number; completion_tokens: number; total_tokens: number; cost_usd: number; provider_cost_usd: number; cencori_charge_usd: number }> {
    const map = new Map<string, UsageGroupKey & { requests: number; prompt_tokens: number; completion_tokens: number; total_tokens: number; cost_usd: number; provider_cost_usd: number; cencori_charge_usd: number }>();
    for (const r of rows) {
        const day = r.created_at.slice(0, 10);
        const key = JSON.stringify([r.tenant_id, r.agent_id, r.installation_id, r.model, day]);
        const existing = map.get(key);
        if (existing) {
            existing.requests += 1;
            existing.prompt_tokens += r.prompt_tokens;
            existing.completion_tokens += r.completion_tokens;
            existing.total_tokens += r.total_tokens;
            existing.cost_usd += r.cost_usd;
            existing.provider_cost_usd += r.provider_cost_usd;
            existing.cencori_charge_usd += r.cencori_charge_usd;
        } else {
            map.set(key, {
                tenant_id: r.tenant_id, agent_id: r.agent_id, installation_id: r.installation_id, model: r.model, day,
                requests: 1, prompt_tokens: r.prompt_tokens, completion_tokens: r.completion_tokens,
                total_tokens: r.total_tokens, cost_usd: r.cost_usd,
                provider_cost_usd: r.provider_cost_usd, cencori_charge_usd: r.cencori_charge_usd,
            });
        }
    }
    return [...map.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

export function toCsv(groups: ReturnType<typeof groupUsage>): string {
    const header = 'day,tenant_id,agent_id,installation_id,model,requests,prompt_tokens,completion_tokens,total_tokens,cost_usd,provider_cost_usd,cencori_charge_usd';
    const lines = groups.map((g) =>
        [g.day, g.tenant_id ?? '', g.agent_id ?? '', g.installation_id ?? '', g.model, g.requests, g.prompt_tokens, g.completion_tokens, g.total_tokens, g.cost_usd.toFixed(6), g.provider_cost_usd.toFixed(6), g.cencori_charge_usd.toFixed(6)].join(','),
    );
    return [header, ...lines].join('\n');
}
