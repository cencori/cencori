import { describe, expect, it, vi } from 'vitest';
import {
    BUSINESS_DEFAULT_MODEL,
    consumeConversation,
    modelAllowed,
    nextBusinessPeriod,
    readPlan,
    usageMark,
    type OrganizationPlan,
} from '@/lib/business/plans';

const NOW = Date.parse('2026-10-26T12:00:00Z');
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

const row = (overrides: Record<string, unknown> = {}) => ({
    account_type: 'business',
    business_plan: 'growth',
    business_plan_status: 'active',
    business_period_start: iso(NOW - 5 * DAY),
    business_period_end: iso(NOW + 25 * DAY),
    ...overrides,
});

/** organizations + the counting RPC, just what the plan module asks for. */
function fakeDb(org: Record<string, unknown> | null, rpc: { data: unknown; error: unknown } = { data: 1, error: null }) {
    const call = vi.fn(async () => rpc);
    const db = {
        from: () => {
            const builder = { select: () => builder, eq: () => builder, maybeSingle: async () => ({ data: org, error: null }) };
            return builder;
        },
        rpc: call,
    };
    return { db: db as never, call };
}

describe('business plans', () => {
    it('reads a plan as active inside its paid period and its grace days', () => {
        expect(readPlan(row(), NOW)).toMatchObject({ accountType: 'business', active: true, inGrace: false, plan: { id: 'growth', conversations: 500, agents: 3 } });
        // Ended a day ago: still answering, in grace, until three days past the end.
        expect(readPlan(row({ business_period_end: iso(NOW - DAY) }), NOW)).toMatchObject({ active: true, inGrace: true, graceEnd: iso(NOW + 2 * DAY) });
        expect(readPlan(row({ business_period_end: iso(NOW - 3 * DAY) }), NOW)).toMatchObject({ active: false, inGrace: false });
        // A cancelled or failed renewal still runs to the end of what was paid for.
        expect(readPlan(row({ business_plan_status: 'canceled' }), NOW).active).toBe(true);
        expect(readPlan(row({ business_plan: 'platinum' }), NOW).active).toBe(false);
    });

    it('locks models below Business, and never locks developers', () => {
        const growth = readPlan(row(), NOW);
        expect(modelAllowed(growth, BUSINESS_DEFAULT_MODEL)).toBe(true);
        expect(modelAllowed(growth, '')).toBe(true);
        expect(modelAllowed(growth, 'claude-opus-5-5')).toBe(false);
        expect(modelAllowed(readPlan(row({ business_plan: 'business' }), NOW), 'claude-opus-5-5')).toBe(true);
        // A lapsed Business plan falls back to the default model too.
        expect(modelAllowed(readPlan(row({ business_plan: 'business', business_period_end: iso(NOW - 4 * DAY) }), NOW), 'claude-opus-5-5')).toBe(false);
        const developer: OrganizationPlan = { accountType: 'developer', plan: null, status: null, periodStart: null, periodEnd: null, active: false, inGrace: false, graceEnd: null };
        expect(modelAllowed(developer, 'claude-opus-5-5')).toBe(true);
    });

    it('keeps the days left when renewing the same plan early, and restarts on a change', () => {
        const growth = readPlan(row(), NOW);
        const renewed = nextBusinessPeriod(growth, 'growth', NOW);
        expect(renewed.start).toBe(iso(NOW));
        expect(Date.parse(renewed.end) - NOW).toBe(55 * DAY);
        expect(Date.parse(nextBusinessPeriod(growth, 'business', NOW).end) - NOW).toBe(30 * DAY);
        // Renewing in grace or after: 30 days from now, the grace days aren't added.
        for (const ago of [DAY, 4 * DAY]) {
            const lapsed = readPlan(row({ business_period_end: iso(NOW - ago) }), NOW);
            expect(Date.parse(nextBusinessPeriod(lapsed, 'growth', NOW).end) - NOW).toBe(30 * DAY);
        }
    });

    it('counts conversations for businesses only, and stops 20% past the limit', async () => {
        const developer = fakeDb({ account_type: 'developer' });
        expect(await consumeConversation(developer.db, 'org')).toEqual({ ok: true, used: null, limit: null });
        expect(developer.call).not.toHaveBeenCalled();

        const counted = fakeDb(row({ business_period_start: iso(Date.now() - DAY), business_period_end: iso(Date.now() + DAY) }), { data: 7, error: null });
        expect(await consumeConversation(counted.db, 'org')).toEqual({ ok: true, used: 7, limit: 500, mark: null });
        expect(counted.call).toHaveBeenCalledWith('consume_business_conversation', expect.objectContaining({ p_organization_id: 'org', p_limit: 600 }));

        const full = fakeDb(row({ business_period_start: iso(Date.now() - DAY), business_period_end: iso(Date.now() + DAY) }), { data: -1, error: null });
        expect(await consumeConversation(full.db, 'org')).toMatchObject({ ok: false, reason: 'limit' });

        const ended = fakeDb(row({ business_period_end: iso(Date.now() - 4 * DAY) }));
        expect(await consumeConversation(ended.db, 'org')).toMatchObject({ ok: false, reason: 'inactive' });
    });

    it('marks the chat that reaches 80%, and the first extra one', () => {
        expect(usageMark(100, 79)).toBeNull();
        expect(usageMark(100, 80)).toBe('chats_most');
        expect(usageMark(100, 100)).toBeNull();
        expect(usageMark(100, 101)).toBe('chats_all');
        expect(usageMark(500, 400)).toBe('chats_most');
    });

    it('reads a missing column or row as a developer organization', async () => {
        const broken = { from: () => { const b = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: null, error: { message: 'column organizations.account_type does not exist' } }) }; return b; } };
        expect(await consumeConversation(broken as never, 'org')).toEqual({ ok: true, used: null, limit: null });
    });
});
