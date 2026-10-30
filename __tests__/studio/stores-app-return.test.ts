import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

import { GET } from '@/app/api/studio/stores/return/route';
import { appLink } from '@/lib/studio/app-link';

const back = (query: string) => GET(new NextRequest(`https://studio.cencori.com/api/studio/stores/return?${query}`)).headers.get('location');

afterEach(() => vi.unstubAllEnvs());

describe('back to the app after signing in to a store', () => {
    it('goes on to the app, saying which store', () => {
        expect(back('provider=square&status=success')).toBe('cencori-studio://store?provider=square&outcome=done');
        expect(back('provider=square')).toBe('cencori-studio://store?provider=square&outcome=done');
    });

    it('says when the sign-in failed', () => {
        expect(back('provider=square&status=failed')).toBe('cencori-studio://store?provider=square&outcome=failed');
    });

    it('never passes on a store it doesn\'t know', () => {
        expect(back('provider=evil.example')).toBe('cencori-studio://store?outcome=failed');
    });

    it('uses the app\'s own scheme once it\'s set', () => {
        vi.stubEnv('STUDIO_APP_SCHEME', 'mybrand');
        expect(appLink('store', { provider: 'square' })).toBe('mybrand://store?provider=square');
    });
});
