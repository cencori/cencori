import { describe, expect, it } from 'vitest';
import { PRO_GRACE_DAYS, planPausedBody, planState } from '../plan-state';

const day = 86_400_000;
const now = new Date('2026-11-20T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * day).toISOString();
const ahead = (days: number) => new Date(now.getTime() + days * day).toISOString();

describe('planState', () => {
    it('leaves free, enterprise and business orgs alone', () => {
        expect(planState({ subscription_tier: 'free', subscription_status: 'past_due' }, now).standing).toBe('active');
        expect(planState({ subscription_tier: 'enterprise', subscription_current_period_end: ago(90) }, now).standing).toBe('active');
        expect(planState({ subscription_tier: 'pro', account_type: 'business', subscription_status: 'unpaid', subscription_current_period_start: ago(30) }, now).standing).toBe('active');
        expect(planState(null, now).standing).toBe('active');
    });

    it('keeps a paid, current Pro org active', () => {
        expect(planState({ subscription_tier: 'pro', subscription_status: 'active', subscription_current_period_end: ahead(20) }, now)).toMatchObject({ standing: 'active', reason: null });
    });

    it('Stripe payment failure: grace from the period start, then paused', () => {
        const org = { subscription_tier: 'pro', subscription_status: 'past_due', billing_provider: 'stripe', subscription_current_period_start: ago(3), subscription_current_period_end: ahead(27) };
        const s = planState(org, now);
        expect(s).toMatchObject({ standing: 'grace', reason: 'payment_failed', lapsedAt: ago(3) });
        expect(s.graceEndsAt).toBe(ahead(PRO_GRACE_DAYS - 3));
        expect(planState({ ...org, subscription_status: 'unpaid', subscription_current_period_start: ago(8) }, now).standing).toBe('paused');
    });

    it('Bachs payment failure: grace from the period end', () => {
        const org = { subscription_tier: 'pro', subscription_status: 'past_due', billing_provider: 'bachs', subscription_current_period_start: ago(35), subscription_current_period_end: ago(5) };
        expect(planState(org, now).standing).toBe('grace');
        expect(planState({ ...org, subscription_current_period_end: ago(7.5) }, now).standing).toBe('paused');
    });

    it('a period that ended with no renewal lapses (after a day of slack for late webhooks)', () => {
        expect(planState({ subscription_tier: 'pro', subscription_status: 'active', subscription_current_period_end: ago(0.5) }, now).standing).toBe('active');
        expect(planState({ subscription_tier: 'pro', subscription_status: 'active', subscription_current_period_end: ago(3) }, now)).toMatchObject({ standing: 'grace', reason: 'period_ended' });
        expect(planState({ subscription_tier: 'team', subscription_status: 'active', subscription_current_period_end: ago(10) }, now).standing).toBe('paused');
    });

    it('never pauses on unknown dates', () => {
        expect(planState({ subscription_tier: 'pro', subscription_status: 'past_due' }, now).standing).toBe('active');
    });

    it('pauses an extra Free org until it is on Pro (one Free org per person)', () => {
        const extra = { subscription_tier: 'free', requires_pro: true };
        expect(planState(extra, now)).toMatchObject({ standing: 'paused', reason: 'pro_required' });
        expect(planPausedBody(planState(extra, now)).message).toContain('one Free organization');
        // Upgrading clears it; the first org and business accounts are never marked.
        expect(planState({ ...extra, subscription_tier: 'pro', subscription_status: 'active', subscription_current_period_end: ahead(20) }, now).standing).toBe('active');
        expect(planState({ subscription_tier: 'free', requires_pro: false }, now).standing).toBe('active');
        expect(planState({ ...extra, account_type: 'business' }, now).standing).toBe('active');
    });

    it('explains the pause and where to fix it', () => {
        const body = planPausedBody(planState({ subscription_tier: 'pro', subscription_status: 'unpaid', billing_provider: 'stripe', subscription_current_period_start: ago(10) }, now));
        expect(body).toMatchObject({ code: 'plan_paused', billing_url: 'https://cencori.com/billing' });
        expect(body.message).toContain('payment failed');
    });
});
