/**
 * Agents taking payments (deposits, event tables, orders) through the
 * business's own payment provider account (Paystack, Flutterwave, Stripe).
 *
 * - The business connects a provider once with its secret key (project-level,
 *   shared by its agents): a `tool_connections` row, key encrypted, with the
 *   payments it has started in metadata (a rolling list).
 * - The agent sends a payment link (request_payment). The provider sends the
 *   customer's browser back to /api/payments/return after paying: Cencori
 *   checks it with the provider, then tells the customer (on WhatsApp) and the
 *   owner (email). check_payment and a background sweep catch customers who
 *   close the page before returning.
 */

import { randomBytes } from 'crypto';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { decryptApiKey, encryptApiKey } from '@/lib/encryption';
import { getMainSiteUrl } from '@/lib/main-site-url';
import { PAYMENT_PROVIDERS, PaymentProviderError, type PaymentProviderId } from '@/lib/integrations/payment-providers';

type Admin = ReturnType<typeof createAdminClient>;

export const PAYMENTS_SLUG = 'payments';
const PAYMENTS_KEPT = 300;
/** Unpaid links stop being checked after this. */
const PAYMENT_WINDOW_MS = 24 * 3_600_000;
/** Sanity bounds on one payment, in the currency's main unit. */
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100_000_000;

export interface PaymentEntry {
    reference: string;
    /** The provider's own id for it, when that isn't our reference (Stripe's session). */
    provider_ref?: string | null;
    amount: number;
    currency: string;
    description: string;
    agent_id: string;
    conversation_id: string | null;
    customer: string | null;
    status: 'pending' | 'paid' | 'expired';
    created_at: string;
    paid_at: string | null;
    link: string;
}

export interface PaymentsMetadata {
    kind: 'payments';
    provider: PaymentProviderId;
    mode: 'live' | 'test';
    currency: string;
    connected_at: string;
    payments: PaymentEntry[];
}

export interface PaymentsConnection {
    id: string;
    projectId: string;
    keyEncrypted: string;
    metadata: PaymentsMetadata;
}

const COLUMNS = 'id, project_id, encrypted_access_ref, metadata';

function toConnection(row: Record<string, unknown> | null): PaymentsConnection | null {
    const metadata = row?.metadata as PaymentsMetadata | undefined;
    if (!row || metadata?.kind !== 'payments' || !row.encrypted_access_ref) return null;
    return { id: row.id as string, projectId: row.project_id as string, keyEncrypted: row.encrypted_access_ref as string, metadata: { ...metadata, payments: Array.isArray(metadata.payments) ? metadata.payments : [] } };
}

export async function getPaymentsConnection(db: Admin, projectId: string): Promise<PaymentsConnection | null> {
    const { data } = await db.from('tool_connections').select(COLUMNS).eq('project_id', projectId).eq('connector_slug', PAYMENTS_SLUG).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
    return toConnection(data as Record<string, unknown> | null);
}

/** What the console sees: never the key. */
export function publicPayments(connection: PaymentsConnection | null) {
    if (!connection) return null;
    const recent = connection.metadata.payments.slice(-10).reverse();
    return {
        provider: connection.metadata.provider,
        provider_name: PAYMENT_PROVIDERS[connection.metadata.provider]?.name ?? connection.metadata.provider,
        mode: connection.metadata.mode,
        currency: connection.metadata.currency,
        connected_at: connection.metadata.connected_at,
        recent: recent.map(({ reference, amount, currency, description, status, created_at, paid_at, customer, agent_id }) => ({ reference, amount, currency, description, status, created_at, paid_at, customer, agent_id })),
    };
}

