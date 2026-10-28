import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { readState, signState, signupDialogUrl } from '@/lib/channels/whatsapp-signup';

describe('Studio WhatsApp signup (redirect version)', () => {
    beforeEach(() => {
        vi.stubEnv('META_APP_ID', '123');
        vi.stubEnv('META_APP_SECRET', 'secret');
        vi.stubEnv('META_EMBEDDED_SIGNUP_CONFIG_ID', '456');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.useRealTimers();
    });

    it('reads back a state it signed, and nothing tampered with', () => {
        const state = signState({ p: 'project', a: 'agent', u: 'user', c: true, r: '/setup' });
        expect(readState(state)).toMatchObject({ p: 'project', a: 'agent', u: 'user', c: true, r: '/setup' });

        const [body, mac] = state.split('.');
        const swapped = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), p: 'other' })).toString('base64url');
        expect(readState(`${swapped}.${mac}`)).toBeNull();
        expect(readState(`${body}.x${mac.slice(1)}`)).toBeNull();
        expect(readState(null)).toBeNull();
    });

    it('expires', () => {
        vi.useFakeTimers();
        const state = signState({ p: 'p', a: 'a', u: 'u', c: false }, 1000);
        vi.advanceTimersByTime(1001);
        expect(readState(state)).toBeNull();
    });

    it("opens Meta's signup as a page, with coexistence when asked", () => {
        const url = new URL(signupDialogUrl({ redirectUri: 'https://studio.cencori.com/api/studio/whatsapp/callback', state: 's', coexistence: true })!);
        expect(url.hostname).toBe('www.facebook.com');
        expect(url.pathname).toMatch(/\/dialog\/oauth$/);
        expect(url.searchParams.get('config_id')).toBe('456');
        expect(url.searchParams.get('redirect_uri')).toBe('https://studio.cencori.com/api/studio/whatsapp/callback');
        expect(JSON.parse(url.searchParams.get('extras')!)).toMatchObject({ featureType: 'whatsapp_business_app_onboarding' });
        expect(JSON.parse(new URL(signupDialogUrl({ redirectUri: 'x', state: 's', coexistence: false })!).searchParams.get('extras')!).featureType).toBeUndefined();
    });
});
