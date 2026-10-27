import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/studio/push', () => ({ pushToOwners: vi.fn(async () => undefined) }));
vi.mock('@/lib/studio/takeover', () => ({ flagNeedsOwner: vi.fn(async () => undefined) }));
vi.mock('@/lib/embedded/catalog', () => ({ markOrderPaidByTransfer: vi.fn(async () => undefined) }));

import { claimTransfer, cleanBankAccount, confirmTransfer, getTransfers, rejectTransfer, saveBankAccount, startTransfer, transferInstructions } from '@/lib/embedded/transfers';
import { pushToOwners } from '@/lib/studio/push';
import { markOrderPaidByTransfer } from '@/lib/embedded/catalog';

/** tool_connections rows and sessions, read and written the way the module does. */
function fakeDb() {
    const rows: Array<Record<string, unknown>> = [];
    const builder = (table: string) => {
        const filters: Array<[string, unknown]> = [];
        let patch: Record<string, unknown> | null = null;
        let insert: Record<string, unknown> | null = null;
        const matches = () => rows.filter((row) => row.__table === table && filters.every(([key, value]) => row[key] === value));
        const run = () => {
            if (insert) {
                const row = { __table: table, id: `row${rows.length + 1}`, created_at: new Date().toISOString(), ...insert };
                rows.push(row);
                return [row];
            }
            if (patch) {
                for (const row of matches()) Object.assign(row, patch);
            }
            return matches();
        };
        const chain: Record<string, unknown> = {
            select: () => chain,
            eq: (key: string, value: unknown) => { filters.push([key, value]); return chain; },
            order: () => chain,
            limit: () => chain,
            update: (value: Record<string, unknown>) => { patch = value; return chain; },
            insert: (value: Record<string, unknown>) => { insert = value; return chain; },
            maybeSingle: async () => ({ data: run()[0] ?? null }),
            single: async () => ({ data: run()[0] ?? null }),
            then: (resolve: (value: unknown) => void) => resolve({ data: run(), error: null }),
        };
        return chain;
    };
    return { db: { from: builder } as never, rows };
}

const ACCOUNT = { bank: 'OPay', account_number: '8012345678', account_name: 'Arcie Lounge' };

describe('bank account', () => {
    it('takes a ten-digit account with a bank and a name', () => {
        expect(cleanBankAccount({ bank: ' OPay ', account_number: '801 234 5678', account_name: 'Arcie Lounge' })).toEqual({ ok: true, account: ACCOUNT });
        expect(cleanBankAccount({ bank: 'OPay', account_number: '12345', account_name: 'X Y' }).ok).toBe(false);
        expect(cleanBankAccount({ bank: '', account_number: '8012345678', account_name: 'X Y' }).ok).toBe(false);
    });

    it('tells the customer where to send it and what to write', () => {
        expect(transferInstructions(ACCOUNT, '₦20,000', 'TRF-1A2B3C')).toBe('₦20,000 to Arcie Lounge, OPay 8012345678. Narration / description: TRF-1A2B3C');
    });
});

describe('a transfer, start to finish', () => {
    it('asks, hears "I paid", alerts the owner once, and confirms', async () => {
        const { db } = fakeDb();
        await saveBankAccount(db, 'p1', ACCOUNT);
        const started = await startTransfer({ db, projectId: 'p1', agentId: 'a1', conversationId: 's1' }, { amount: 20000, description: 'Order ORD-1', orderId: 'ORD-1', customer: 'Tolu · +2348012345678' });
        expect(started).toMatchObject({ ok: true, amount: '₦20,000' });
        const reference = (started as { reference: string }).reference;
        expect(reference).toMatch(/^TRF-[0-9A-F]{6}$/);

        let connection = (await getTransfers(db, 'p1'))!;
        let transfer = connection.metadata.transfers[0];
        await claimTransfer(db, connection, transfer);
        connection = (await getTransfers(db, 'p1'))!;
        transfer = connection.metadata.transfers[0];
        expect(transfer.status).toBe('claimed');
        // A second "I paid" doesn't alert again.
        await claimTransfer(db, connection, transfer);
        expect(pushToOwners).toHaveBeenCalledTimes(1);

        // Not there yet, then there.
        await rejectTransfer(db, 'p1', reference);
        expect((await getTransfers(db, 'p1'))!.metadata.transfers[0].status).toBe('awaiting');
        const confirmed = await confirmTransfer(db, 'p1', reference);
        expect(confirmed?.status).toBe('paid');
        expect(markOrderPaidByTransfer).toHaveBeenCalledWith(db, 'p1', 'ORD-1', expect.any(String));
        expect((await confirmTransfer(db, 'p1', reference))?.status).toBe('paid');
    });

    it("doesn't start one when the business hasn't added an account", async () => {
        const { db } = fakeDb();
        expect(await startTransfer({ db, projectId: 'p1', agentId: 'a1' }, { amount: 5000, description: 'Deposit' })).toMatchObject({ ok: false });
    });
});
