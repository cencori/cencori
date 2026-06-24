/**
 * EmailService — unified email sending service with provider abstraction.
 *
 * Selects a provider based on the EMAIL_PROVIDER env var:
 *   EMAIL_PROVIDER=resend     (default)
 *   EMAIL_PROVIDER=sendbyte
 *
 * Provider API keys are read from provider-specific env vars:
 *   Resend:    RESEND_API_KEY
 *   SendByte:  SENDBYTE_API_KEY
 */

import { EmailProvider, SendEmailOptions, EmailResult } from './providers/email-provider';
import { ResendProvider } from './providers/resend-provider';
import { SendByteProvider } from './providers/sendbyte-provider';

export type EmailProviderType = 'resend' | 'sendbyte';

export type { EmailProvider, SendEmailOptions, EmailResult };

export { ResendProvider, SendByteProvider };

/**
 * Parse a reply-to environment variable into the format expected by providers.
 * Supports comma-separated values for multiple addresses.
 *
 *   "support@cencori.com"                   → "support@cencori.com"
 *   "hello@cencori.com, support@cencori.com" → ["hello@cencori.com", "support@cencori.com"]
 *   "" or undefined                          → undefined
 */
export function parseReplyTo(value: string | undefined): string | string[] | undefined {
    if (!value?.trim()) return undefined;
    const addresses = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

    if (addresses.length === 0) return undefined;
    return addresses.length === 1 ? addresses[0] : addresses;
}

/**
 * Resolve the email provider type from the environment, defaulting to "resend".
 */
export function resolveProviderFromEnv(): EmailProviderType {
    const raw = (process.env.EMAIL_PROVIDER ?? 'resend').trim().toLowerCase();
    if (raw === 'sendbyte') return 'sendbyte';
    return 'resend';
}

/**
 * Create an EmailProvider instance based on a provider type and, optionally,
 * a custom API key. When no API key is provided it is read from the
 * provider's standard environment variable.
 */
export function createProvider(
    type: EmailProviderType,
    apiKey?: string,
): EmailProvider {
    switch (type) {
        case 'resend':
            return new ResendProvider(apiKey);
        case 'sendbyte':
            return new SendByteProvider(apiKey);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EmailService — convenience wrapper holding a provider instance
// ─────────────────────────────────────────────────────────────────────────────

export class EmailService {
    public readonly provider: EmailProvider;

    /**
     * @param providerOrType  An explicit EmailProvider instance, a provider type
     *                        string, or omit to auto-detect from $EMAIL_PROVIDER.
     */
    constructor(providerOrType?: EmailProvider | EmailProviderType) {
        if (!providerOrType) {
            this.provider = createProvider(resolveProviderFromEnv());
        } else if (typeof providerOrType === 'string') {
            this.provider = createProvider(providerOrType);
        } else {
            this.provider = providerOrType;
        }
    }

    /** Convenience accessor so callers can write `email.send(...)` directly. */
    async send(options: SendEmailOptions): Promise<EmailResult> {
        return this.provider.send(options);
    }

    /** The provider name, e.g. "resend" or "sendbyte". */
    get providerName(): string {
        return this.provider.name;
    }
}
