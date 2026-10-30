import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { appScheme } from '@/lib/studio/app-link';

/**
 * Google and GitHub sign-in for the Studio mobile app. The app opens the
 * provider in the phone's browser, which signs in as the web does; Studio
 * then hands the app the session as a sealed one-time code. The code only
 * opens with the secret (verifier) whose SHA-256 (challenge) the app sent at
 * the start, so a code caught on its way back (another app on the phone
 * claiming the link) is no use: PKCE, as OAuth apps on phones do it.
 */

/** Codes are made and used within seconds; five minutes is plenty. */
const CODE_TTL_MS = 5 * 60_000;

export const isChallenge = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

/**
 * Where the browser hands back to: the app's own scheme, or Expo Go's while
 * developing. Anything else (a web page) is refused: the code is for the app.
 */
export function isAppReturn(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > 300) return false;
    try {
        const url = new URL(value);
        return url.protocol === `${appScheme()}:` || url.protocol === 'exp:' || url.protocol === 'exps:';
    } catch {
        return false;
    }
}

/** The return address with how it went: done (and the code), or failed (and why). */
export function appAuthReturn(back: string, outcome: { code: string } | { message: string }): string {
    const url = new URL(back);
    if ('code' in outcome) {
        url.searchParams.set('outcome', 'done');
        url.searchParams.set('code', outcome.code);
    } else {
        url.searchParams.set('outcome', 'failed');
        url.searchParams.set('message', outcome.message.slice(0, 200));
    }
    return url.toString();
}

function codeKey(): Buffer | null {
    const secret = process.env.BETTER_AUTH_SECRET;
    return secret ? createHash('sha256').update(`studio-app-auth:${secret}`).digest() : null;
}

/** The session token and the challenge, sealed (AES-256-GCM) with an expiry. */
export function sealCode(token: string, challenge: string, now = Date.now()): string | null {
    const key = codeKey();
    if (!key) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const sealed = Buffer.concat([cipher.update(JSON.stringify({ t: token, c: challenge, e: now + CODE_TTL_MS }), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64url');
}

/** The session token, for the app holding the verifier; null for anything else. */
export function openCode(code: unknown, verifier: unknown, now = Date.now()): string | null {
    const key = codeKey();
    if (!key || typeof code !== 'string' || code.length > 4000 || typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128) return null;
    try {
        const raw = Buffer.from(code, 'base64url');
        if (raw.length < 29) return null;
        const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
        decipher.setAuthTag(raw.subarray(12, 28));
        const opened = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as { t?: unknown; c?: unknown; e?: unknown };
        if (typeof opened.e !== 'number' || opened.e <= now || typeof opened.t !== 'string' || !isChallenge(opened.c)) return null;
        const hashed = createHash('sha256').update(verifier).digest();
        return timingSafeEqual(hashed, Buffer.from(opened.c, 'hex')) ? opened.t : null;
    } catch {
        return null;
    }
}
