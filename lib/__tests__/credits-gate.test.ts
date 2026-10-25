import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getCachedCreditsBalance } = vi.hoisted(() => ({ getCachedCreditsBalance: vi.fn() }));

vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/config-cache', () => ({
  getCachedCreditsBalance,
  invalidateCreditsBalance: vi.fn(),
  setCachedCreditsBalance: vi.fn().mockResolvedValue(undefined),
}));

async function load() {
  vi.resetModules();
  return import('@/lib/credits');
}

describe('getCreditsBalanceForGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getCachedCreditsBalance.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('reuses a healthy balance for a few seconds, then reads again', async () => {
    const { getCreditsBalanceForGate } = await load();
    getCachedCreditsBalance.mockResolvedValueOnce(25).mockResolvedValueOnce(24);
    expect(await getCreditsBalanceForGate('org')).toBe(25);
    expect(await getCreditsBalanceForGate('org')).toBe(25);
    expect(getCachedCreditsBalance).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_001);
    expect(await getCreditsBalanceForGate('org')).toBe(24);
    expect(getCachedCreditsBalance).toHaveBeenCalledTimes(2);
  });

  it('always reads fresh when the balance is low', async () => {
    const { getCreditsBalanceForGate } = await load();
    getCachedCreditsBalance.mockResolvedValueOnce(0.5).mockResolvedValueOnce(0);
    expect(await getCreditsBalanceForGate('org')).toBe(0.5);
    expect(await getCreditsBalanceForGate('org')).toBe(0);
    expect(getCachedCreditsBalance).toHaveBeenCalledTimes(2);
  });
});
