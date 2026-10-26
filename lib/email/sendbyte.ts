/**
 * Send one email through Sendbyte (the provider the budget alerts use).
 * Returns false instead of throwing when email isn't configured or the send
 * fails, so callers can treat email as best-effort.
 */

import { safeOutboundFetch } from '@/lib/security/outbound-url';

const SENDBYTE_URL = 'https://api.sendbyte.africa/v1/emails';

export async function sendEmail(message: { to: string[]; subject: string; html: string; from?: string; replyTo?: string }): Promise<boolean> {
    const apiKey = process.env.SENDBYTE_API_KEY || process.env.RESEND_API_KEY;
    const from = message.from || process.env.RESEND_FROM_EMAIL || '';
    if (!apiKey || !from || message.to.length === 0) return false;
    try {
        const response = await safeOutboundFetch(SENDBYTE_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to: message.to, subject: message.subject, html: message.html, ...(message.replyTo ? { reply_to: message.replyTo } : {}) }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) console.error('[email] Sendbyte error', response.status, (await response.text().catch(() => '')).slice(0, 300));
        return response.ok;
    } catch (error) {
        console.error('[email] send failed', error instanceof Error ? error.message : error);
        return false;
    }
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
