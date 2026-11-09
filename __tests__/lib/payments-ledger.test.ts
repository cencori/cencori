import { describe, expect, it } from 'vitest';
import { bachsPaymentRow, ngnPerUsdAt } from '@/lib/billing/payments-ledger';
import type { BachsCharge } from '@/lib/bachsClient';

function charge(overrides: Partial<BachsCharge> = {}): BachsCharge {
    return {
        charge_id: 'ch_1',
        checkout_id: 'co_1',
        reference: 'ref_1',
        status: 'succeeded',
        amount: '49.00',
        currency: 'USD',
        processing_fee: '1.50',
        customer: { id: 'cus_1', email: 'a@example.com', created_at: '2026-10-01T00:00:00Z' },
        product_cart: [],
        metadata: { org_id: 'org_1', purchase_type: 'credits_topup' },
        created_at: '2026-11-08T10:00:00Z',
        ...overrides,
    };
}

describe('payments ledger', () => {
    it('records a dollar payment at face value', () => {
        const row = bachsPaymentRow(charge());
        expect(row).toMatchObject({
            provider: 'bachs',
            provider_payment_id: 'ch_1',
            organization_id: 'org_1',
            product_type: 'credits_topup',
            amount: 49,
            currency: 'USD',
            amount_usd: 49,
            fx_ngn_per_usd: null,
            processing_fee: 1.5,
            customer_email: 'a@example.com',
        });
    });

    it('converts naira at the rate packs were sold at when paid', () => {
        const after = bachsPaymentRow(charge({ amount: '15000', currency: 'NGN', created_at: '2026-11-08T10:00:00Z' }));
        expect(after).toMatchObject({ amount: 15000, currency: 'NGN', fx_ngn_per_usd: 1500, amount_usd: 10 });

        const before = bachsPaymentRow(charge({ amount: '10000', currency: 'NGN', created_at: '2026-11-01T10:00:00Z' }));
        expect(before).toMatchObject({ fx_ngn_per_usd: 1000, amount_usd: 10 });
        expect(ngnPerUsdAt(new Date('2026-11-06T23:59:59Z'))).toBe(1000);
        expect(ngnPerUsdAt(new Date('2026-11-07T00:00:00Z'))).toBe(1500);
    });

    it('skips charges that were not paid', () => {
        expect(bachsPaymentRow(charge({ status: 'failed' }))).toBeNull();
        expect(bachsPaymentRow(charge({ status: 'pending' }))).toBeNull();
        expect(bachsPaymentRow(charge({ amount: 'not-a-number' }))).toBeNull();
    });

    it('accepts the paid statuses Bachs uses', () => {
        for (const status of ['succeeded', 'successful', 'paid', 'completed', 'SUCCEEDED']) {
            expect(bachsPaymentRow(charge({ status }))).not.toBeNull();
        }
    });
});

describe('payments ledger: Pro paid in naira', () => {
    it('counts it as a subscription with its interval', () => {
        const row = bachsPaymentRow(charge({
            amount: '20000.00',
            currency: 'NGN',
            metadata: { org_id: 'org_1', purchase_type: 'plan_pass_ngn', tier: 'pro', interval: 'month' },
        }));
        expect(row).toMatchObject({ product_type: 'subscription', billing_interval: 'month', currency: 'NGN', amount: 20000 });
    });
});
