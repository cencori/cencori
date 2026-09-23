import { describe, expect, it } from 'vitest';
import { checkSpendBudgets } from '@/lib/embedded/budgets';

describe('embedded spend admission', () => {
    it('sums every metering page rather than stopping at the PostgREST page cap', async () => {
        const offsets: number[] = [];
        const requestQuery = {
            eq: () => requestQuery,
            gte: () => requestQuery,
            order: () => requestQuery,
            range: async (start: number) => {
                offsets.push(start);
                return { data: Array.from({ length: start === 0 ? 1000 : 1 }, () => ({ cencori_charge_usd: 1, metadata: {} })), error: null };
            },
        };
        const unresolvedQuery = {
            eq: () => unresolvedQuery,
            gte: () => unresolvedQuery,
            like: () => unresolvedQuery,
            then: (resolve: (result: { count: number; error: null }) => unknown) => Promise.resolve({ count: 0, error: null }).then(resolve),
        };
        const installationQuery = {
            eq: () => installationQuery,
            maybeSingle: async () => ({ data: { budget: { max_spend_usd: 1000.5 } }, error: null }),
        };
        const supabase = {
            from: (table: string) => ({
                select: () => table === 'ai_requests' ? requestQuery
                    : table === 'embedded_runs' ? unresolvedQuery : installationQuery,
            }),
        };
        const decision = await checkSpendBudgets(supabase as never, {
            projectId: 'project', tenantId: null, installationId: 'installation', agentId: 'agent',
        });
        expect(offsets).toEqual([0, 1000]);
        expect(decision).toMatchObject({ ok: false, scope: 'installation', spent: 1001 });
    });
});
