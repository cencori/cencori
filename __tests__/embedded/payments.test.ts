import { beforeEach, describe, expect, it, vi } from 'vitest';

const payments = vi.hoisted(() => ({
    requestPayment: vi.fn(),
    latestPaymentIn: vi.fn(),
    findPayment: vi.fn(),
    settlePayment: vi.fn(),
    // A payment provider is connected unless a test says otherwise.
    getPaymentsConnection: vi.fn(async () => ({ id: 'conn' }) as unknown),
    customerOf: vi.fn(async () => ({ label: null, number: null })),
}));
const transfers = vi.hoisted(() => ({
    getTransfers: vi.fn(async () => null as unknown),
    startTransfer: vi.fn(),
    latestTransferIn: vi.fn(async () => null as unknown),
    claimTransfer: vi.fn(),
}));
vi.mock('@/lib/embedded/payments', async (original) => ({ ...(await original<typeof import('@/lib/embedded/payments')>()), ...payments }));
vi.mock('@/lib/embedded/transfers', () => transfers);
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

describe('pay by transfer', () => {
    const toolset = agentToolset({}, { takesTransfers: true });
    const context = { projectId: 'p1', organizationId: 'o1', agentId: 'a1', surface: 'conversation', conversationId: 's1' } as never;

    it('switches the payment tools on for a business that takes transfers', () => {
        expect(toolset.has('request_payment')).toBe(true);
        expect(toolset.has('check_payment')).toBe(true);
        expect(agentToolset({}).has('request_payment')).toBe(false);
    });

    it('gives the account instead of a link when no provider is connected', async () => {
        payments.getPaymentsConnection.mockResolvedValueOnce(null);
        transfers.getTransfers.mockResolvedValueOnce({ id: 't' });
        transfers.startTransfer.mockResolvedValueOnce({ ok: true, reference: 'TRF-1A2B3C', amount: '₦20,000', instructions: '₦20,000 to Arcie Lounge, OPay 8012345678. Narration / description: TRF-1A2B3C' });
        const outcome = await toolset.run({ name: 'request_payment', args: JSON.stringify({ amount: 20000, description: 'Table deposit' }) } as never, context);
        expect(outcome.ok).toBe(true);
        expect(outcome.output).toContain('OPay 8012345678');
        expect(outcome.output).toContain("Don't say it's paid");
        expect(payments.requestPayment).not.toHaveBeenCalled();
    });

    it('turns "I\'ve paid" into a claim the owner confirms, never a confirmation', async () => {
        const transfer = { reference: 'TRF-1A2B3C', amount: 20000, currency: 'NGN', description: 'Table deposit', status: 'awaiting', created_at: new Date().toISOString() };
        transfers.latestTransferIn.mockResolvedValueOnce({ connection: { id: 't' }, transfer });
        payments.latestPaymentIn.mockResolvedValueOnce(null);
        const outcome = await toolset.run({ name: 'check_payment', args: '{}' } as never, context);
        expect(transfers.claimTransfer).toHaveBeenCalled();
        expect(outcome.output).toContain("don't say it's paid yet");
    });
});
