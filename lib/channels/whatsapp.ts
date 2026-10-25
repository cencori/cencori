/**
 * WhatsApp as a channel: customers message a business's WhatsApp number and
 * the business's agent replies, through the WhatsApp Cloud API.
 *
 * v1 is "bring your own Cloud API credentials": the business (or we, for a
 * pilot) creates a Meta app with WhatsApp, and pastes its phone number id,
 * access token and app secret; Cencori hands back a webhook URL and verify
 * token for the Meta app. Meta's Embedded Signup replaces the pasting once
 * Cencori is an approved Tech Provider.
 *
 * Each agent's channel is a project `tool_connections` row
 * (`connector_slug = 'whatsapp-channel'`): the access token in the encrypted
 * token column, the app secret encrypted in metadata. Conversations run like
 * the website widget's: the published version, one session per customer
 * number, through the regular session turns endpoint.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { decryptApiKey, encryptApiKey } from '@/lib/encryption';
import { safeOutboundFetch } from '@/lib/security/outbound-url';

type Admin = ReturnType<typeof createAdminClient>;

export const WHATSAPP_CHANNEL_SLUG = 'whatsapp-channel';
/** Meta retires a Graph API version two years after release; bump with the SDK version in the console. */
export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const GRAPH_TIMEOUT_MS = 15_000;
/** WhatsApp's text message limit; longer replies go out in parts. */
const WHATSAPP_TEXT_MAX = 4096;

export interface WhatsAppChannelMetadata {
    kind: 'whatsapp_channel';
    agent_id: string;
    phone_number_id: string;
    display_phone_number: string | null;
    verified_name: string | null;
    /** The business's own Meta app secret; null for a number connected through Cencori's app (Embedded Signup). */
    app_secret_encrypted: string | null;
    verify_token: string;
    /**
     * Connected through Embedded Signup: messages arrive on Cencori's shared
     * webhook, signed with Cencori's app secret, and are routed by phone number id.
     */
    managed?: boolean;
    waba_id?: string | null;
    /** The number also stays on the WhatsApp Business app (coexistence). */
    coexistence?: boolean;
    enabled: boolean;
    /** When Meta last completed the webhook check against our URL. */
    webhook_verified_at: string | null;
    /** When the last customer message arrived. */
    last_message_at: string | null;
    daily_session_cap: number;
}

export interface WhatsAppChannel {
    id: string;
    projectId: string;
    status: string;
    accessTokenEncrypted: string | null;
    metadata: WhatsAppChannelMetadata;
}

const COLUMNS = 'id, project_id, status, encrypted_access_ref, metadata';

function toChannel(row: Record<string, unknown> | null): WhatsAppChannel | null {
    const metadata = row?.metadata as WhatsAppChannelMetadata | undefined;
    if (!row || metadata?.kind !== 'whatsapp_channel') return null;
    return { id: row.id as string, projectId: row.project_id as string, status: row.status as string, accessTokenEncrypted: (row.encrypted_access_ref as string | null) ?? null, metadata };
}

export async function getChannelById(db: Admin, channelId: string): Promise<WhatsAppChannel | null> {
    if (!/^[0-9a-f-]{36}$/i.test(channelId)) return null;
    const { data } = await db.from('tool_connections').select(COLUMNS).eq('id', channelId).eq('connector_slug', WHATSAPP_CHANNEL_SLUG).maybeSingle();
    return toChannel(data as Record<string, unknown> | null);
}

/** A number connected through Embedded Signup, found by the id Meta puts on each delivery. */
export async function getManagedChannelByPhoneNumberId(db: Admin, phoneNumberId: string): Promise<WhatsAppChannel | null> {
    if (!/^\d{5,25}$/.test(phoneNumberId)) return null;
    const { data } = await db.from('tool_connections').select(COLUMNS)
        .eq('connector_slug', WHATSAPP_CHANNEL_SLUG).eq('metadata->>phone_number_id', phoneNumberId).eq('metadata->>managed', 'true')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    return toChannel(data as Record<string, unknown> | null);
}

