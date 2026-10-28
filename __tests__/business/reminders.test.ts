import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/studio/push', () => ({ pushToOwners: vi.fn() }));
vi.mock('@/lib/studio/earned', () => ({ paidThroughAssistant: vi.fn(), earnedSince: vi.fn() }));
vi.mock('@/lib/email/sendbyte', () => ({ sendEmail: vi.fn(), escapeHtml: (s: string) => s }));

import { dateReminderDue } from '@/lib/business/reminders';
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
