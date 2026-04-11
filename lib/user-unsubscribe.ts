/**
 * User-level marketing unsubscribe — HMAC token + user_metadata flag.
 *
 * Independent of lib/newsletter.ts, which handles the newsletter subscriber
 * list. This module handles per-user opt-out for bulk sends to "All Users",
 * which is every authenticated Cencori account. It's what makes the "send to
 * All Users" flow in /internal/emails CAN-SPAM + GDPR compliant.
 *
 * Why HMAC instead of a stored token:
 *   - No new table or column needed
 *   - Token is deterministic from (user_id, secret) so links in old emails
 *     keep working as long as the secret is stable
 *   - Can't be guessed without the secret
 *
 * Opt-out state lives in auth.users.user_metadata.marketing_opted_out_at.
 * The send route's getAllRecipients() filters out any user with that field.
 *
 * IMPORTANT: set USER_UNSUBSCRIBE_SECRET in production. If the secret
 * changes, every unsubscribe link in every already-sent email breaks.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const USER_UNSUBSCRIBE_TOKEN_LENGTH = 40;

function getSecret(): string {
    const explicit = process.env.USER_UNSUBSCRIBE_SECRET;
    if (explicit) return explicit;

    // Stable fallback for environments where the dedicated secret isn't set.
    // NEXTAUTH_SECRET and SUPABASE_JWT_SECRET are both stable per project.
    const fallback = process.env.NEXTAUTH_SECRET || process.env.SUPABASE_JWT_SECRET;
    if (fallback) return fallback;

    // Last resort — prevents crashes in dev but marks tokens as untrusted.
    console.warn(
        '[UserUnsubscribe] No USER_UNSUBSCRIBE_SECRET configured. Using dev fallback.',
    );
    return 'cencori-unsub-dev-fallback-do-not-use-in-prod';
}

export function generateUserUnsubscribeToken(userId: string): string {
    return createHmac('sha256', getSecret())
        .update(userId)
        .digest('hex')
        .slice(0, USER_UNSUBSCRIBE_TOKEN_LENGTH);
}

export function verifyUserUnsubscribeToken(
    userId: string,
    token: string,
): boolean {
    if (!userId || !token) return false;
    if (token.length !== USER_UNSUBSCRIBE_TOKEN_LENGTH) return false;

    const expected = generateUserUnsubscribeToken(userId);
    try {
        return timingSafeEqual(
            Buffer.from(expected, 'hex'),
            Buffer.from(token, 'hex'),
        );
    } catch {
        return false;
    }
}

export function buildUserUnsubscribeUrl(
    baseUrl: string,
    userId: string,
    token: string,
): string {
    const uid = encodeURIComponent(userId);
    const t = encodeURIComponent(token);
    return `${baseUrl}/api/users/unsubscribe?uid=${uid}&token=${t}`;
}

/**
 * Check whether a user has opted out of marketing/bulk emails.
 * Accepts the raw user_metadata object from Supabase.
 */
export function isUserMarketingOptedOut(
    userMetadata: Record<string, unknown> | null | undefined,
): boolean {
    if (!userMetadata) return false;
    return typeof userMetadata.marketing_opted_out_at === 'string';
}
