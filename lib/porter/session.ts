import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

/**
 * Short-lived, narrowly scoped tokens for a Porter conversation.
 *
 * What this is not: proof that a request came from a browser on the customer's site. Nothing can
 * prove that from a page whose source is public. A server-side caller can spoof an Origin header,
 * and it can spoof one at the session endpoint just as easily as it could at the chat endpoint.
 *
 * What it actually buys, in order of how much it matters:
 *
 *   The expensive checks happen once. Resolving a Porter, matching the key to its project, checking
 *   the origin and the plan cost two database reads on every single message today. They now cost
 *   two reads per conversation, and every message after that verifies an HMAC in microseconds.
 *
 *   Abuse gets a smaller, cheaper thing to throttle. Session minting can be limited far harder than
 *   chat, because a real visitor mints one and then talks; a script has to keep coming back.
 *
 *   The origin is checked once and then carried. Chat stops re-reading a header it cannot trust and
 *   reads a value that was verified when the token was issued and is signed into it.
 *
 *   Sessions are bounded. A token expires on its own, which caps how long any single leak is worth.
 */

const TOKEN_PREFIX = 'prts_';
const TTL_SECONDS = 30 * 60;

export type PorterSessionClaims = {
    /** porter id */
    p: string;
    /** project id, so chat needs no lookup to scope retrieval */
    j: string;
    /** the origin host this token was issued to, already checked against allowed_domains */
    h: string;
    /** expiry, seconds since epoch */
    e: number;
    /** nonce, so two sessions minted in the same second are not the same string */
    n: string;
};

function secret(): string | null {
    const value = process.env.PORTER_SESSION_SECRET;
    return value && value.length >= 32 ? value : null;
}

function base64url(input: Buffer | string): string {
    return Buffer.from(input).toString('base64url');
}

function sign(payload: string, key: string): string {
    return createHmac('sha256', key).update(payload).digest('base64url');
}

export function isSessionSigningConfigured(): boolean {
    return secret() !== null;
}

export function mintPorterSession(claims: Omit<PorterSessionClaims, 'e' | 'n'>): string | null {
    const key = secret();
    if (!key) return null;

    const full: PorterSessionClaims = {
        ...claims,
        e: Math.floor(Date.now() / 1000) + TTL_SECONDS,
        n: randomBytes(6).toString('base64url'),
    };

    const payload = base64url(JSON.stringify(full));
    return `${TOKEN_PREFIX}${payload}.${sign(payload, key)}`;
}

export function readPorterSession(token: string | null | undefined): PorterSessionClaims | null {
    const key = secret();
    if (!key || !token || !token.startsWith(TOKEN_PREFIX)) return null;

    const body = token.slice(TOKEN_PREFIX.length);
    const dot = body.lastIndexOf('.');
    if (dot <= 0) return null;

    const payload = body.slice(0, dot);
    const provided = body.slice(dot + 1);
    const expected = sign(payload, key);

    // Length first: timingSafeEqual throws on a mismatch rather than returning false.
    if (provided.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return null;

    let claims: PorterSessionClaims;
    try {
        claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PorterSessionClaims;
    } catch {
        return null;
    }

    if (typeof claims.e !== 'number' || claims.e * 1000 < Date.now()) return null;
    if (!claims.p || !claims.j || !claims.h) return null;

    return claims;
}

export const PORTER_SESSION_TTL_SECONDS = TTL_SECONDS;
