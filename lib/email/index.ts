/**
 * Email — barrel export
 */

export { EmailService, createProvider, resolveProviderFromEnv, parseReplyTo } from './email-service';
export type { EmailProviderType } from './email-service';
export type { EmailProvider, SendEmailOptions, EmailResult } from './providers/email-provider';
export { ResendProvider, ResendProviderError } from './providers/resend-provider';
export { SendByteProvider, SendByteProviderError } from './providers/sendbyte-provider';
