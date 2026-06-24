/**
 * Resend email provider.
 *
 * Depends on the `resend` npm package and the following env vars:
 *   RESEND_API_KEY (required)
 */

import { Resend } from 'resend';
import type { EmailProvider, SendEmailOptions, EmailResult } from './email-provider';

export class ResendProvider implements EmailProvider {
    readonly name = 'resend';
    private client: Resend;

    constructor(apiKey?: string) {
        const key = apiKey ?? process.env.RESEND_API_KEY;
        if (!key) {
            throw new Error(
                '[ResendProvider] RESEND_API_KEY is not configured. ' +
                'Set the RESEND_API_KEY environment variable or pass an apiKey to the constructor.',
            );
        }
        this.client = new Resend(key);
    }

    async send(options: SendEmailOptions): Promise<EmailResult> {
        const { from, to, subject, html, text, replyTo, headers } = options;

        const { data, error } = await this.client.emails.send({
            from,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
            text: text ?? undefined,
            replyTo: normalizeReplyTo(replyTo),
            headers,
        });

        if (error) {
            throw new ResendProviderError(error.message, error.name);
        }

        return { id: data?.id ?? '', provider: this.name };
    }
}

export class ResendProviderError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
    ) {
        super(message);
        this.name = 'ResendProviderError';
    }
}

/**
 * Resend's `replyTo` field accepts `string | string[] | undefined`.
 * Normalize our `string | string[]` into that shape.
 */
function normalizeReplyTo(
    replyTo: string | string[] | undefined,
): string | string[] | undefined {
    if (!replyTo) return undefined;
    if (Array.isArray(replyTo)) return replyTo;
    return replyTo;
}
