import type { createAdminClient } from '@/lib/supabaseAdmin';
import { getValidAccessToken, gmailClientConfig } from './oauth';
import { safeOutboundFetch } from '@/lib/security/outbound-url';

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
        connection: { id: string; encrypted_access_ref: string | null; encrypted_refresh_ref: string | null; expires_at: string | null; connector_slug?: string };
        organizationId: string;
        connectorConfig: Record<string, unknown>;
        input: GmailSendInput;
        executionKey: string;
    },
): Promise<{ message_id: string }> {
    if (!opts.input.to || !opts.input.subject) {
        throw new Error('to and subject are required');
    }
    const { clientId, clientSecret, tokenUrl } = gmailClientConfig(opts.connectorConfig);
    const accessToken = await getValidAccessToken(supabase, opts.connection, { organizationId: opts.organizationId, tokenUrl, clientId, clientSecret });

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
