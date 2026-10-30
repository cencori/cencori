import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: vi.fn() }));
const access = vi.hoisted(() => ({ result: null as unknown }));
vi.mock('@/lib/require-project-access', () => ({ requireProjectAccess: vi.fn(async () => access.result) }));
const finishSignup = vi.hoisted(() => vi.fn());
vi.mock('@/lib/channels/whatsapp-signup', async (original) => ({ ...(await original<object>()), finishSignup }));

import { signState } from '@/lib/channels/whatsapp-signup';
import { appReturn, openHandoff, sealHandoff } from '@/app/api/studio/whatsapp/shared';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { GET as callback } from '@/app/api/studio/whatsapp/callback/route';
import { POST as finish } from '@/app/api/studio/whatsapp/finish/route';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const AGENT = '22222222-2222-4222-8222-222222222222';
const OWNER = '33333333-3333-4333-8333-333333333333';
const STRANGER = '44444444-4444-4444-8444-444444444444';
const ORG = '55555555-5555-4555-8555-555555555555';

const appState = () => signState({ p: PROJECT, a: AGENT, u: OWNER, c: true, m: 'app' });
const callbackRequest = (query: string) => new NextRequest(`https://studio.cencori.com/api/studio/whatsapp/callback?${query}`, { headers: { host: 'studio.cencori.com' } });
const finishRequest = (handoff: unknown) => new NextRequest('https://studio.cencori.com/api/studio/whatsapp/finish', { method: 'POST', body: JSON.stringify({ handoff }) });
const handoffFrom = (location: string | null) => new URL(location!).searchParams.get('handoff');

/** An admin client whose every query resolves to `rows[table]`. */
function fakeDb(rows: Record<string, unknown>) {
    return {
        from: (table: string) => {
            const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: rows[table] ?? null }) };
            return query;
        },
    };
}

beforeEach(() => {
    vi.stubEnv('META_APP_SECRET', 'test-secret');
    vi.stubEnv('STUDIO_APP_SCHEME', '');
    finishSignup.mockReset();
    vi.mocked(createAdminClient).mockReturnValue(fakeDb({
        agents: { id: AGENT, name: 'Ada' },
        organizations: { owner_id: OWNER, subscription_tier: 'free' },
        organization_members: { role: 'owner' },
    }) as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('the handoff', () => {
    it('opens to what was sealed', () => {
        const handoff = { code: 'meta-code', state: 'signed', redirectUri: 'https://studio.cencori.com/api/studio/whatsapp/callback' };
        expect(openHandoff(sealHandoff(handoff))).toEqual(handoff);
    });

    it('doesn\'t show Meta\'s code in the link', () => {
        expect(sealHandoff({ code: 'meta-code', state: 's', redirectUri: 'r' })).not.toContain('meta-code');
    });

    it('refuses one that was changed, expired, or sealed with another secret', () => {
        const sealed = sealHandoff({ code: 'c', state: 's', redirectUri: 'r' }, 0)!;
        expect(openHandoff(sealed, 10 * 60_000 + 1)).toBeNull();
        const fresh = sealHandoff({ code: 'c', state: 's', redirectUri: 'r' })!;
        expect(openHandoff(`${fresh.slice(0, -2)}AA`)).toBeNull();
        vi.stubEnv('META_APP_SECRET', 'another');
        expect(openHandoff(fresh)).toBeNull();
        expect(openHandoff(42)).toBeNull();
    });

    it('goes back to the app\'s scheme', () => {
        expect(appReturn('failed', 'Nope')).toBe('cencori-studio://whatsapp?outcome=failed&message=Nope');
        vi.stubEnv('STUDIO_APP_SCHEME', 'mybrand');
        expect(appReturn('handoff', 'abc')).toBe('mybrand://whatsapp?outcome=handoff&handoff=abc');
    });
});

describe('connecting from the app', () => {
    it('sends Meta\'s code back to the app without needing a browser sign-in', async () => {
        access.result = { ok: false, response: new Response(null, { status: 401 }) };
        const response = await callback(callbackRequest(`code=meta-code&state=${appState()}`));
        const location = response.headers.get('location')!;
        expect(location.startsWith('cencori-studio://whatsapp?outcome=handoff')).toBe(true);
        expect(openHandoff(handoffFrom(location))?.code).toBe('meta-code');
        expect(finishSignup).not.toHaveBeenCalled();
    });

    it('tells the app when it was cancelled', async () => {
        const response = await callback(callbackRequest(`error_reason=user_denied&state=${appState()}`));
        expect(response.headers.get('location')).toContain('outcome=failed');
    });

    it('connects for the person who started, signed in to the app', async () => {
        const location = (await callback(callbackRequest(`code=meta-code&state=${appState()}`))).headers.get('location');
        access.result = { ok: true, userId: OWNER, organizationId: ORG, role: 'owner', subscriptionTier: 'free' };
        finishSignup.mockResolvedValue({ ok: true, channel: {} });
        const response = await finish(finishRequest(handoffFrom(location)));
        expect(response.status).toBe(200);
        expect(finishSignup).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            projectId: PROJECT, agentId: AGENT, code: 'meta-code', redirectUri: 'https://studio.cencori.com/api/studio/whatsapp/callback',
        }));
    });

    it('connects nothing for someone else who was sent the link', async () => {
        const location = (await callback(callbackRequest(`code=meta-code&state=${appState()}`))).headers.get('location');
        access.result = { ok: true, userId: STRANGER, organizationId: ORG, role: 'owner', subscriptionTier: 'free' };
        const response = await finish(finishRequest(handoffFrom(location)));
        expect(response.status).toBe(403);
        expect(finishSignup).not.toHaveBeenCalled();
    });

    it('refuses a handoff made up by the app', async () => {
        access.result = { ok: true, userId: OWNER, organizationId: ORG, role: 'owner', subscriptionTier: 'free' };
        expect((await finish(finishRequest('made-up'))).status).toBe(400);
        // A web signup's state can't be finished from the app either.
        const webState = signState({ p: PROJECT, a: AGENT, u: OWNER, c: true });
        expect((await finish(finishRequest(sealHandoff({ code: 'c', state: webState, redirectUri: 'r' })))).status).toBe(400);
        expect(finishSignup).not.toHaveBeenCalled();
    });
});

describe('connecting from the web', () => {
    it('still needs the same person signed in to the browser', async () => {
        access.result = { ok: true, userId: STRANGER, organizationId: ORG, role: 'owner', subscriptionTier: 'free' };
        const webState = signState({ p: PROJECT, a: AGENT, u: OWNER, c: true });
        const response = await callback(callbackRequest(`code=meta-code&state=${webState}`));
        expect(response.headers.get('location')).toContain('https://studio.cencori.com/?whatsapp=failed');
        expect(finishSignup).not.toHaveBeenCalled();
    });

    it('connects for them and goes back to Studio', async () => {
        access.result = { ok: true, userId: OWNER, organizationId: ORG, role: 'owner', subscriptionTier: 'free' };
        finishSignup.mockResolvedValue({ ok: true, channel: {} });
        const webState = signState({ p: PROJECT, a: AGENT, u: OWNER, c: true, r: '/setup' });
        const response = await callback(callbackRequest(`code=meta-code&state=${webState}`));
        expect(response.headers.get('location')).toContain('/setup?whatsapp=connected');
    });
});
