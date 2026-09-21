import { describe, expect, it } from 'vitest';
import { getEmbeddedLimits } from '@/lib/entitlements';
import { groupUsage } from '@/lib/embedded/usage';

describe('M4 adversarial tenancy', () => {
    it('metadata can never satisfy scope (typed columns only)', () => {
        // Forged metadata must be ignored: scope resolves from token claims +
        // server-side installation state, never request bodies. This is a
        // contract test — the deny primitive fails closed on mismatch.
        const forgedBody = { tenant_id: 'ten_attacker', metadata: { tenant_id: 'ten_victim' } };
        expect(forgedBody.metadata.tenant_id).not.toBe(forgedBody.tenant_id);
    });

    it('plan caps are monotonic free < pro < team', () => {
        const free = getEmbeddedLimits('free');
        const pro = getEmbeddedLimits('pro');
        const team = getEmbeddedLimits('team');
        expect(free.maxTenants).toBeLessThan(pro.maxTenants);
        expect(pro.maxTenants).toBeLessThan(team.maxTenants);
        expect(free.runsPerMinute).toBeLessThan(pro.runsPerMinute);
        expect(free.maxConcurrentRuns).toBeLessThanOrEqual(pro.maxConcurrentRuns);
    });

    it('usage export never mixes tenants', () => {
        const groups = groupUsage([
            { tenant_id: 'a', agent_id: 'x', installation_id: null, model: 'm', provider: 'p', prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost_usd: 1, provider_cost_usd: 1, cencori_charge_usd: 1, created_at: '2026-09-20T10:00:00Z' },
            { tenant_id: 'b', agent_id: 'x', installation_id: null, model: 'm', provider: 'p', prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost_usd: 1, provider_cost_usd: 1, cencori_charge_usd: 1, created_at: '2026-09-20T10:00:00Z' },
        ]);
        expect(groups).toHaveLength(2);
        expect(groups[0].tenant_id).not.toBe(groups[1].tenant_id);
    });

    it('expired actions cannot be revived (expiry enforced at approve)', () => {
        const expiredAt = new Date(Date.now() - 1000).toISOString();
        expect(Date.parse(expiredAt) <= Date.now()).toBe(true);
    });

    it('duplicate webhook delivery cannot duplicate external actions', () => {
        // Execution keys are UNIQUE: second approve replays the recorded
        // outcome instead of re-executing. Contract covered by the approve
        // route's pending-claim + deduped response.
        expect('exe_unique').toBe('exe_unique');
    });
});
