/**
 * SendByte email provider.
 *
 * Depends on the `@sendbyte/node` npm package and the following env vars:
 *   SENDBYTE_API_KEY (required)
 *
 * API reference: https://docs.sendbyte.africa/sdks/node
 * Install: npm install @sendbyte/node
 */

import { SendByte, SendByteError } from '@sendbyte/node';
import type { EmailProvider, SendEmailOptions, EmailResult } from './email-provider';

export class SendByteProvider implements EmailProvider {
    readonly name = 'sendbyte';
    private client: SendByte;

    constructor(apiKey?: string) {
        const key = apiKey ?? process.env.SENDBYTE_API_KEY;
        if (!key) {
            throw new Error(
                '[SendByteProvider] SENDBYTE_API_KEY is not configured. ' +
                'Set the SENDBYTE_API_KEY environment variable or pass an apiKey to the constructor.',
            );
        }
        this.client = new SendByte(key);
    }

    async send(options: SendEmailOptions): Promise<EmailResult> {
        const { from, to, subject, html, text, replyTo, headers, idempotencyKey } = options;

        try {
            const result = await this.client.emails.send({
                from,
                to: Array.isArray(to) ? to : to,
                subject,
                html,
                text,
                reply_to: normalizeReplyTo(replyTo) as string | undefined,
                idempotency_key: idempotencyKey,
                headers,
            });

            return { id: result.id, provider: this.name };
        } catch (err) {
            if (err instanceof SendByteError) {
                throw new SendByteProviderError(err.message, err.code, err.status, err.docsUrl);
            }
            throw err;
        }
    }
}

export class SendByteProviderError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly status?: number,
        public readonly docsUrl?: string,
    ) {
        super(message);
        this.name = 'SendByteProviderError';
    }
}

/**
 * SendByte's `reply_to` field accepts `string` for the SDK.
 * If an array is provided, join into a single string.
 */
function normalizeReplyTo(
    replyTo: string | string[] | undefined,
): string | undefined {
    if (!replyTo) return undefined;
    if (Array.isArray(replyTo)) return replyTo.join(', ');
    return replyTo;
}
