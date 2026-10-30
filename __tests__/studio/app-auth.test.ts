import { createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { appAuthReturn, isAppReturn, isChallenge, openCode, sealCode } from '@/lib/studio/app-auth';

const verifier = 'a'.repeat(64);
const challenge = createHash('sha256').update(verifier).digest('hex');

beforeEach(() => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret');
    vi.stubEnv('STUDIO_APP_SCHEME', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('the sign-in code', () => {
    it('opens to the session for the app holding the verifier', () => {
        expect(openCode(sealCode('session.sig', challenge), verifier)).toBe('session.sig');
    });

    it("doesn't show the session in the link", () => {
        expect(sealCode('session.sig', challenge)).not.toContain('session');
    });

    it('opens for nobody else: another verifier, an old code, a changed one, another secret', () => {
        const code = sealCode('session.sig', challenge)!;
        expect(openCode(code, 'b'.repeat(64))).toBeNull();
        expect(openCode(sealCode('session.sig', challenge, 0), verifier, 5 * 60_000 + 1)).toBeNull();
        expect(openCode(`${code.slice(0, -2)}AA`, verifier)).toBeNull();
        vi.stubEnv('BETTER_AUTH_SECRET', 'another');
        expect(openCode(code, verifier)).toBeNull();
        expect(openCode(42, verifier)).toBeNull();
    });
});

describe('where it goes back to', () => {
    it("is only the app (or Expo Go while developing)", () => {
        expect(isAppReturn('cencori-studio://auth')).toBe(true);
        expect(isAppReturn('exp://192.168.1.4:8081/--/auth')).toBe(true);
        for (const bad of ['https://evil.example/auth', 'javascript:alert(1)', 'not a url', 42, null]) expect(isAppReturn(bad), String(bad)).toBe(false);
    });

    it('carries the code, or why it failed', () => {
        expect(appAuthReturn('cencori-studio://auth', { code: 'abc' })).toBe('cencori-studio://auth?outcome=done&code=abc');
        expect(appAuthReturn('cencori-studio://auth', { message: 'Nope' })).toBe('cencori-studio://auth?outcome=failed&message=Nope');
    });

    it('takes only a SHA-256 challenge', () => {
        expect(isChallenge(challenge)).toBe(true);
        expect(isChallenge('xyz')).toBe(false);
    });
});