export async function connectPayments(db: Admin, opts: { projectId: string; organizationId: string; provider: PaymentProviderId; secretKey: string }): Promise<{ ok: true; connection: PaymentsConnection } | { ok: false; status: number; message: string }> {
    const provider = PAYMENT_PROVIDERS[opts.provider];
    const key = opts.secretKey.trim();
    const mode = provider.keyMode(key);
    if (!mode) return { ok: false, status: 400, message: `That isn't a ${provider.name} secret key. ${provider.keyHelp}` };
    let currency: string;
    try {
        ({ currency } = await provider.connect(key));
    } catch (error) {
        return { ok: false, status: 422, message: error instanceof PaymentProviderError && error.status >= 400 && error.status < 500 ? `${provider.name} didn't accept that key.` : `Couldn't reach ${provider.name} to check the key. Try again.` };
    }
    const existing = await getPaymentsConnection(db, opts.projectId);
    const metadata: PaymentsMetadata = { kind: 'payments', provider: opts.provider, mode, currency, connected_at: new Date().toISOString(), payments: existing?.metadata.payments ?? [] };
    const row = {
        project_id: opts.projectId,
        connector_slug: PAYMENTS_SLUG,
        owner_type: 'platform',
        status: 'active',
        encrypted_access_ref: encryptApiKey(key, opts.organizationId),
        key_hint: `${key.slice(0, 8)}…${key.slice(-4)}`,
        metadata,
        last_error: null,
    };
    const write = existing
        ? db.from('tool_connections').update(row).eq('id', existing.id).select(COLUMNS).single()
        : db.from('tool_connections').insert(row).select(COLUMNS).single();
    const { data, error } = await write;
    const connection = toConnection(data as Record<string, unknown> | null);
    if (error || !connection) return { ok: false, status: 502, message: 'Couldn\'t save the key. Try again.' };
    return { ok: true, connection };
}

export async function disconnectPayments(db: Admin, projectId: string): Promise<void> {
    await db.from('tool_connections').update({ status: 'revoked', encrypted_access_ref: null }).eq('project_id', projectId).eq('connector_slug', PAYMENTS_SLUG).eq('status', 'active');
}

async function organizationOf(db: Admin, projectId: string): Promise<string> {
    const { data } = await db.from('projects').select('organization_id').eq('id', projectId).maybeSingle();
    return (data?.organization_id as string | undefined) ?? '';
}

async function secretKeyOf(db: Admin, connection: PaymentsConnection): Promise<string> {
    return decryptApiKey(connection.keyEncrypted, await organizationOf(db, connection.projectId));
}

/** Change one payment in the list, re-reading it first so concurrent writes aren't lost. */
async function updatePayments(db: Admin, connectionId: string, change: (payments: PaymentEntry[]) => PaymentEntry[]): Promise<void> {
    const { data } = await db.from('tool_connections').select('metadata').eq('id', connectionId).maybeSingle();
    const metadata = data?.metadata as PaymentsMetadata | undefined;
    if (!metadata) return;
    const payments = change(Array.isArray(metadata.payments) ? metadata.payments : []).slice(-PAYMENTS_KEPT);
    await db.from('tool_connections').update({ metadata: { ...metadata, payments } }).eq('id', connectionId);
}

/** "₦20,000", "$25.50" */
export function formatMoney(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-NG', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString('en-NG')}`;
    }
}

interface PaymentContext {
    db: Admin;
    projectId: string;
    agentId: string;
    agentName?: string;
    surface: string;
    conversationId?: string | null;
}

/** Who's paying, from the conversation: a WhatsApp number and name when there is one. */
export async function customerOf(db: Admin, conversationId: string | null | undefined): Promise<{ label: string | null; number: string | null }> {
    if (!conversationId) return { label: null, number: null };
    const { data } = await db.from('sessions').select('metadata').eq('id', conversationId).maybeSingle();
    const meta = (data?.metadata ?? {}) as { customer_number?: string; customer_name?: string };
    const number = meta.customer_number ? `+${meta.customer_number.replace(/^\+/, '')}` : null;
    return { label: [meta.customer_name, number].filter(Boolean).join(', ') || null, number };
}

/**
 * Start a payment and hand back the link for the customer. The outcome is
 * what the agent tells them.
 */
