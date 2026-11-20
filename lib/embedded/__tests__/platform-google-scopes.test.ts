/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { scopesBeyondPlatformGoogleApp } from '@/lib/embedded/oauth';

const GOOGLE = 'https://accounts.google.com/o/oauth2/v2/auth';
const SEND = 'https://www.googleapis.com/auth/gmail.send';
const MODIFY = 'https://www.googleapis.com/auth/gmail.modify';

describe("scopes Cencori's own Google app may ask for", () => {
    it('allows the connector defaults and plain sign-in scopes', () => {
        expect(scopesBeyondPlatformGoogleApp(GOOGLE, [SEND, 'openid', 'email'], [SEND])).toEqual([]);
        expect(scopesBeyondPlatformGoogleApp(GOOGLE, [], [SEND])).toEqual([]);
    });

    it('names anything beyond them', () => {
        expect(scopesBeyondPlatformGoogleApp(GOOGLE, [SEND, MODIFY], [SEND])).toEqual([MODIFY]);
    });

    it('leaves other providers alone', () => {
        expect(scopesBeyondPlatformGoogleApp('https://slack.com/oauth/v2/authorize', ['chat:write', 'files:read'], ['chat:write'])).toEqual([]);
        expect(scopesBeyondPlatformGoogleApp('not a url', [MODIFY], [])).toEqual([]);
    });
});
