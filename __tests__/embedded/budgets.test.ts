import { describe, expect, it, vi } from 'vitest';
import { calendarMonthStart, checkSpendBudgets, enforceSpendGate } from '@/lib/embedded/budgets';

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

    it('bounds calendar-month windows to the month start in the budget timezone', () => {
        // 2026-09-25 noon UTC is still September in both zones.
        const utc = calendarMonthStart('UTC', Date.parse('2026-09-25T12:00:00Z'));
        expect(utc).toBe('2026-09-01T00:00:00.000Z');
        const ny = calendarMonthStart('America/New_York', Date.parse('2026-09-25T12:00:00Z'));
        expect(ny.startsWith('2026-09-01')).toBe(true);
        // Invalid timezones fall back to UTC month start, never throw.
        expect(calendarMonthStart('Nope/Nowhere', Date.parse('2026-09-25T12:00:00Z'))).toBe('2026-09-01T00:00:00.000Z');
    });

    it('pauses the breached scope by default and refuses the request', async () => {
        const updates: Array<{ table: string; patch: unknown }> = [];
        const fluid = (impl: {
            run?: () => unknown; maybeSingle?: () => unknown; range?: () => unknown;
        }) => {
            const chain: Record<string, unknown> = {};
            Object.assign(chain, {
                eq: () => chain,
                gte: () => chain,
                lte: () => chain,
                like: () => chain,
                order: () => chain,
                limit: () => chain,
                range: impl.range ?? (async () => ({ data: [], error: null })),
                maybeSingle: impl.maybeSingle ?? (async () => ({ data: null, error: null })),
                update: (patch: unknown) => {
                    updates.push({ table: currentTable, patch });
                    return chain;
                },
                then: (resolve: (v: unknown) => void) => resolve(impl.run ? impl.run() : { data: [], error: null }),
            });
            return chain;
        };
        let currentTable = '';
        const gateDb = {
            from: (table: string) => {
                currentTable = table;
                if (table === 'agent_installations') {
                    return {
                        select: () => fluid({
                            maybeSingle: async () => ({ data: { budget: { max_spend_usd: 1 } }, error: null }),
                        }),
                        update: (patch: unknown) => {
                            updates.push({ table, patch });
                            const c: Record<string, unknown> = {};
                            Object.assign(c, { eq: () => c, then: (r: (v: unknown) => void) => r({ data: null, error: null }) });
                            return c;
                        },
                    };
                }
                if (table === 'ai_requests') {
                    return {
                        select: () => fluid({
                            range: async () => ({ data: [{ cencori_charge_usd: 5, metadata: {} }], error: null }),
                        }),
                    };
                }
                return {
                    select: () => fluid({
                        run: () => ({ count: 0, error: null }),
                    }),
                };
            },
        };
        const result = await enforceSpendGate(gateDb as never, {
            projectId: 'project', tenantId: null, installationId: 'installation', agentId: 'agent',
        });
        expect(result).toMatchObject({ ok: false, status: 402, code: 'budget_exceeded' });
        expect(updates.some((u) => u.table === 'agent_installations')).toBe(true);
    });

    it('alert-only budgets refuse without pausing', async () => {
        const updates: Array<unknown> = [];
        const gateDb = {
            from: (table: string) => {
                if (table === 'agent_installations') {
                    return {
                        select: () => ({
                            eq: () => ({
                                eq: () => ({
                                    maybeSingle: async () => ({ data: { budget: { max_spend_usd: 1, action: 'alert' } }, error: null }),
                                }),
                            }),
                        }),
                        update: () => { throw new Error('must not pause on alert'); },
                    };
                }
                if (table === 'ai_requests') {
                    return {
                        select: () => ({
                            eq: () => ({
                                gte: () => ({
                                    eq: () => ({
                                        order: () => ({
                                            order: () => ({
                                                range: async () => ({ data: [{ cencori_charge_usd: 5, metadata: {} }], error: null }),
                                            }),
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    };
                }
                return {
                    select: () => {
                        const chain: Record<string, unknown> = {};
                        Object.assign(chain, {
                            eq: () => chain,
                            gte: () => chain,
                            like: () => chain,
                            then: (resolve: (v: unknown) => void) => resolve({ count: 0, error: null }),
                        });
                        return chain;
                    },
                };
            },
        };
        void updates;
        const result = await enforceSpendGate(gateDb as never, {
            projectId: 'project', tenantId: null, installationId: 'installation', agentId: 'agent',
        });
        expect(result).toMatchObject({ ok: false, status: 402, code: 'budget_exceeded' });
    });
});
