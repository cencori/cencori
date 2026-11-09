import { describe, expect, it } from 'vitest';
import type { BachsProduct } from '@/lib/bachsClient';
import { canStartCardSubscription, checkPlanProduct, verifySubscriptionCharge } from '../bachs-plans';

function product(overrides: Partial<BachsProduct> = {}): BachsProduct {
    return {
        id: 'prod_1',
        name: 'Pro Monthly',
        status: 'active',
        price: { currency: 'USD', price_type: 'fixed', amount: '20.00' },
        billing_cycle: { interval: 'month', frequency: 1 },
        ...overrides,
    };
}

describe('checkPlanProduct', () => {
    it('accepts a recurring USD product at the plan price', () => {
        expect(checkPlanProduct(product(), 'pro', 'month')).toEqual({ ok: true });
        expect(checkPlanProduct(product({
            price: { currency: 'USD', price_type: 'fixed', amount: '200.00' },
            billing_cycle: { interval: 'year', frequency: 1 },
        }), 'pro', 'year')).toEqual({ ok: true });
    });

    it.each([
        ['one-time', { billing_cycle: null }, 'not_recurring'],
        ['the old $49 price', { price: { currency: 'USD', price_type: 'fixed', amount: '49.00' } }, 'price_mismatch'],
        ['naira', { price: { currency: 'NGN', price_type: 'fixed', amount: '20000.00' } }, 'currency_mismatch'],
        ['pay what you want', { price: { currency: 'USD', price_type: 'custom', amount: '20.00' } }, 'price_not_fixed'],
        ['yearly for a month', { billing_cycle: { interval: 'year', frequency: 1 } }, 'billing_cycle_mismatch'],
        ['every two months', { billing_cycle: { interval: 'month', frequency: 2 } }, 'billing_cycle_mismatch'],
        ['archived', { status: 'archived' }, 'product_inactive'],
    ] as const)('refuses a product that is %s', (_name, overrides, reason) => {
        expect(checkPlanProduct(product(overrides as Partial<BachsProduct>), 'pro', 'month')).toEqual({ ok: false, reason });
    });
});

describe('canStartCardSubscription', () => {
    const now = new Date('2026-11-09T12:00:00Z');

    it('lets Free orgs and orgs on the retired Stripe billing subscribe', () => {
        expect(canStartCardSubscription({ subscription_tier: 'free' }, now)).toEqual({ ok: true });
        expect(canStartCardSubscription(null, now)).toEqual({ ok: true });
        expect(canStartCardSubscription({ subscription_tier: 'pro', billing_provider: 'stripe', subscription_status: 'active' }, now))
            .toEqual({ ok: true });
    });

    it('refuses an org with a live Bachs subscription', () => {
        for (const status of ['active', 'trialing', 'past_due']) {
            expect(canStartCardSubscription({ subscription_tier: 'pro', billing_provider: 'bachs', subscription_id: 'sub_1', subscription_status: status }, now))
                .toEqual({ ok: false, reason: 'already_subscribed' });
        }
        expect(canStartCardSubscription({ subscription_tier: 'pro', billing_provider: 'bachs', subscription_id: 'sub_1', subscription_status: 'cancelled' }, now))
            .toEqual({ ok: true });
    });

    it('refuses a naira pass with time left, and allows it once ended', () => {
        const pass = { subscription_tier: 'pro', billing_provider: 'bachs', subscription_id: null };
        expect(canStartCardSubscription({ ...pass, subscription_current_period_end: '2026-11-20T00:00:00Z' }, now))
            .toEqual({ ok: false, reason: 'naira_period_running' });
        expect(canStartCardSubscription({ ...pass, subscription_current_period_end: '2026-11-01T00:00:00Z' }, now))
            .toEqual({ ok: true });
    });

    it('leaves Enterprise to sales', () => {
        expect(canStartCardSubscription({ subscription_tier: 'enterprise' }, now))
            .toEqual({ ok: false, reason: 'not_self_serve' });
    });
});

describe('verifySubscriptionCharge', () => {
    const charge = { charge_id: 'ch_1', status: 'succeeded', currency: 'USD', amount: '20.00' };

    it('accepts a paid USD charge for the plan price', () => {
        expect(verifySubscriptionCharge({ charge, chargeId: 'ch_1', tier: 'pro', interval: 'month' })).toEqual({ ok: true });
    });

    it.each([
        ['underpaid', { amount: '19.99' }, 'amount_below_price'],
        ['a monthly price for a year', { amount: '20.00' }, 'amount_below_price'],
        ['pending', { status: 'pending' }, 'unsettled_status'],
        ['naira', { currency: 'NGN' }, 'currency_mismatch'],
        ['another charge', { charge_id: 'ch_2' }, 'charge_id_mismatch'],
    ] as const)('refuses a charge that is %s', (name, overrides, reason) => {
        const interval = name === 'a monthly price for a year' ? 'year' : 'month';
        expect(verifySubscriptionCharge({ charge: { ...charge, ...overrides }, chargeId: 'ch_1', tier: 'pro', interval }))
            .toEqual({ ok: false, reason });
    });
});
