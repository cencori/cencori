/**
 * Kapso: connects a business's WhatsApp number through Kapso's approved Meta
 * app, so "Connect WhatsApp" works without Cencori's own Meta app review.
 *
 * The business opens a Kapso setup link (log in with Facebook, pick the
 * WhatsApp Business app number they already use, or a new one). Kapso then
 * forwards that number's webhooks to Cencori in Meta's own format, and
 * replies go out through Kapso's copy of the Cloud API with Cencori's Kapso
 * key. Everything after that (parsing, turns, replies) is the regular
 * WhatsApp channel.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { safeOutboundFetch } from '@/lib/security/outbound-url';

const PLATFORM = 'https://api.kapso.ai/platform/v1';
/** Kapso's Cloud API proxy: the Graph API's paths, authenticated with the Kapso key. */
export const KAPSO_META_BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0';
const TIMEOUT_MS = 15_000;
/** Header Cencori asks Kapso to send on every webhook delivery, carrying the shared secret. */
export const KAPSO_TOKEN_HEADER = 'x-cencori-webhook-token';

/** Both are needed: the key to act, the secret to trust what Kapso sends. */
export function kapsoConfigured(): boolean {
    return !!process.env.KAPSO_API_KEY && !!process.env.KAPSO_WEBHOOK_SECRET;
}

async function platform<T>(method: string, path: string, body?: unknown): Promise<T> {
    const key = process.env.KAPSO_API_KEY;
    if (!key) throw new Error('Kapso isn\'t configured on this server.');
    const response = await safeOutboundFetch(`${PLATFORM}${path}`, {
        method,
        headers: { 'X-API-Key': key, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = await response.json().catch(() => null) as (T & { error?: string | { message?: string }; errors?: unknown }) | null;
    if (!response.ok) {
        const reason = typeof json?.error === 'string' ? json.error : json?.error?.message;
        throw Object.assign(new Error(reason ?? `Kapso request failed (${response.status})`), { status: response.status });
    }
    return json as T;
}

type KapsoCustomer = { id: string; name: string; external_customer_id: string | null };

/**
 * The Kapso customer for one agent, made on first use. `externalId` ties it
 * back to Cencori (project and agent), so a retried setup finds the same one.
 */
export async function ensureKapsoCustomer(name: string, externalId: string): Promise<KapsoCustomer> {
    const found = await platform<{ data: KapsoCustomer[] }>('GET', `/customers?external_customer_id=${encodeURIComponent(externalId)}&per_page=100`).catch(() => ({ data: [] }));
    const existing = found.data.find((customer) => customer.external_customer_id === externalId);
    if (existing) return existing;
    const created = await platform<{ data: KapsoCustomer }>('POST', '/customers', { customer: { name: name.slice(0, 100), external_customer_id: externalId } });
    return created.data;
}

/** Kapso's setup page in Cencori's console colours, so the hand-off doesn't feel like another product. */
const SETUP_THEME = {
    primary_color: '#111111',
    primary_foreground_color: '#FFFFFF',
    background_color: '#FFFFFF',
    text_color: '#111111',
    muted_text_color: '#5F5F5F',
    card_color: '#F4F4F2',
    muted_color: '#F4F4F2',
    border_color: '#E7E7E5',
};

/**
 * A link the business opens to connect its number. It sends them back to
 * `successUrl` (Kapso adds phone_number_id and the rest) or `failureUrl`
 * (with error_code). Coexistence only for now: the WhatsApp Business app
 * number they already use, which also skips Kapso's choice screen.
 */
export async function createKapsoSetupLink(customerId: string, opts: { successUrl: string; failureUrl: string }): Promise<string> {
    const created = await platform<{ data: { url: string } }>('POST', `/customers/${encodeURIComponent(customerId)}/setup_links`, {
        setup_link: {
            success_redirect_url: opts.successUrl,
            failure_redirect_url: opts.failureUrl,
            allowed_connection_types: ['coexistence'],
            theme_config: SETUP_THEME,
            language: 'en',
        },
    });
    return created.data.url;
}

export interface KapsoNumber {
    phone_number_id: string;
    display_phone_number: string | null;
    verified_name: string | null;
    business_account_id: string | null;
    is_coexistence: boolean;
    status: string | null;
}

/** The numbers a customer has connected, newest first. */
export async function listKapsoNumbers(customerId: string): Promise<KapsoNumber[]> {
    const listed = await platform<{ data: Array<Partial<KapsoNumber> & { created_at?: string }> }>('GET', `/whatsapp/phone_numbers?customer_id=${encodeURIComponent(customerId)}&per_page=50`);
    return listed.data
        .filter((number): number is Partial<KapsoNumber> & { phone_number_id: string; created_at?: string } => typeof number.phone_number_id === 'string')
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        .map((number) => ({
            phone_number_id: number.phone_number_id,
            display_phone_number: number.display_phone_number ?? null,
            verified_name: number.verified_name ?? null,
            business_account_id: number.business_account_id ?? null,
            is_coexistence: !!number.is_coexistence,
            status: number.status ?? null,
        }));
}

/**
 * Have Kapso forward the number's webhooks to Cencori, unchanged from Meta
 * (`kind: meta`), signed with the shared secret and carrying it in a header
 * too. Skipped when the number already forwards to that address.
 */
export async function ensureKapsoWebhook(phoneNumberId: string, url: string): Promise<void> {
    const secret = process.env.KAPSO_WEBHOOK_SECRET;
    if (!secret) throw new Error('Kapso isn\'t configured on this server.');
    const path = `/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}/webhooks`;
    const listed = await platform<{ data: Array<{ url?: string; kind?: string; active?: boolean }> }>('GET', path).catch(() => ({ data: [] }));
    if (listed.data.some((hook) => hook.url === url && hook.kind === 'meta' && hook.active !== false)) return;
    await platform('POST', path, {
        whatsapp_webhook: { kind: 'meta', url, secret_key: secret, active: true, headers: { [KAPSO_TOKEN_HEADER]: secret } },
    });
}

/**
 * A delivery really came from Kapso: its HMAC-SHA256 signature of the raw
 * body (hex, X-Webhook-Signature), or the shared secret in Cencori's header.
 */
export function verifyKapsoDelivery(rawBody: string, signature: string | null, token: string | null): boolean {
    const secret = process.env.KAPSO_WEBHOOK_SECRET;
    if (!secret) return false;
    const same = (given: string, expected: string) => {
        const a = Buffer.from(given);
        const b = Buffer.from(expected);
        return a.length === b.length && timingSafeEqual(a, b);
    };
    if (signature && same(signature.trim().toLowerCase(), createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex'))) return true;
    return !!token && same(token, secret);
}