export async function requestPayment(ctx: PaymentContext, request: { amount: number; description: string; email: string | null }): Promise<{ ok: true; link: string; reference: string; amount: string } | { ok: false; message: string }> {
    const connection = await getPaymentsConnection(ctx.db, ctx.projectId);
    if (!connection) return { ok: false, message: 'Payments aren\'t set up for this business yet.' };
    const provider = PAYMENT_PROVIDERS[connection.metadata.provider];
    const currency = connection.metadata.currency;
    const amount = Math.round(request.amount * 100) / 100;
    if (!(amount >= MIN_AMOUNT && amount <= MAX_AMOUNT)) return { ok: false, message: 'That amount isn\'t valid.' };
    const customer = await customerOf(ctx.db, ctx.conversationId);
    const reference = `cen_${randomBytes(9).toString('hex')}`;
    // Providers need an email for the receipt; without the customer's, a no-reply address stands in.
    const email = request.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email) ? request.email : `${customer.number?.replace(/\D/g, '') || 'guest'}.${reference.slice(4, 10)}@pay.cencori.com`;
    try {
        const started = await provider.start(await secretKeyOf(ctx.db, connection), {
            reference,
            amount,
            currency,
            description: request.description,
            email,
            returnUrl: `${getMainSiteUrl('/api/payments/return')}?ref=${reference}`,
            metadata: { cencori_project: ctx.projectId, cencori_agent: ctx.agentId, description: request.description.slice(0, 200) },
        });
        await updatePayments(ctx.db, connection.id, (payments) => [...payments, {
            reference,
            provider_ref: started.providerRef ?? null,
            amount,
            currency,
            description: request.description,
            agent_id: ctx.agentId,
            conversation_id: ctx.conversationId ?? null,
            customer: customer.label,
            status: 'pending',
            created_at: new Date().toISOString(),
            paid_at: null,
            link: started.link,
        }]);
        return { ok: true, link: started.link, reference, amount: formatMoney(amount, currency) };
    } catch (error) {
        console.error('[payments] start failed', connection.metadata.provider, error instanceof Error ? error.message : error);
        return { ok: false, message: `${provider.name} couldn't create the payment link right now.` };
    }
}

export async function findPayment(db: Admin, reference: string): Promise<{ connection: PaymentsConnection; payment: PaymentEntry } | null> {
    if (!/^cen_[a-f0-9]{18}$/.test(reference)) return null;
    const { data } = await db.from('tool_connections').select(COLUMNS).eq('connector_slug', PAYMENTS_SLUG).contains('metadata', { payments: [{ reference }] }).limit(1).maybeSingle();
    const connection = toConnection(data as Record<string, unknown> | null);
    const payment = connection?.metadata.payments.find((p) => p.reference === reference);
    return connection && payment ? { connection, payment } : null;
}

/**
 * Check a payment with its provider; the first time it shows paid, mark it and
 * tell the customer and the owner. Safe to call repeatedly.
 */
export async function settlePayment(db: Admin, connection: PaymentsConnection, payment: PaymentEntry): Promise<PaymentEntry> {
    if (payment.status === 'paid') return payment;
    const status = await PAYMENT_PROVIDERS[connection.metadata.provider].check(await secretKeyOf(db, connection), { reference: payment.reference, providerRef: payment.provider_ref });
    if (!status.paid) {
        if (Date.now() - new Date(payment.created_at).getTime() > PAYMENT_WINDOW_MS) {
            await updatePayments(db, connection.id, (payments) => payments.map((p) => (p.reference === payment.reference ? { ...p, status: 'expired' } : p)));
            return { ...payment, status: 'expired' };
        }
        return payment;
    }
    // Claim it: only one caller marks it paid and sends the messages.
    let claimed = false;
    await updatePayments(db, connection.id, (payments) => payments.map((p) => {
        if (p.reference !== payment.reference || p.status === 'paid') return p;
        claimed = true;
        return { ...p, status: 'paid', paid_at: status.paidAt ?? new Date().toISOString() };
    }));
    const paid: PaymentEntry = { ...payment, status: 'paid', paid_at: status.paidAt ?? new Date().toISOString() };
    if (claimed) {
        await Promise.allSettled([tellCustomer(db, paid), tellOwner(db, connection.projectId, paid)]);
    }
    return paid;
}