export async function getAgentChannel(db: Admin, projectId: string, agentId: string): Promise<WhatsAppChannel | null> {
    const { data } = await db.from('tool_connections').select(COLUMNS)
        .eq('project_id', projectId).eq('connector_slug', WHATSAPP_CHANNEL_SLUG).eq('metadata->>agent_id', agentId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return toChannel(data as Record<string, unknown> | null);
}

/** What the console may see: no token, no secret. */
export function publicChannel(channel: WhatsAppChannel, webhookUrl: string) {
    const m = channel.metadata;
    return {
        id: channel.id,
        phone_number_id: m.phone_number_id,
        display_phone_number: m.display_phone_number,
        verified_name: m.verified_name,
        enabled: m.enabled,
        managed: !!m.managed,
        coexistence: !!m.coexistence,
        // Numbers connected through Cencori's app need no webhook set-up of their own.
        webhook_url: m.managed ? null : webhookUrl,
        verify_token: m.managed ? null : m.verify_token,
        webhook_verified: !!m.managed || !!m.webhook_verified_at,
        last_message_at: m.last_message_at,
        daily_session_cap: m.daily_session_cap,
    };
}

async function graph<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
    const response = await safeOutboundFetch(`${GRAPH}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    const json = await response.json().catch(() => null) as (T & { error?: { message?: string; code?: number } }) | null;
    if (!response.ok) throw Object.assign(new Error(json?.error?.message ?? `WhatsApp request failed (${response.status})`), { status: response.status, code: json?.error?.code });
    return json as T;
}

/** Check the credentials against Meta and read the number's details. */
export async function lookupPhoneNumber(phoneNumberId: string, accessToken: string): Promise<{ displayPhoneNumber: string | null; verifiedName: string | null }> {
    const info = await graph<{ display_phone_number?: string; verified_name?: string }>('GET', `/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, accessToken);
    return { displayPhoneNumber: info.display_phone_number ?? null, verifiedName: info.verified_name ?? null };
}

/**
 * Create or update an agent's channel from what the console sends. A blank
 * token or secret keeps the stored one, so editing the number doesn't mean
 * re-pasting secrets.
 */
export async function saveChannel(
    db: Admin,
    opts: {
        projectId: string;
        organizationId: string;
        agentId: string;
        existing: WhatsAppChannel | null;
        phoneNumberId: string;
        accessToken?: string;
        appSecret?: string;
        enabled?: boolean;
        dailySessionCap?: number;
    },
): Promise<{ ok: true; channel: WhatsAppChannel } | { ok: false; status: number; message: string }> {
    const phoneNumberId = opts.phoneNumberId.trim();
    if (!/^\d{5,25}$/.test(phoneNumberId)) return { ok: false, status: 400, message: 'The phone number ID is the long number from WhatsApp → API Setup in your Meta app (not the phone number itself).' };
    const token = opts.accessToken?.trim() || (opts.existing?.accessTokenEncrypted ? decryptApiKey(opts.existing.accessTokenEncrypted, opts.organizationId) : '');
    if (!token) return { ok: false, status: 400, message: 'Paste the access token for this number.' };
    const secretEncrypted = opts.appSecret?.trim() ? encryptApiKey(opts.appSecret.trim(), opts.organizationId) : opts.existing?.metadata.app_secret_encrypted;
    if (!secretEncrypted) return { ok: false, status: 400, message: 'Paste the app secret (Meta app → App settings → Basic), so Cencori can check messages really come from Meta.' };

    let details: { displayPhoneNumber: string | null; verifiedName: string | null };
    try {
        details = await lookupPhoneNumber(phoneNumberId, token);
    } catch (error) {
        const { status, code } = error as { status?: number; code?: number };
        return { ok: false, status: 422, message: status === 401 || code === 190 ? 'Meta didn\'t accept that access token.' : `Meta couldn't find that phone number ID with this token: ${error instanceof Error ? error.message : 'unknown error'}` };
    }

    const metadata: WhatsAppChannelMetadata = {
        kind: 'whatsapp_channel',
        agent_id: opts.agentId,
        phone_number_id: phoneNumberId,
        display_phone_number: details.displayPhoneNumber,
        verified_name: details.verifiedName,
        app_secret_encrypted: secretEncrypted,
        verify_token: opts.existing?.metadata.verify_token ?? `cencori_${randomBytes(16).toString('hex')}`,
        enabled: opts.enabled ?? opts.existing?.metadata.enabled ?? true,
        // A different number has to be verified with Meta again.
        webhook_verified_at: opts.existing?.metadata.phone_number_id === phoneNumberId ? opts.existing.metadata.webhook_verified_at : null,
        last_message_at: opts.existing?.metadata.last_message_at ?? null,
        daily_session_cap: Math.min(100_000, Math.max(1, Math.floor(opts.dailySessionCap ?? opts.existing?.metadata.daily_session_cap ?? 500))),
    };
    const row = {
        project_id: opts.projectId,
        connector_slug: WHATSAPP_CHANNEL_SLUG,
        owner_type: 'platform',
        status: 'active',
        encrypted_access_ref: encryptApiKey(token, opts.organizationId),
        key_hint: details.displayPhoneNumber ?? phoneNumberId,
        metadata,
        last_error: null,
    };
    const write = opts.existing
        ? db.from('tool_connections').update(row).eq('id', opts.existing.id).select(COLUMNS).single()
        : db.from('tool_connections').insert(row).select(COLUMNS).single();
    const { data, error } = await write;
    const channel = toChannel(data as Record<string, unknown> | null);
    if (error || !channel) return { ok: false, status: 502, message: 'Couldn\'t save the WhatsApp channel. Try again.' };
    return { ok: true, channel };
}

