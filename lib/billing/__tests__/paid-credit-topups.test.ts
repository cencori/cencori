import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invalidateCreditsBalance } = vi.hoisted(() => ({
  invalidateCreditsBalance: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/config-cache', () => ({ invalidateCreditsBalance }));

import { CREDIT_TOPUP_PACKS, netCreditsAfterFee } from '@/lib/bachsClient';
import { applyPaidCreditTopup } from '@/lib/billing/paid-credit-topups';

describe('paid credit top-ups', () => {
  beforeEach(() => invalidateCreditsBalance.mockClear());
  it('uses dollar-denominated wallet credits, not token-sized units', () => {
    expect(CREDIT_TOPUP_PACKS.map((pack) => pack.credits)).toEqual([10, 50, 200]);
    expect(CREDIT_TOPUP_PACKS.map((pack) => pack.credits)).toEqual(
      CREDIT_TOPUP_PACKS.map((pack) => pack.price / 100),
    );
    expect(CREDIT_TOPUP_PACKS.map((pack) => netCreditsAfterFee(pack.credits)))
      .toEqual([9.45, 47.25, 189]);
  });

  it('passes the verified payment reference to an atomic idempotent grant', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ applied: true, new_balance: 9.45 }], error: null,
    });
    await expect(applyPaidCreditTopup({
      supabase: { rpc } as never,
      provider: 'bachs',
      paymentReference: 'charge-1',
      organizationId: 'org-1',
      amountUsd: 9.45,
    })).resolves.toEqual({ applied: true, newBalance: 9.45 });
    expect(rpc).toHaveBeenCalledWith('apply_paid_credit_topup', expect.objectContaining({
      p_provider: 'bachs',
      p_payment_reference: 'charge-1',
      p_amount: 9.45,
    }));
    expect(invalidateCreditsBalance).toHaveBeenCalledWith('org-1');
  });

  it('treats a duplicate payment as already applied', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ applied: false, new_balance: 9.45 }], error: null,
    });
    await expect(applyPaidCreditTopup({
      supabase: { rpc } as never,
      provider: 'coincircuit',
      paymentReference: 'session-1',
      organizationId: 'org-1',
      amountUsd: 9.35,
    })).resolves.toEqual({ applied: false, newBalance: 9.45 });
  });

  it('fails closed when the atomic grant is unavailable', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'function missing' } });
    await expect(applyPaidCreditTopup({
      supabase: { rpc } as never,
      provider: 'bachs',
      paymentReference: 'charge-1',
      organizationId: 'org-1',
      amountUsd: 9.45,
    })).rejects.toThrow('function missing');
    expect(invalidateCreditsBalance).not.toHaveBeenCalledWith('org-1');
  });
});