/** A confirmation in the customer's WhatsApp chat, when the payment came from one. */
async function tellCustomer(db: Admin, payment: PaymentEntry): Promise<void> {
    if (!payment.conversation_id) return;
    const { data } = await db.from('sessions').select('metadata').eq('id', payment.conversation_id).maybeSingle();
    const meta = (data?.metadata ?? {}) as { source?: string; channel_id?: string; customer_number?: string };
    if (meta.source !== 'whatsapp' || !meta.channel_id || !meta.customer_number) return;
    const { getChannelById, channelAccessToken, sendText } = await import('@/lib/channels/whatsapp');
    const channel = await getChannelById(db, meta.channel_id);
    if (!channel) return;
    const organizationId = await organizationOf(db, channel.projectId);
    const token = channelAccessToken(channel, (value) => {
        try {
            return decryptApiKey(value, organizationId);
        } catch {
            return null;
        }
    });
    if (!token) return;
    await sendText(channel, token, meta.customer_number, `Payment received: ${formatMoney(payment.amount, payment.currency)} for ${payment.description}. Thank you!`);
}

async function tellOwner(db: Admin, projectId: string, payment: PaymentEntry): Promise<void> {
    const [{ notifyOrder, notifyPayment }, { describeOrder, markOrderPaid }] = await Promise.all([import('./owner-alerts'), import('./catalog')]);
    const { data: agent } = await db.from('agents').select('name').eq('id', payment.agent_id).maybeSingle();
    const ctx = { db, projectId, agentId: payment.agent_id, agentName: (agent?.name as string | undefined) ?? undefined, surface: 'conversation', conversationId: payment.conversation_id };
    // A payment for event tickets: they're paid, the buyer gets them, the owner is told.
    const { markTicketsPaid } = await import('@/lib/studio/events');
    if (await markTicketsPaid(db, { paymentReference: payment.reference })) return;
    // A payment for an order: the order is marked paid and the owner gets it to fulfil.
    const order = await markOrderPaid(db, projectId, payment.reference, payment.paid_at ?? new Date().toISOString());
    if (order) return notifyOrder(ctx, describeOrder(order), true);
    await notifyPayment(ctx, {
        amount: formatMoney(payment.amount, payment.currency),
        description: payment.description,
        customer: payment.customer,
        reference: payment.reference,
    });
}

/** The latest payment started in a conversation, for "I've paid". */
export async function latestPaymentIn(db: Admin, projectId: string, conversationId: string | null | undefined): Promise<{ connection: PaymentsConnection; payment: PaymentEntry } | null> {
    if (!conversationId) return null;
    const connection = await getPaymentsConnection(db, projectId);
    const payment = connection?.metadata.payments.filter((p) => p.conversation_id === conversationId).at(-1);
    return connection && payment ? { connection, payment } : null;
}

/** Background check of unpaid links still in their window, for customers who never came back from checkout. */
export async function sweepPendingPayments(db: Admin): Promise<{ checked: number; paid: number }> {
    const { data } = await db.from('tool_connections').select(COLUMNS).eq('connector_slug', PAYMENTS_SLUG).eq('status', 'active').limit(2_000);
    let checked = 0;
    let paid = 0;
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const connection = toConnection(row);
        if (!connection) continue;
        for (const payment of connection.metadata.payments.filter((p) => p.status === 'pending')) {
            checked++;
            const result = await settlePayment(db, connection, payment).catch(() => payment);
            if (result.status === 'paid') paid++;
        }
    }
    return { checked, paid };
}
