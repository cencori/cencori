import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, invalidateCreditsBalance, setCachedCreditsBalance } = vi.hoisted(() => ({
  rpc: vi.fn(),
  invalidateCreditsBalance: vi.fn().mockResolvedValue(undefined),
  setCachedCreditsBalance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  createAdminClient: () => ({ rpc }),
}));
vi.mock('@/lib/config-cache', () => ({
  getCachedCreditsBalance: vi.fn().mockResolvedValue(null),
  invalidateCreditsBalance,
  setCachedCreditsBalance,
}));

import { deductCredits } from '@/lib/credits';

describe('credit deduction cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates rather than caching an RPC result that can arrive out of order', async () => {
    rpc.mockResolvedValue({ data: [{ success: true, new_balance: 8 }], error: null });
    expect(await deductCredits('org-1', 1, 'test')).toBe(true);
    expect(invalidateCreditsBalance).toHaveBeenCalledWith('org-1');
    expect(setCachedCreditsBalance).not.toHaveBeenCalled();
  });
});
