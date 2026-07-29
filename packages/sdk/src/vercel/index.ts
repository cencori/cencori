/**
 * Cencori AI SDK - Vercel AI SDK Integration
 * 
 * @example
 * import { cencori } from 'cencori/vercel';
 * import { streamText } from 'ai';
 * 
 * const result = await streamText({
 *   model: cencori('gemini-2.5-flash'),
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 */

export { cencori, createCencori } from './cencori-provider';
export type { CencoriProvider } from './cencori-provider';
export type { CencoriProviderSettings, CencoriChatSettings } from './types';
export { CencoriChatLanguageModel } from './cencori-chat-model';
