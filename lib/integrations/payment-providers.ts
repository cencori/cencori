/**
 * Payment providers an agent can take payments through, each with the
 * business's own secret key: money goes straight to the business's account.
 * Every provider does the same three things: check a key, start a payment
 * (a hosted checkout link for an amount) and say whether it was paid.
 */

import { safeOutboundFetch } from '@/lib/security/outbound-url';

const TIMEOUT_MS = 15_000;

export type PaymentProviderId = 'paystack' | 'flutterwave' | 'stripe';

export class PaymentProviderError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

export interface StartPaymentInput {
    /** Our reference, unique per payment. */
    reference: string;
    /** In the currency's main unit (naira, dollars). */
    amount: number;
    currency: string;
    description: string;
    email: string;
    returnUrl: string;
    metadata: Record<string, string>;
}

export interface PaymentProvider {
    id: PaymentProviderId;
    name: string;
    /** Where the business finds its secret key. */
    keyHelp: string;
    keyPlaceholder: string;
    /** 'live' or 'test' for a key that looks right, null otherwise. */
    keyMode(key: string): 'live' | 'test' | null;
    /** Checks the key and returns the currency payments are taken in. */
    connect(key: string): Promise<{ currency: string }>;
    /** A checkout link; `providerRef` is what the provider tracks it by, when it isn't our reference. */
    start(key: string, input: StartPaymentInput): Promise<{ link: string; providerRef?: string }>;
    check(key: string, payment: { reference: string; providerRef?: string | null }): Promise<{ paid: boolean; paidAt: string | null }>;
}

async function call<T>(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; json: T | null }> {
    const response = await safeOutboundFetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const json = await response.json().catch(() => null) as T | null;
    return { ok: response.ok, status: response.status, json };
}

// ── Paystack ────────────────────────────────────────────────────────────

const paystack: PaymentProvider = {
    id: 'paystack',
    name: 'Paystack',
    keyHelp: 'In Paystack: Settings → API Keys & Webhooks. The secret key (sk_live_…, or sk_test_… to try it).',
    keyPlaceholder: 'sk_live_…',
    keyMode: (key) => (/^sk_live_[A-Za-z0-9]{20,}$/.test(key) ? 'live' : /^sk_test_[A-Za-z0-9]{20,}$/.test(key) ? 'test' : null),
    async connect(key) {
        const res = await call<{ status?: boolean; message?: string }>('https://api.paystack.co/transaction?perPage=1', { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok || !res.json?.status) throw new PaymentProviderError(res.json?.message || 'Paystack didn\'t accept that key.', res.status);
        return { currency: 'NGN' };
    },
    async start(key, input) {
        const res = await call<{ status?: boolean; message?: string; data?: { authorization_url: string } }>('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: input.email,
                amount: Math.round(input.amount * 100),
                currency: input.currency,
                reference: input.reference,
                callback_url: input.returnUrl,
                metadata: { ...input.metadata, custom_fields: [{ display_name: 'For', variable_name: 'for', value: input.description }] },
            }),
        });
        if (!res.ok || !res.json?.status || !res.json.data) throw new PaymentProviderError(res.json?.message || 'Paystack couldn\'t create the link.', res.status);
        return { link: res.json.data.authorization_url };
    },
    async check(key, payment) {
        const res = await call<{ status?: boolean; message?: string; data?: { status: string; paid_at: string | null } }>(`https://api.paystack.co/transaction/verify/${encodeURIComponent(payment.reference)}`, { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok || !res.json?.data) throw new PaymentProviderError(res.json?.message || 'Paystack couldn\'t check the payment.', res.status);
        return { paid: res.json.data.status === 'success', paidAt: res.json.data.paid_at };
    },
};

// ── Flutterwave (v3, Standard) ─────────────────────────────────────────

