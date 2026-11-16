import type { createAdminClient } from '@/lib/supabaseAdmin';
import { getValidAccessToken, connectionOauthConfig } from './oauth';
import { safeOutboundFetch } from '@/lib/security/outbound-url';
import { decryptApiKey } from '@/lib/encryption';

type Admin = ReturnType<typeof createAdminClient>;

function base64urlMime(to: string, subject: string, body: string): string {
    const mime = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"', '', body].join('\r\n');
    return Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface GmailSendInput {
    to: string;
    subject: string;
    body: string;
}

/**
 * Execute a Gmail send exactly once per execution_key.
 * Credentials are decrypted here and injected as a Bearer header — never into prompts/logs.
 */
export async function executeGmailSend(
    supabase: Admin,
    opts: {
        connection: { id: string; encrypted_access_ref: string | null; encrypted_refresh_ref: string | null; expires_at: string | null; connector_slug?: string; metadata?: unknown };
        organizationId: string;
        connectorConfig: Record<string, unknown>;
        input: GmailSendInput;
        executionKey: string;
    },
): Promise<{ message_id: string }> {
    if (!opts.input.to || !opts.input.subject) {
        throw new Error('to and subject are required');
    }
    // The connection's own OAuth app (if it was authorized with one) refreshes its tokens.
    const client = connectionOauthConfig('gmail', opts.connectorConfig, opts.connection.metadata, opts.organizationId);
    if (!client.clientId || !client.clientSecret) {
        throw new Error('Gmail OAuth client is not configured for this connection — authorize it again with client_id/client_secret');
    }
    const accessToken = await getValidAccessToken(supabase, opts.connection, { organizationId: opts.organizationId, ...client });

    const res = await safeOutboundFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: base64urlMime(opts.input.to, opts.input.subject, opts.input.body ?? '') }),
        signal: AbortSignal.timeout(20000),
    }, { maxRedirects: 0 });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Gmail send failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { id?: string };
    return { message_id: json.id ?? `local-${opts.executionKey}` };
}

export type ConnectorHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ConnectorHttpInput = {
    method?: ConnectorHttpMethod;
    /** Path appended to the connection's base_url (leading slash optional). */
    path: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    body?: unknown;
};

export type ConnectorHttpResult = { status: number; body: unknown };

/**
 * Generic HTTP relay for `generic-http` connections (bring-your-own REST APIs).
 * Injects the connection credential as a Bearer token (OAuth refresh path when
 * the connector uses OAuth2, decrypted api key otherwise) — the credential
 * never reaches prompts, logs, or the action row. Callers must run egress
 * policy over the resulting URL's host first (approve dispatch does).
 */
export async function executeConnectorHttp(
    supabase: Admin,
    opts: {
        connection: { id: string; connector_slug?: string; encrypted_access_ref: string | null; encrypted_refresh_ref: string | null; expires_at: string | null; metadata?: unknown };
        organizationId: string;
        connectorConfig: Record<string, unknown>;
        input: ConnectorHttpInput;
        executionKey: string;
    },
): Promise<ConnectorHttpResult> {
    if (!opts.input.path) {
        throw new Error('path is required');
    }
    const method = (opts.input.method || 'GET').toUpperCase() as ConnectorHttpMethod;
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        throw new Error(`Method ${method} is not supported`);
    }
    const secret = opts.connection.expires_at
        ? await getValidAccessToken(supabase, opts.connection, { organizationId: opts.organizationId, ...connectionOauthConfig(opts.connection.connector_slug || 'generic-http', opts.connectorConfig, opts.connection.metadata, opts.organizationId) })
        : decryptApiKey(opts.connection.encrypted_access_ref ?? '', opts.organizationId);

    const url = new URL(`${(opts.connectorConfig.base_url as string).replace(/\/+$/, '')}/${opts.input.path.replace(/^\/+/, '')}`);
    for (const [key, value] of Object.entries(opts.input.query ?? {})) {
        url.searchParams.set(key, value);
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${secret}` };
    for (const [key, value] of Object.entries(opts.input.headers ?? {})) {
        headers[key] = value;
    }
    const res = await safeOutboundFetch(url.toString(), {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(opts.input.body ?? {}),
        signal: AbortSignal.timeout(20000),
    }, { maxRedirects: 0 });
    const text = await res.text();
    let parsed: unknown = text;
    try {
        parsed = JSON.parse(text);
    } catch {
        // Non-JSON response bodies pass through as text (truncated).
    }
    return { status: res.status, body: typeof parsed === 'string' ? parsed.slice(0, 2000) : parsed };
}
