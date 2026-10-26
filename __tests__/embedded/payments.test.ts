import { beforeEach, describe, expect, it, vi } from 'vitest';

const payments = vi.hoisted(() => ({
    requestPayment: vi.fn(),
    latestPaymentIn: vi.fn(),
    findPayment: vi.fn(),
    settlePayment: vi.fn(),
}));
vi.mock('@/lib/embedded/payments', async (original) => ({ ...(await original<typeof import('@/lib/embedded/payments')>()), ...payments }));
vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => ({}) }));

import { agentToolset } from '@/lib/embedded/agent-tools';
import { PAYMENT_PROVIDERS } from '@/lib/integrations/payment-providers';

const context = { organizationId: 'o1', projectId: 'p1', agentId: 'a1', agentName: 'Kapadoccia', surface: 'conversation' as const, conversationId: 's1' };
const call = (name: string, args: unknown) => ({ id: 'c1', name, args: JSON.stringify(args) });
const entry = { reference: 'cen_0123456789abcdef01', amount: 20000, currency: 'NGN', description: 'Deposit: table for 4', status: 'pending', link: 'https://checkout.paystack.com/x' };

describe('agent payments', () => {
    beforeEach(() => Object.values(payments).forEach((fn) => fn.mockReset()));

    it('tells each provider\'s live and test secret keys apart', () => {
        // Keys put together at runtime, so they don't read as real secrets.
        const key = (prefix: string, body: string) => `${prefix}${body}`;
        const { paystack, flutterwave, stripe } = PAYMENT_PROVIDERS;
        expect(paystack.keyMode(key('sk_live_', 'abcdefghijklmnopqrstuvwx1234'))).toBe('live');
        expect(paystack.keyMode(key('sk_test_', 'abcdefghijklmnopqrstuvwx1234'))).toBe('test');
        expect(paystack.keyMode(key('pk_live_', 'abcdefghijklmnopqrstuvwx1234'))).toBeNull();
        expect(flutterwave.keyMode(key('FLWSECK-', 'abcdefghijklmnopqrstuvwx1234-X'))).toBe('live');
        expect(flutterwave.keyMode(key('FLWSECK_TEST-', 'abcdefghijklmnopqrstuvwx1234-X'))).toBe('test');
        expect(flutterwave.keyMode(key('sk_live_', 'abcdefghijklmnopqrstuvwx1234'))).toBeNull();
        expect(stripe.keyMode(key('sk_live_', '51Habcdefghijklmnopqrstuvwxyz0123'))).toBe('live');
        expect(stripe.keyMode(key('rk_test_', '51Habcdefghijklmnopqrstuvwxyz0123'))).toBe('test');
    });

    it('offers the payment tools only when Take payments is on', () => {
        expect(agentToolset({}).has('request_payment')).toBe(false);
        const toolset = agentToolset({ system_tools: { take_payments: {} } });
        expect(toolset.has('request_payment')).toBe(true);
        expect(toolset.has('check_payment')).toBe(true);
    });

    it('sends the link, and never confirms when the link failed', async () => {
        const toolset = agentToolset({ system_tools: { take_payments: {} } });
        payments.requestPayment.mockResolvedValueOnce({ ok: true, link: 'https://checkout.paystack.com/abc', reference: entry.reference, amount: '₦20,000' });
        const sent = await toolset.run(call('request_payment', { amount: 20000, description: 'Deposit: table for 4' }), context);
        expect(sent.ok).toBe(true);
        expect(sent.output).toContain('https://checkout.paystack.com/abc');
        expect(sent.output).toContain('₦20,000');
        expect(payments.requestPayment).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1', agentId: 'a1', conversationId: 's1' }), { amount: 20000, description: 'Deposit: table for 4', email: null });

        payments.requestPayment.mockResolvedValueOnce({ ok: false, message: 'Payments aren\'t set up for this business yet.' });
        const failed = await toolset.run(call('request_payment', { amount: 20000, description: 'Deposit' }), context);
        expect(failed.ok).toBe(false);
        expect(failed.output).toMatch(/Don't confirm/);

        expect((await toolset.run(call('request_payment', { description: 'x' }), context)).output).toMatch(/amount/);
    });

    it('checks the latest payment in the conversation', async () => {
        const toolset = agentToolset({ system_tools: { take_payments: {} } });
        payments.latestPaymentIn.mockResolvedValue({ connection: { projectId: 'p1' }, payment: entry });
        payments.settlePayment.mockResolvedValueOnce({ ...entry, status: 'paid' });
        expect((await toolset.run(call('check_payment', {}), context)).output).toMatch(/^Paid: ₦20,000/);
        payments.settlePayment.mockResolvedValueOnce(entry);
        expect((await toolset.run(call('check_payment', {}), context)).output).toMatch(/Not paid yet/);
        payments.latestPaymentIn.mockResolvedValue({ connection: { projectId: 'other' }, payment: entry });
        expect((await toolset.run(call('check_payment', {}), context)).ok).toBe(false);
    });
});