/**
 * Save a number connected through Embedded Signup: the business token from
 * the signup, the number and its WhatsApp Business Account. Replaces whatever
 * the agent had (including a number on the business's own Meta app).
 */
export async function saveSignupChannel(
    db: Admin,
    opts: { projectId: string; organizationId: string; agentId: string; existing: WhatsAppChannel | null; phoneNumberId: string; wabaId: string; accessToken: string; coexistence: boolean },
): Promise<{ ok: true; channel: WhatsAppChannel } | { ok: false; status: number; message: string }> {
    const details = await lookupPhoneNumber(opts.phoneNumberId, opts.accessToken).catch(() => ({ displayPhoneNumber: null, verifiedName: null }));
    const metadata: WhatsAppChannelMetadata = {
        kind: 'whatsapp_channel',
        agent_id: opts.agentId,
        phone_number_id: opts.phoneNumberId,
        display_phone_number: details.displayPhoneNumber,
        verified_name: details.verifiedName,
        app_secret_encrypted: null,
        verify_token: opts.existing?.metadata.verify_token ?? `cencori_${randomBytes(16).toString('hex')}`,
        managed: true,
        waba_id: opts.wabaId,
        coexistence: opts.coexistence,
        enabled: opts.existing?.metadata.enabled ?? true,
        webhook_verified_at: new Date().toISOString(),
        last_message_at: opts.existing?.metadata.last_message_at ?? null,
        daily_session_cap: opts.existing?.metadata.daily_session_cap ?? 500,
    };
    const row = {
        project_id: opts.projectId,
        connector_slug: WHATSAPP_CHANNEL_SLUG,
        owner_type: 'platform',
        status: 'active',
        encrypted_access_ref: encryptApiKey(opts.accessToken, opts.organizationId),
        key_hint: details.displayPhoneNumber ?? opts.phoneNumberId,
        metadata,
        last_error: null,
    };
    // One agent per number: a number moved here from another agent leaves it.
    await db.from('tool_connections').delete().eq('connector_slug', WHATSAPP_CHANNEL_SLUG).eq('metadata->>phone_number_id', opts.phoneNumberId).neq('metadata->>agent_id', opts.agentId);
    const write = opts.existing
        ? db.from('tool_connections').update(row).eq('id', opts.existing.id).select(COLUMNS).single()
        : db.from('tool_connections').insert(row).select(COLUMNS).single();
    const { data, error } = await write;
    const channel = toChannel(data as Record<string, unknown> | null);
    if (error || !channel) return { ok: false, status: 502, message: 'Couldn\'t save the WhatsApp channel. Try again.' };
    return { ok: true, channel };
}

/** Subscribe Cencori's app to a WhatsApp Business Account, so its messages reach the shared webhook. */
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
    await graph('POST', `/${encodeURIComponent(wabaId)}/subscribed_apps`, accessToken, {});
}

/**
 * Turn a newly added number on for the Cloud API. Numbers that stay on the
 * WhatsApp Business app (coexistence) are already registered and skip this.
 */
export async function registerPhoneNumber(phoneNumberId: string, accessToken: string, pin: string): Promise<void> {
    await graph('POST', `/${encodeURIComponent(phoneNumberId)}/register`, accessToken, { messaging_product: 'whatsapp', pin });
}

/** Swap the code from Embedded Signup for a business token (needs Cencori's app secret, so server-side only). */
export async function exchangeSignupCode(code: string, appId: string, appSecret: string): Promise<string> {
    const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, code });
    const response = await safeOutboundFetch(`${GRAPH}/oauth/access_token?${params}`, { signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) });
    const json = await response.json().catch(() => null) as { access_token?: string; error?: { message?: string } } | null;
    if (!response.ok || !json?.access_token) throw new Error(json?.error?.message ?? `Meta didn't accept the sign-up (${response.status})`);
    return json.access_token;
}

export async function patchChannelMetadata(db: Admin, channel: WhatsAppChannel, patch: Partial<WhatsAppChannelMetadata>): Promise<void> {
    await db.from('tool_connections').update({ metadata: { ...channel.metadata, ...patch } }).eq('id', channel.id);
}

