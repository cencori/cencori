/**
 * Pay by transfer: for businesses that take money straight into their bank,
 * OPay, PalmPay or Moniepoint account instead of through Paystack and the like.
 *
 * - The owner adds the account once in Studio (bank, number, name): a
 *   `tool_connections` row (connector_slug 'bank_transfer'), nothing secret,
 *   with the transfers the assistant has asked for in metadata (a rolling list).
 * - When a customer is ready to pay, the assistant gives them the account, the
 *   amount and a reference (TRF-…) to put in the narration.
 * - "I've paid": the assistant marks it claimed, and the owner is told to check
 *   their account (push, and the chat shows under "Needs you"). Nothing is
 *   confirmed automatically; Cencori can't see the account.
 * - The owner confirms it in Studio: it counts in Money, an order it pays for
 *   is marked paid, and a WhatsApp customer hears it was received.
 */

import { randomBytes } from 'crypto';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { formatMoney } from '@/lib/embedded/payments';

type Admin = ReturnType<typeof createAdminClient>;

export const TRANSFERS_SLUG = 'bank_transfer';
const TRANSFERS_KEPT = 300;
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100_000_000;

export interface BankAccount {
    /** Bank or app: "GTBank", "OPay", "PalmPay", "Moniepoint". */
    bank: string;
    account_number: string;
    account_name: string;
}

export type TransferStatus = 'awaiting' | 'claimed' | 'paid' | 'cancelled';

export interface TransferEntry {
    reference: string;
    amount: number;
    currency: string;
    description: string;
    agent_id: string;
    conversation_id: string | null;
    customer: string | null;
    /** The order it pays for, when it's for one. */
    order_id: string | null;
    status: TransferStatus;
    created_at: string;
    /** When the customer said they'd sent it. */
    claimed_at: string | null;
    /** When the owner confirmed it arrived. */
    paid_at: string | null;
}

/** One of the business's accounts, with an id to edit or remove it by. */
export type StoredAccount = BankAccount & { id: string };

export interface TransfersMetadata {
    kind: 'bank_transfer';
    /** The main account: the one customers are given (and what every reader of the account uses). */
    account: BankAccount;
    /** Every account, the main one first. Absent before a business had more than one. */
    accounts?: StoredAccount[];
    currency: string;
    transfers: TransferEntry[];
    updated_at: string;
}

export interface TransfersConnection {
    id: string;
    projectId: string;
    metadata: TransfersMetadata;
}

function toConnection(row: Record<string, unknown> | null): TransfersConnection | null {
    const metadata = row?.metadata as TransfersMetadata | undefined;
    if (!row || metadata?.kind !== 'bank_transfer' || !metadata.account) return null;
    return { id: row.id as string, projectId: row.project_id as string, metadata: { ...metadata, transfers: Array.isArray(metadata.transfers) ? metadata.transfers : [] } };
}

export async function getTransfers(db: Admin, projectId: string): Promise<TransfersConnection | null> {
    const { data } = await db.from('tool_connections').select('id, project_id, metadata').eq('project_id', projectId).eq('connector_slug', TRANSFERS_SLUG).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
    return toConnection(data as Record<string, unknown> | null);
}

/** Whether customers can pay this business by transfer (the assistant's payment tools come on with it). */
export async function takesTransfers(db: Admin, projectId: string): Promise<boolean> {
    return !!(await getTransfers(db, projectId).catch(() => null));
}

const takesTransfersCache = new Map<string, { value: boolean; expiresAt: number }>();

