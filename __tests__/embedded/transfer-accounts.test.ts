import { describe, expect, it } from 'vitest';
import { accountsOf, type TransfersMetadata } from '@/lib/embedded/transfers';

const meta = (extra: Partial<TransfersMetadata> = {}): TransfersMetadata => ({ kind: 'bank_transfer', account: { bank: 'OPay', account_number: '7085231045', account_name: 'Tolu' }, currency: 'NGN', transfers: [], updated_at: '', ...extra });

describe('several transfer accounts', () => {
    it('reads one account saved before there could be more as the main one', () => {
        expect(accountsOf(meta())).toEqual([{ bank: 'OPay', account_number: '7085231045', account_name: 'Tolu', id: 'a_main' }]);
        expect(accountsOf(null)).toEqual([]);
    });
    it('keeps the list, main first', () => {
        const accounts = [{ id: 'a_1', bank: 'GTBank', account_number: '0123456789', account_name: 'Tolu Ltd' }, { id: 'a_2', bank: 'OPay', account_number: '7085231045', account_name: 'Tolu' }];
        expect(accountsOf(meta({ accounts }))[0].id).toBe('a_1');
    });
});