/** Meta's webhook signature: HMAC-SHA256 of the raw body with the app secret. */
export function verifyWhatsAppSignature(rawBody: string, header: string | null, appSecret: string): boolean {
    if (!header?.startsWith('sha256=')) return false;
    const expected = Buffer.from(createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex'));
    const given = Buffer.from(header.slice(7));
    return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface InboundMessage {
    id: string;
    /** The customer's WhatsApp number (wa_id). */
    from: string;
    name: string | null;
    /** The text, or null for a message type the agent can't read yet. */
    text: string | null;
    /** A voice note or audio file, transcribed before the agent answers. */
    audio: { id: string; mimeType: string | null } | null;
    type: string;
    phoneNumberId: string;
}

/** Customer messages in a webhook delivery (status updates and other events are skipped). */
export function parseInbound(payload: unknown): InboundMessage[] {
    const out: InboundMessage[] = [];
    const entries = (payload as { entry?: Array<{ changes?: Array<{ field?: string; value?: Record<string, unknown> }> }> } | null)?.entry ?? [];
    for (const entry of entries) {
        for (const change of entry.changes ?? []) {
            if (change.field !== 'messages' || !change.value) continue;
            const value = change.value as {
                metadata?: { phone_number_id?: string };
                contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
                messages?: Array<{ id?: string; from?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } }; audio?: { id?: string; mime_type?: string } }>;
            };
            for (const message of value.messages ?? []) {
                if (!message.id || !message.from) continue;
                const text = message.type === 'text' ? message.text?.body ?? null
                    : message.type === 'button' ? message.button?.text ?? null
                    : message.type === 'interactive' ? message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? null
                    : null;
                out.push({
                    id: message.id,
                    from: message.from,
                    name: value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name ?? null,
                    text: text?.trim() ? text.trim().slice(0, 4000) : null,
                    audio: message.type === 'audio' && message.audio?.id ? { id: message.audio.id, mimeType: message.audio.mime_type ?? null } : null,
                    type: message.type ?? 'unknown',
                    phoneNumberId: value.metadata?.phone_number_id ?? '',
                });
            }
        }
    }
    return out;
}

/** Markdown from the model in WhatsApp's own formatting, which has no headings or links syntax. */
export function toWhatsAppText(markdown: string): string {
    return markdown
        .replace(/\*\*(.+?)\*\*/g, '*$1*')
        .replace(/__(.+?)__/g, '_$1_')
        .replace(/~~(.+?)~~/g, '~$1~')
        .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
        .replace(/^\s*[-*]\s+/gm, '• ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Split at paragraph, then line, then word boundaries to fit WhatsApp's limit. */
export function splitForWhatsApp(text: string, max = WHATSAPP_TEXT_MAX): string[] {
    const parts: string[] = [];
    let rest = text;
    while (rest.length > max) {
        const window = rest.slice(0, max);
        const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), window.lastIndexOf(' '));
        const at = cut > max / 2 ? cut : max;
        parts.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
    }
    if (rest) parts.push(rest);
    return parts;
}

/** Voice notes this size or larger aren't fetched (about 15 minutes of WhatsApp voice). */
export const MAX_VOICE_NOTE_BYTES = 8 * 1024 * 1024;

/**
 * A media file a customer sent: Meta gives a short-lived URL for the media id,
 * which is fetched with the same token.
 */
export async function downloadMedia(accessToken: string, mediaId: string): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
    const info = await graph<{ url?: string; mime_type?: string; file_size?: number }>('GET', `/${encodeURIComponent(mediaId)}`, accessToken);
    if (!info.url) throw new Error('WhatsApp gave no address for that file');
    if ((info.file_size ?? 0) > MAX_VOICE_NOTE_BYTES) throw Object.assign(new Error('Voice note too long'), { code: 'too_large' });
    const response = await safeOutboundFetch(info.url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Couldn't download the file (${response.status})`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_VOICE_NOTE_BYTES) throw Object.assign(new Error('Voice note too long'), { code: 'too_large' });
    return { bytes, mimeType: (info.mime_type ?? 'audio/ogg').split(';')[0].trim() };
}

/** Mark the customer's message read and show "typing…" while the agent works (best-effort). */
export async function markReadAndTyping(channel: WhatsAppChannel, accessToken: string, messageId: string): Promise<void> {
    await graph('POST', `/${encodeURIComponent(channel.metadata.phone_number_id)}/messages`, accessToken, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: { type: 'text' },
    }).catch(() => undefined);
}

export async function sendText(channel: WhatsAppChannel, accessToken: string, to: string, text: string, replyTo?: string): Promise<void> {
    const parts = splitForWhatsApp(toWhatsAppText(text));
    for (const [index, body] of parts.entries()) {
        await graph('POST', `/${encodeURIComponent(channel.metadata.phone_number_id)}/messages`, accessToken, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { body, preview_url: true },
            // The first part quotes the customer's message, so a reply after a pause is clearly an answer.
            ...(index === 0 && replyTo ? { context: { message_id: replyTo } } : {}),
        });
    }
}
