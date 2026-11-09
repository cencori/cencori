import { describe, expect, it } from 'vitest';
import type { BachsCharge } from '@/lib/bachsClient';
import {
    NAIRA_PLAN_PASS_PURCHASE_TYPE,
    canBuyNairaPass,
    nairaPassPeriod,
    nairaPassPriceNgn,
    verifyNairaPassCharge,
} from '../naira-plan-pass';
import { planState } from '../plan-state';

const ORG = 'org-123';

function charge(overrides: Partial<BachsCharge> = {}): BachsCharge {
    return {
        charge_id: 'ch_1',
        checkout_id: 'co_1',
        reference: 'ref',
        status: 'succeeded',
        amount: '20000.00',
        currency: 'NGN',
        customer: { id: 'cus_1', email: 'a@b.c', created_at: '2026-11-09T00:00:00Z' },
        product_cart: [],
        metadata: { org_id: ORG, purchase_type: NAIRA_PLAN_PASS_PURCHASE_TYPE, tier: 'pro', interval: 'month' },
        created_at: '2026-11-09T00:00:00Z',
        ...overrides,
    };
}

const monthly = { org_id: ORG, purchase_type: NAIRA_PLAN_PASS_PURCHASE_TYPE, tier: 'pro', interval: 'month' };

describe('nairaPassPriceNgn', () => {
    it('uses the set naira prices', () => {
        expect(nairaPassPriceNgn('pro', 'month')).toBe(20_000);
        expect(nairaPassPriceNgn('pro', 'year')).toBe(200_000);
    });
});

describe('verifyNairaPassCharge', () => {
    it('accepts a paid naira charge for the full price', () => {
        expect(verifyNairaPassCharge({ charge: charge(), chargeId: 'ch_1', organizationId: ORG, metadata: monthly }))
            .toEqual({ ok: true, tier: 'pro', interval: 'month', amountNgn: 20_000 });
    });

    it('accepts a charge with no metadata echo', () => {
        const result = verifyNairaPassCharge({ charge: charge({ metadata: {} }), chargeId: 'ch_1', organizationId: ORG, metadata: monthly });
        expect(result.ok).toBe(true);
    });

    it.each([
        ['underpaid', { amount: '19999.99' }, 'amount_below_price'],
        ['unpaid', { status: 'pending' }, 'unsettled_status'],
        ['dollars', { currency: 'USD' }, 'currency_mismatch'],
        ['other org', { metadata: { org_id: 'org-other' } }, 'metadata_org_mismatch'],
        ['other purchase', { metadata: { purchase_type: 'credits_topup_ngn' } }, 'metadata_purchase_type_mismatch'],
        ['other interval', { metadata: { interval: 'year' } }, 'metadata_interval_mismatch'],
        ['has a cart', { product_cart: [{ product_id: 'p', quantity: 1 }] }, 'unexpected_product_cart'],
        ['wrong id', { charge_id: 'ch_2' }, 'charge_id_mismatch'],
    ] as const)('rejects a charge that is %s', (_name, overrides, reason) => {
        const result = verifyNairaPassCharge({ charge: charge(overrides as Partial<BachsCharge>), chargeId: 'ch_1', organizationId: ORG, metadata: monthly });
        expect(result).toEqual({ ok: false, reason });
    });

    it('needs the full annual price for a year', () => {
        const year = { ...monthly, interval: 'year' };
        const echo = { metadata: { ...monthly, interval: 'year' } };
        expect(verifyNairaPassCharge({ charge: charge(echo), chargeId: 'ch_1', organizationId: ORG, metadata: year }))
            .toEqual({ ok: false, reason: 'amount_below_price' });
        expect(verifyNairaPassCharge({ charge: charge({ ...echo, amount: '200000.00' }), chargeId: 'ch_1', organizationId: ORG, metadata: year }).ok)
            .toBe(true);
    });

    it('rejects Team and unknown intervals', () => {
        expect(verifyNairaPassCharge({ charge: charge(), chargeId: 'ch_1', organizationId: ORG, metadata: { ...monthly, tier: 'team' } }))
            .toEqual({ ok: false, reason: 'unknown_tier' });
        expect(verifyNairaPassCharge({ charge: charge(), chargeId: 'ch_1', organizationId: ORG, metadata: { ...monthly, interval: 'week' } }))
            .toEqual({ ok: false, reason: 'unknown_interval' });
    });
});

describe('nairaPassPeriod', () => {
    const now = new Date('2026-11-09T12:00:00Z');

    it('starts now for a free org', () => {
        expect(nairaPassPeriod({ subscription_tier: 'free' }, 'month', now))
            .toEqual({ start: '2026-11-09T12:00:00.000Z', end: '2026-12-09T12:00:00.000Z' });
    });

    it('extends a running naira Pro from its end', () => {
        const org = { subscription_tier: 'pro', billing_provider: 'bachs', subscription_current_period_end: '2026-11-20T00:00:00.000Z' };
        expect(nairaPassPeriod(org, 'month', now).end).toBe('2026-12-20T00:00:00.000Z');
    });

    it('starts now when the naira Pro already ended', () => {
        const org = { subscription_tier: 'pro', billing_provider: 'bachs', subscription_current_period_end: '2026-11-01T00:00:00.000Z' };
        expect(nairaPassPeriod(org, 'year', now).end).toBe('2027-11-09T12:00:00.000Z');
    });

    it('gives an active Pro in plan-state, then a lapse after the period', () => {
        const period = nairaPassPeriod({ subscription_tier: 'free' }, 'month', now);
        const org = { subscription_tier: 'pro', subscription_status: 'active', billing_provider: 'bachs', subscription_current_period_start: period.start, subscription_current_period_end: period.end };
        expect(planState(org, now).standing).toBe('active');
        expect(planState(org, new Date('2026-12-12T12:00:00Z')).standing).toBe('grace');
        expect(planState(org, new Date('2026-12-20T12:00:00Z')).standing).toBe('paused');
    });
});

describe('canBuyNairaPass', () => {
    it('lets Free orgs upgrade and naira Pro orgs renew', () => {
        expect(canBuyNairaPass({ subscription_tier: 'free' })).toBe(true);
        expect(canBuyNairaPass(null)).toBe(true);
        expect(canBuyNairaPass({ subscription_tier: 'pro', billing_provider: 'bachs' })).toBe(true);
    });

    it('blocks orgs paying for Pro through Stripe, and Team or Enterprise', () => {
        expect(canBuyNairaPass({ subscription_tier: 'pro', billing_provider: 'stripe' })).toBe(false);
        expect(canBuyNairaPass({ subscription_tier: 'team', billing_provider: 'bachs' })).toBe(false);
        expect(canBuyNairaPass({ subscription_tier: 'enterprise' })).toBe(false);
    });
});
