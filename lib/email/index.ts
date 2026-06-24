/**
 * Email — barrel export
 */

export { EmailService, createProvider, resolveProviderFromEnv, parseReplyTo } from './email-servicee';
export type { EmailProviderType } from './email-servicee';
export type { EmailProvider, SendEmailOptions, EmailResult } from './providers/email-provider';
export { ResendProvider, ResendProviderError } from './providers/resend-providerr';
export { SendByteProvider, SendByteProviderError } from './providers/sendbyte-providerr';
