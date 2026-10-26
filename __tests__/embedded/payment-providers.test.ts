import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/security/outbound-url', () => ({ safeOutboundFetch: fetchMock }));

import { PAYMENT_PROVIDERS } from '@/lib/integrations/payment-providers';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const input = { reference: 'cen_0123456789abcdef01', amount: 20000, currency: 'NGN', description: 'Deposit: table for 4', email: 'guest@pay.cencori.com', returnUrl: 'https://cencori.com/api/payments/return?ref=cen_0123456789abcdef01', metadata: { cencori_agent: 'a1' } };

describe('payment providers', () => {
    beforeEach(() => fetchMock.mockReset());

    it('Paystack: amount in kobo, our reference, verified by reference', async () => {
        fetchMock.mockResolvedValueOnce(json({ status: true, data: { authorization_url: 'https://checkout.paystack.com/x' } }));
        expect(await PAYMENT_PROVIDERS.paystack.start('sk_test_x', input)).toEqual({ link: 'https://checkout.paystack.com/x' });
        const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
        expect(body).toMatchObject({ amount: 2_000_000, currency: 'NGN', reference: input.reference, callback_url: input.returnUrl });

        fetchMock.mockResolvedValueOnce(json({ status: true, data: { status: 'success', paid_at: '2026-10-30T19:01:00Z' } }));
        expect(await PAYMENT_PROVIDERS.paystack.check('sk_test_x', { reference: input.reference })).toEqual({ paid: true, paidAt: '2026-10-30T19:01:00Z' });
        expect(fetchMock.mock.calls[1][0]).toBe(`https://api.paystack.co/transaction/verify/${input.reference}`);
    });

    it('Flutterwave: tx_ref is our reference; not found yet means unpaid', async () => {
        fetchMock.mockResolvedValueOnce(json({ status: 'success', data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/x' } }));
        await PAYMENT_PROVIDERS.flutterwave.start('FLWSECK_TEST-x-X', input);
        expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({ tx_ref: input.reference, amount: 20000, currency: 'NGN', redirect_url: input.returnUrl, customer: { email: input.email } });

        fetchMock.mockResolvedValueOnce(json({ status: 'error', message: 'No transaction was found for this id' }, 400));
        expect(await PAYMENT_PROVIDERS.flutterwave.check('FLWSECK_TEST-x-X', { reference: input.reference })).toEqual({ paid: false, paidAt: null });
        fetchMock.mockResolvedValueOnce(json({ status: 'success', data: { status: 'successful', created_at: '2026-10-30T19:01:00Z' } }));
        expect((await PAYMENT_PROVIDERS.flutterwave.check('FLWSECK_TEST-x-X', { reference: input.reference })).paid).toBe(true);
    });

    it('Stripe: a Checkout Session in minor units, checked by its session id', async () => {
        fetchMock.mockResolvedValueOnce(json({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' }));
        expect(await PAYMENT_PROVIDERS.stripe.start('sk_test_x', { ...input, amount: 25.5, currency: 'USD' })).toEqual({ link: 'https://checkout.stripe.com/c/pay/cs_test_123', providerRef: 'cs_test_123' });
        const sent = new URLSearchParams(String(fetchMock.mock.calls[0][1].body));
        expect(sent.get('line_items[0][price_data][unit_amount]')).toBe('2550');
        expect(sent.get('line_items[0][price_data][currency]')).toBe('usd');
        expect(sent.get('client_reference_id')).toBe(input.reference);

        fetchMock.mockResolvedValueOnce(json({ payment_status: 'paid' }));
        expect((await PAYMENT_PROVIDERS.stripe.check('sk_test_x', { reference: input.reference, providerRef: 'cs_test_123' })).paid).toBe(true);
        expect(fetchMock.mock.calls[1][0]).toBe('https://api.stripe.com/v1/checkout/sessions/cs_test_123');
    });
});
