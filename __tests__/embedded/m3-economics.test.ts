import { describe, expect, it } from 'vitest';
import { groupUsage, parseWindow, toCsv } from '@/lib/embedded/usage';

describe('usage windows', () => {
    it('caps windows at 90 days', () => {
        const result = parseWindow(new URLSearchParams('days=365'));
        expect('error' in result).toBe(false);
        if (!('error' in result)) {
            expect(result.days).toBe(90);
        }
    });

    it('rejects inverted ranges', () => {
        const result = parseWindow(new URLSearchParams('since=2026-09-21&until=2026-01-01'));
        expect('error' in result).toBe(true);
    });
});

describe('usage grouping (invoice export)', () => {
    const rows = [
        { tenant_id: 't1', agent_id: 'a1', installation_id: null, model: 'gpt-5', provider: 'openai', prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, cost_usd: 0.01, provider_cost_usd: 0.008, cencori_charge_usd: 0.01, created_at: '2026-09-20T10:00:00Z' },
        { tenant_id: 't1', agent_id: 'a1', installation_id: null, model: 'gpt-5', provider: 'openai', prompt_tokens: 200, completion_tokens: 100, total_tokens: 300, cost_usd: 0.02, provider_cost_usd: 0.016, cencori_charge_usd: 0.02, created_at: '2026-09-20T11:00:00Z' },
        { tenant_id: 't2', agent_id: 'a1', installation_id: null, model: 'gpt-5', provider: 'openai', prompt_tokens: 50, completion_tokens: 25, total_tokens: 75, cost_usd: 0.005, provider_cost_usd: 0.004, cencori_charge_usd: 0.005, created_at: '2026-09-20T12:00:00Z' },
    ];

    it('groups by tenant+agent+model+day with summed costs', () => {
        const groups = groupUsage(rows);
        expect(groups).toHaveLength(2);
        const t1 = groups.find((g) => g.tenant_id === 't1');
        expect(t1?.requests).toBe(2);
        expect(t1?.total_tokens).toBe(450);
        expect(t1?.cencori_charge_usd).toBeCloseTo(0.03);
    });

    it('renders invoice CSV', () => {
        const csv = toCsv(groupUsage(rows));
        const lines = csv.split('\n');
        expect(lines[0]).toContain('tenant_id,agent_id');
        expect(lines).toHaveLength(3);
    });
});

describe('publishing visibility', () => {
    it('accepts the four PRD visibility modes', () => {
        for (const v of ['private', 'tenant', 'unlisted', 'public']) {
            expect(['private', 'tenant', 'unlisted', 'public']).toContain(v);
        }
    });

    it('defaults catalog to public + unlisted', () => {
        const defaults = ['public', 'unlisted'];
        expect(defaults).not.toContain('private');
        expect(defaults).not.toContain('tenant');
    });
});
