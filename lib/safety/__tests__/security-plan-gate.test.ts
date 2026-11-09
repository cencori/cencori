import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/config-cache', () => ({
    getCachedSecurityConfig: vi.fn(async () => ({ data: { enabled: true, filterPII: true } })),
    setCachedSecurityConfig: vi.fn(),
}));

import { getProjectSecurityConfig } from '../utils';

let n = 0;
/** A fake admin client whose project belongs to an org on `tier` (or a failing read). */
function client(org: Record<string, string | null> | 'error' | null) {
    return {
        from: () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => {
                        if (org === 'error') throw new Error('db down');
                        return { data: org ? { organizations: org } : null, error: null };
                    },
                }),
            }),
        }),
    } as never;
}

describe('security is Pro only', () => {
    beforeEach(() => { n++; });

    it('turns scanning off for Free, even when the project switched it on', async () => {
        expect(await getProjectSecurityConfig(client({ subscription_tier: 'free', account_type: 'developer' }), `p${n}`)).toEqual({ enabled: false, filterPII: false });
    });

    it('keeps the project setting on Pro, Enterprise and business accounts', async () => {
        expect(await getProjectSecurityConfig(client({ subscription_tier: 'pro', account_type: 'developer' }), `p${n}a`)).toEqual({ enabled: true, filterPII: true });
        expect(await getProjectSecurityConfig(client({ subscription_tier: 'enterprise', account_type: 'developer' }), `p${n}b`)).toEqual({ enabled: true, filterPII: true });
        expect(await getProjectSecurityConfig(client({ subscription_tier: 'free', account_type: 'business' }), `p${n}c`)).toEqual({ enabled: true, filterPII: true });
    });

    it('ignores a placeholder tier from the caller and reads the real plan', async () => {
        expect(await getProjectSecurityConfig(client({ subscription_tier: 'pro', account_type: 'developer' }), `p${n}d`, 'embedded' as never)).toEqual({ enabled: true, filterPII: true });
    });

    it('never switches protection off because a read failed', async () => {
        expect(await getProjectSecurityConfig(client('error'), `p${n}e`)).toEqual({ enabled: true, filterPII: true });
    });
});