/** takesTransfers, reused for 30 seconds: it's read on every customer turn. */
export async function takesTransfersCached(db: Admin, projectId: string): Promise<boolean> {
    const cached = takesTransfersCache.get(projectId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await takesTransfers(db, projectId);
    takesTransfersCache.set(projectId, { value, expiresAt: Date.now() + 30_000 });
    if (takesTransfersCache.size > 5_000) {
        const oldest = takesTransfersCache.keys().next().value;
        if (oldest !== undefined) takesTransfersCache.delete(oldest);
    }
    return value;
}

/** The account as typed, checked; or what's wrong with it. */
export function cleanBankAccount(input: { bank?: unknown; account_number?: unknown; account_name?: unknown }): { ok: true; account: BankAccount } | { ok: false; message: string } {
    const text = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
    const bank = text(input.bank, 60);
    const number = text(input.account_number, 20).replace(/\D/g, '');
    const name = text(input.account_name, 100);
    if (bank.length < 2) return { ok: false, message: 'Which bank or app is the account with?' };
    // Nigerian account numbers (NUBAN), OPay and PalmPay included, are ten digits.
    if (number.length !== 10) return { ok: false, message: 'The account number should be 10 digits.' };
    if (name.length < 2) return { ok: false, message: 'Add the name on the account, so customers can check it before they send.' };
    return { ok: true, account: { bank, account_number: number, account_name: name } };
}

const ACCOUNTS_MAX = 10;
const newAccountId = () => `a_${Math.random().toString(36).slice(2, 10)}`;

/** The business's accounts, the main one first (one account, from before there could be more, included). */
export function accountsOf(metadata: TransfersMetadata | null | undefined): StoredAccount[] {
    if (!metadata?.account) return [];
    if (metadata.accounts?.length) return metadata.accounts;
    return [{ ...metadata.account, id: 'a_main' }];
}

async function writeAccounts(db: Admin, projectId: string, existing: TransfersConnection | null, accounts: StoredAccount[]): Promise<TransfersConnection | null> {
    const [main] = accounts;
    const metadata: TransfersMetadata = {
        kind: 'bank_transfer',
        account: { bank: main.bank, account_number: main.account_number, account_name: main.account_name },
        accounts,
        currency: 'NGN',
        transfers: existing?.metadata.transfers ?? [],
        updated_at: new Date().toISOString(),
    };
    const write = existing
        ? db.from('tool_connections').update({ metadata }).eq('id', existing.id).select('id, project_id, metadata').single()
        : db.from('tool_connections').insert({ project_id: projectId, connector_slug: TRANSFERS_SLUG, owner_type: 'platform', status: 'active', metadata }).select('id, project_id, metadata').single();
    const { data } = await write;
    return toConnection(data as Record<string, unknown> | null);
}

/**
 * Add an account, or change one (by id). The first account is the main one;
 * `main` makes this one the main one. Up to ten.
 */
export async function saveBankAccount(db: Admin, projectId: string, account: BankAccount, opts: { id?: string; main?: boolean } = {}): Promise<TransfersConnection | { error: string } | null> {
    const existing = await getTransfers(db, projectId);
    const list = accountsOf(existing?.metadata);
    const index = opts.id ? list.findIndex((item) => item.id === opts.id) : -1;
    if (index < 0 && list.length >= ACCOUNTS_MAX) return { error: `Up to ${ACCOUNTS_MAX} accounts.` };
    const saved: StoredAccount = { ...account, id: index >= 0 ? list[index].id : newAccountId() };
    const next = index >= 0 ? list.map((item, i) => (i === index ? saved : item)) : [...list, saved];
    // The main one goes first.
    const ordered = opts.main ? [saved, ...next.filter((item) => item.id !== saved.id)] : next;
    return writeAccounts(db, projectId, existing, ordered);
}

/** Make an account the main one (the one customers are given). */
export async function setMainAccount(db: Admin, projectId: string, id: string): Promise<TransfersConnection | null> {
    const existing = await getTransfers(db, projectId);
    const list = accountsOf(existing?.metadata);
    const chosen = list.find((item) => item.id === id);
    if (!existing || !chosen) return null;
    return writeAccounts(db, projectId, existing, [chosen, ...list.filter((item) => item.id !== id)]);
}

/** Remove one account; removing the last one stops transfers. A removed main account hands over to the next. */
export async function removeAccount(db: Admin, projectId: string, id: string): Promise<TransfersConnection | null> {
    const existing = await getTransfers(db, projectId);
    const rest = accountsOf(existing?.metadata).filter((item) => item.id !== id);
    if (!existing) return null;
    if (!rest.length) {
        await removeBankAccount(db, projectId);
        return null;
    }
    return writeAccounts(db, projectId, existing, rest);
}

/** Stop offering transfers. The history stays (Money still counts what came in). */
export async function removeBankAccount(db: Admin, projectId: string): Promise<void> {
    await db.from('tool_connections').update({ status: 'revoked' }).eq('project_id', projectId).eq('connector_slug', TRANSFERS_SLUG).eq('status', 'active');
}

/** Paid transfers, for Money and Sales (whether or not transfers are still on). */
export async function transferHistory(db: Admin, projectId: string): Promise<TransferEntry[]> {
    const { data } = await db.from('tool_connections').select('metadata').eq('project_id', projectId).eq('connector_slug', TRANSFERS_SLUG).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const transfers = (data?.metadata as TransfersMetadata | undefined)?.transfers;
    return Array.isArray(transfers) ? transfers : [];
}

/** Change the transfers list, re-reading it first so concurrent writes aren't lost. */
async function updateTransfers(db: Admin, connectionId: string, change: (transfers: TransferEntry[]) => TransferEntry[]): Promise<void> {
    const { data } = await db.from('tool_connections').select('metadata').eq('id', connectionId).maybeSingle();
    const metadata = data?.metadata as TransfersMetadata | undefined;
    if (!metadata) return;
    const transfers = change(Array.isArray(metadata.transfers) ? metadata.transfers : []).slice(-TRANSFERS_KEPT);
    await db.from('tool_connections').update({ metadata: { ...metadata, transfers } }).eq('id', connectionId);
}

/** What the customer is told: where to send it, how much, and what to write. */
export function transferInstructions(account: BankAccount, amount: string, reference: string): string {
    return `${amount} to ${account.account_name}, ${account.bank} ${account.account_number}. Narration / description: ${reference}`;
}

interface TransferContext {
    db: Admin;
    projectId: string;
    agentId: string;
    conversationId?: string | null;
}

/** Ask the customer to transfer, and remember it so the owner can confirm it. */
export async function startTransfer(ctx: TransferContext, request: { amount: number; description: string; orderId?: string | null; customer?: string | null }): Promise<{ ok: true; reference: string; amount: string; instructions: string } | { ok: false; message: string }> {
    const connection = await getTransfers(ctx.db, ctx.projectId);
    if (!connection) return { ok: false, message: 'This business doesn\'t take transfers yet.' };
    const amount = Math.round(request.amount * 100) / 100;
    if (!(amount >= MIN_AMOUNT && amount <= MAX_AMOUNT)) return { ok: false, message: 'That amount isn\'t valid.' };
    const reference = `TRF-${randomBytes(3).toString('hex').toUpperCase()}`;
    const currency = connection.metadata.currency;
    await updateTransfers(ctx.db, connection.id, (transfers) => [...transfers, {
        reference,
        amount,
        currency,
        description: request.description.slice(0, 200),
        agent_id: ctx.agentId,
        conversation_id: ctx.conversationId ?? null,
        customer: request.customer ?? null,
        order_id: request.orderId ?? null,
        status: 'awaiting',
        created_at: new Date().toISOString(),
        claimed_at: null,
        paid_at: null,
    }]);
    const formatted = formatMoney(amount, currency);
    return { ok: true, reference, amount: formatted, instructions: transferInstructions(connection.metadata.account, formatted, reference) };
}

/** The latest transfer asked for in a conversation, for "I've paid". */
export async function latestTransferIn(db: Admin, projectId: string, conversationId: string | null | undefined): Promise<{ connection: TransfersConnection; transfer: TransferEntry } | null> {
    if (!conversationId) return null;
    const connection = await getTransfers(db, projectId);
    const transfer = connection?.metadata.transfers.filter((t) => t.conversation_id === conversationId && t.status !== 'cancelled').at(-1);
    return connection && transfer ? { connection, transfer } : null;
}

/**
 * The customer says they've sent it: mark it claimed and ask the owner to
 * check their account. Only the first claim alerts the owner.
 */
export async function claimTransfer(db: Admin, connection: TransfersConnection, transfer: TransferEntry, opts: { preview?: boolean } = {}): Promise<TransferEntry> {
    if (transfer.status !== 'awaiting') return transfer;
    const claimedAt = new Date().toISOString();
    let claimed = false;
    await updateTransfers(db, connection.id, (transfers) => transfers.map((t) => {
        if (t.reference !== transfer.reference || t.status !== 'awaiting') return t;
        claimed = true;
        return { ...t, status: 'claimed', claimed_at: claimedAt };
    }));
    const updated: TransferEntry = { ...transfer, status: 'claimed', claimed_at: claimedAt };
    if (claimed && !opts.preview) {
        const amount = formatMoney(transfer.amount, transfer.currency);
        const who = transfer.customer?.split(/[·,]/)[0]?.trim() || 'A customer';
        const [{ pushToOwners }, { flagNeedsOwner }] = await Promise.all([import('@/lib/studio/push'), import('@/lib/studio/takeover')]);
        await Promise.allSettled([
            pushToOwners(db, connection.projectId, { title: `${who} says they've paid ${amount}`, body: `By transfer, for ${transfer.description}. Check your account, then confirm it in Studio.`, url: '/money', tag: `transfer-${transfer.reference}` }),
            flagNeedsOwner(db, transfer.conversation_id, `Says they've paid ${amount} by transfer (${transfer.reference}). Check your account, then confirm it in Money.`),
        ]);
    }
    return updated;
}

/**
 * The owner saw the money: mark it paid, mark the order it was for paid, and
 * thank a WhatsApp customer. Safe to call twice.
 */
export async function confirmTransfer(db: Admin, projectId: string, reference: string): Promise<TransferEntry | null> {
    const connection = await getTransfers(db, projectId) ?? await anyTransfers(db, projectId);
    const transfer = connection?.metadata.transfers.find((t) => t.reference === reference);
    if (!connection || !transfer || transfer.status === 'cancelled') return null;
    if (transfer.status === 'paid') return transfer;
    const paidAt = new Date().toISOString();
    let confirmed = false;
    await updateTransfers(db, connection.id, (transfers) => transfers.map((t) => {
        if (t.reference !== reference || t.status === 'paid' || t.status === 'cancelled') return t;
        confirmed = true;
        return { ...t, status: 'paid', paid_at: paidAt };
    }));
    const paid: TransferEntry = { ...transfer, status: 'paid', paid_at: paidAt };
    if (confirmed) {
        if (transfer.order_id?.startsWith('EVT-')) {
            // Event tickets: paid, and the buyer gets them.
            const { markTicketsPaid } = await import('@/lib/studio/events');
            await markTicketsPaid(db, { orderRef: transfer.order_id });
        } else if (transfer.order_id) {
            const { markOrderPaidByTransfer } = await import('./catalog');
            await markOrderPaidByTransfer(db, projectId, transfer.order_id, paidAt);
        }
        await Promise.allSettled([thankCustomer(db, paid), clearNeedsOwner(db, transfer.conversation_id)]);
    }
    return paid;
}

/** The owner checked and it hasn't arrived: back to waiting, so the customer can say so again. */
export async function rejectTransfer(db: Admin, projectId: string, reference: string): Promise<TransferEntry | null> {
    const connection = await getTransfers(db, projectId) ?? await anyTransfers(db, projectId);
    const transfer = connection?.metadata.transfers.find((t) => t.reference === reference);
    if (!connection || !transfer || transfer.status !== 'claimed') return transfer ?? null;
    await updateTransfers(db, connection.id, (transfers) => transfers.map((t) => (t.reference === reference && t.status === 'claimed' ? { ...t, status: 'awaiting', claimed_at: null } : t)));
    await clearNeedsOwner(db, transfer.conversation_id).catch(() => undefined);
    return { ...transfer, status: 'awaiting', claimed_at: null };
}

/** The transfers row even after transfers were turned off, so old claims can still be settled. */
async function anyTransfers(db: Admin, projectId: string): Promise<TransfersConnection | null> {
    const { data } = await db.from('tool_connections').select('id, project_id, metadata').eq('project_id', projectId).eq('connector_slug', TRANSFERS_SLUG).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return toConnection(data as Record<string, unknown> | null);
}

async function clearNeedsOwner(db: Admin, conversationId: string | null): Promise<void> {
    if (!conversationId) return;
    const { data } = await db.from('sessions').select('metadata').eq('id', conversationId).maybeSingle();
    const metadata = (data?.metadata ?? {}) as Record<string, unknown> & { needs_owner?: { reason?: string } | null };
    // Only the transfer's own flag; a hand-off asked for since stays.
    if (!metadata.needs_owner?.reason?.includes('by transfer')) return;
    await db.from('sessions').update({ metadata: { ...metadata, needs_owner: null } }).eq('id', conversationId);
}

/** "Payment received" in the customer's WhatsApp chat, when it came from one. Best-effort. */
async function thankCustomer(db: Admin, transfer: TransferEntry): Promise<void> {
    if (!transfer.conversation_id) return;
    const { data } = await db.from('sessions').select('metadata').eq('id', transfer.conversation_id).maybeSingle();
    const meta = (data?.metadata ?? {}) as { source?: string; channel_id?: string; customer_number?: string };
    if (meta.source !== 'whatsapp' || !meta.channel_id || !meta.customer_number) return;
    const [{ getChannelById, channelAccessToken, sendText }, { decryptApiKey }] = await Promise.all([import('@/lib/channels/whatsapp'), import('@/lib/encryption')]);
    const channel = await getChannelById(db, meta.channel_id);
    if (!channel) return;
    const { data: project } = await db.from('projects').select('organization_id').eq('id', channel.projectId).maybeSingle();
    const organizationId = (project?.organization_id as string | undefined) ?? '';
    const token = channelAccessToken(channel, (value) => {
        try {
            return decryptApiKey(value, organizationId);
        } catch {
            return null;
        }
    });
    if (!token) return;
    await sendText(channel, token, meta.customer_number, `Payment received: ${formatMoney(transfer.amount, transfer.currency)} for ${transfer.description}. Thank you!`);
}