const flutterwave: PaymentProvider = {
    id: 'flutterwave',
    name: 'Flutterwave',
    keyHelp: 'In Flutterwave: Settings → API Keys. The secret key (FLWSECK-…, or FLWSECK_TEST-… to try it).',
    keyPlaceholder: 'FLWSECK-…',
    keyMode: (key) => (/^FLWSECK_TEST-[A-Za-z0-9]{20,}-X$/.test(key) ? 'test' : /^FLWSECK-[A-Za-z0-9]{20,}-X$/.test(key) ? 'live' : null),
    async connect(key) {
        const res = await call<{ status?: string; message?: string }>('https://api.flutterwave.com/v3/balances/NGN', { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok || res.json?.status !== 'success') throw new PaymentProviderError(res.json?.message || 'Flutterwave didn\'t accept that key.', res.status);
        return { currency: 'NGN' };
    },
    async start(key, input) {
        const res = await call<{ status?: string; message?: string; data?: { link: string } }>('https://api.flutterwave.com/v3/payments', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tx_ref: input.reference,
                amount: input.amount,
                currency: input.currency,
                redirect_url: input.returnUrl,
                customer: { email: input.email },
                customizations: { title: input.description.slice(0, 100) },
                meta: input.metadata,
            }),
        });
        if (!res.ok || res.json?.status !== 'success' || !res.json.data) throw new PaymentProviderError(res.json?.message || 'Flutterwave couldn\'t create the link.', res.status);
        return { link: res.json.data.link };
    },
    async check(key, payment) {
        const res = await call<{ status?: string; message?: string; data?: { status: string; created_at: string | null } }>(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(payment.reference)}`, { headers: { Authorization: `Bearer ${key}` } });
        // Not found (yet) means not paid.
        if (res.status === 404 || res.json?.status === 'error') return { paid: false, paidAt: null };
        if (!res.ok || !res.json?.data) throw new PaymentProviderError(res.json?.message || 'Flutterwave couldn\'t check the payment.', res.status);
        return { paid: res.json.data.status === 'successful', paidAt: res.json.data.created_at };
    },
};

// ── Stripe (Checkout Sessions) ─────────────────────────────────────────

/** Stripe currencies with no minor unit (amounts are sent whole). */
const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);

function form(values: Record<string, string>): string {
    return new URLSearchParams(values).toString();
}

const stripe: PaymentProvider = {
    id: 'stripe',
    name: 'Stripe',
    keyHelp: 'In Stripe: Developers → API keys. The secret key (sk_live_…), or a restricted key (rk_live_…) allowed to write Checkout Sessions.',
    keyPlaceholder: 'sk_live_…',
    keyMode: (key) => (/^(sk|rk)_live_[A-Za-z0-9]{24,}$/.test(key) ? 'live' : /^(sk|rk)_test_[A-Za-z0-9]{24,}$/.test(key) ? 'test' : null),
    async connect(key) {
        const res = await call<{ default_currency?: string; error?: { message?: string } }>('https://api.stripe.com/v1/account', { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) throw new PaymentProviderError(res.json?.error?.message || 'Stripe didn\'t accept that key.', res.status);
        return { currency: (res.json?.default_currency || 'usd').toUpperCase() };
    },
    async start(key, input) {
        const currency = input.currency.toLowerCase();
        const unitAmount = ZERO_DECIMAL.has(currency) ? Math.round(input.amount) : Math.round(input.amount * 100);
        const values: Record<string, string> = {
            mode: 'payment',
            success_url: input.returnUrl,
            cancel_url: input.returnUrl,
            client_reference_id: input.reference,
            customer_email: input.email,
            'line_items[0][quantity]': '1',
            'line_items[0][price_data][currency]': currency,
            'line_items[0][price_data][unit_amount]': String(unitAmount),
            'line_items[0][price_data][product_data][name]': input.description.slice(0, 250),
            'metadata[reference]': input.reference,
        };
        for (const [k, v] of Object.entries(input.metadata)) values[`metadata[${k}]`] = v;
        const res = await call<{ id?: string; url?: string; error?: { message?: string } }>('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form(values),
        });
        if (!res.ok || !res.json?.url || !res.json.id) throw new PaymentProviderError(res.json?.error?.message || 'Stripe couldn\'t create the link.', res.status);
        return { link: res.json.url, providerRef: res.json.id };
    },
    async check(key, payment) {
        if (!payment.providerRef) return { paid: false, paidAt: null };
        const res = await call<{ payment_status?: string; created?: number; error?: { message?: string } }>(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(payment.providerRef)}`, { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) throw new PaymentProviderError(res.json?.error?.message || 'Stripe couldn\'t check the payment.', res.status);
        return { paid: res.json?.payment_status === 'paid', paidAt: res.json?.payment_status === 'paid' ? new Date().toISOString() : null };
    },
};

export const PAYMENT_PROVIDERS: Record<PaymentProviderId, PaymentProvider> = { paystack, flutterwave, stripe };

export function isPaymentProvider(value: unknown): value is PaymentProviderId {
    return value === 'paystack' || value === 'flutterwave' || value === 'stripe';
}

/** For the console's catalog: providers that aren't wired up yet. */
export const UPCOMING_PAYMENT_PROVIDERS = [{ id: 'bachs', name: 'Bachs' }] as const;
