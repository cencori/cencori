import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/studio/push', () => ({ pushToOwners: vi.fn() }));
vi.mock('@/lib/studio/earned', () => ({
    paidThroughAssistant: vi.fn(async () => ({ currency: 'NGN', paid: [] })),
    earnedSince: vi.fn(() => ({ amount: 0 })),
}));
vi.mock('@/lib/email/sendbyte', () => ({ sendEmail: vi.fn(), escapeHtml: (s: string) => s }));
vi.mock('@/lib/auth/admin-users', () => ({
    adminUsers: { getUserById: vi.fn(async (id: string) => ({ data: { user: { id, email: 'owner@shop.ng' } }, error: null })) },
}));

import { dateReminderDue, remindOwners } from '@/lib/business/reminders';
import { sendEmail } from '@/lib/email/sendbyte';
import { adminUsers } from '@/lib/auth/admin-users';
import { readPlan } from '@/lib/business/plans';

const NOW = Date.parse('2026-10-28T12:00:00Z');
const DAY = 86_400_000;
const plan = (endsIn: number, id = 'starter') => readPlan({
    account_type: 'business',
    business_plan: id,
    business_plan_status: 'active',
    business_period_start: new Date(NOW - 20 * DAY).toISOString(),
    business_period_end: new Date(NOW + endsIn).toISOString(),
}, NOW);

describe('plan reminders by date', () => {
    it('reaches each reminder in turn', () => {
        expect(dateReminderDue(plan(10 * DAY), NOW)).toBeNull();
        expect(dateReminderDue(plan(6 * DAY), NOW)).toBe('ends_7');
        expect(dateReminderDue(plan(2 * DAY), NOW)).toBe('ends_3');
        expect(dateReminderDue(plan(DAY / 2), NOW)).toBe('ends_1');
        expect(dateReminderDue(plan(-DAY), NOW)).toBe('grace');
        expect(dateReminderDue(plan(-4 * DAY), NOW)).toBe('stopped');
        expect(dateReminderDue(plan(-10 * DAY), NOW)).toBeNull();
    });

    it('skips the week notice on the two-week trial', () => {
        expect(dateReminderDue(plan(6 * DAY, 'trial'), NOW)).toBeNull();
        expect(dateReminderDue(plan(2 * DAY, 'trial'), NOW)).toBe('ends_3');
    });
});

/** Just enough of the admin client for remindOwners: the claim, then the org and its projects. */
function fakeDb() {
    const chain = (result: unknown) => {
        const q: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'not', 'upsert', 'update']) q[m] = () => q;
        q.maybeSingle = async () => result;
        q.then = (resolve: (v: unknown) => unknown) => resolve(result);
        return q;
    };
    let claimed = false;
    return {
        auth: { admin: { getUserById: vi.fn(async () => { throw new Error('Supabase Auth is retired'); }) } },
        from: (table: string) => {
            if (table === 'business_usage') {
                const q = chain({ data: { reminders_sent: claimed ? ['ends_3'] : [] }, error: null });
                q.update = () => { claimed = true; return chain({ data: [{ organization_id: 'org_1' }], error: null }); };
                return q;
            }
            if (table === 'projects') return chain({ data: [{ id: 'proj_1' }], error: null });
            return chain({ data: { name: 'Mama Put', owner_id: 'user_1' }, error: null });
        },
    };
}

describe('remindOwners', () => {
    it("emails the owner, found through Better Auth (not Supabase Auth)", async () => {
        const db = fakeDb();
        const sent = await remindOwners(db as never, 'org_1', plan(2 * DAY), 'ends_3');
        expect(sent).toBe(true);
        expect(adminUsers.getUserById).toHaveBeenCalledWith('user_1');
        expect(db.auth.admin.getUserById).not.toHaveBeenCalled();
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: ['owner@shop.ng'] }));
    });
});
