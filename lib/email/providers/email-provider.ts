/**
 * Email provider interface — allows switching between email providers
 * (Resend, SendByte, etc.) without changing calling code.
 */

export interface SendEmailOptions {
    from: string;
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string | string[];
    headers?: Record<string, string>;
    idempotencyKey?: string;
}

export interface EmailResult {
    id: string;
    provider: string;
}

export interface EmailProvider {
    /** Human-readable provider name, e.g. "resend" or "sendbyte" */
    readonly name: string;
    /** Send a single email. Returns the provider's email ID on success. */
    send(options: SendEmailOptions): Promise<EmailResult>;
}
