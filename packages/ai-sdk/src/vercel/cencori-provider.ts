/**
 * Cencori AI Provider for Vercel AI SDK
 * 
 * Use Cencori with streamText(), generateText(), and useChat()
 */

import { CencoriChatLanguageModel } from './cencori-chat-model';
import type { CencoriProviderSettings, CencoriChatSettings } from './types';

export interface CencoriProvider {
    /**
     * Create a Cencori chat model for use with Vercel AI SDK
     * 
     * @param modelId - The model ID (e.g., 'gemini-2.5-flash', 'gpt-4o', 'claude-3-opus')
     * @param settings - Optional model-specific settings
     * @returns A LanguageModelV1 compatible model
     * 
     * @example
     * import { cencori } from '@cencori/ai-sdk';
     * import { streamText } from 'ai';
     * 
     * const result = await streamText({
     *   model: cencori('gemini-2.5-flash'),
     *   messages: [{ role: 'user', content: 'Hello!' }]
     * });
     */
    (modelId: string, settings?: CencoriChatSettings): CencoriChatLanguageModel;

    /**
     * Create a chat model (alias for the provider function)
     */
    chat: (modelId: string, settings?: CencoriChatSettings) => CencoriChatLanguageModel;
}

/**
 * Create a Cencori provider instance
 * 
 * @param options - Provider configuration options
 * @returns A Cencori provider
 * 
 * @example
 * import { createCencori } from '@cencori/ai-sdk';
 * 
 * const cencori = createCencori({
 *   apiKey: process.env.CENCORI_API_KEY
 * });
 * 
 * const result = await streamText({
 *   model: cencori('gemini-2.5-flash'),
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 */
export function createCencori(options: CencoriProviderSettings = {}): CencoriProvider {
    const baseUrl = options.baseUrl ?? 'https://cencori.com';
    const apiKey = options.apiKey ?? process.env.CENCORI_API_KEY;

    if (!apiKey) {
        throw new Error('Cencori API key is required. Pass it via options.apiKey or set CENCORI_API_KEY environment variable.');
    }

    const createModel = (modelId: string, settings: CencoriChatSettings = {}) => {
        return new CencoriChatLanguageModel(modelId, {
            apiKey,
            baseUrl,
            headers: options.headers,
            ...settings,
        });
    };

    const provider = function (modelId: string, settings?: CencoriChatSettings) {
        return createModel(modelId, settings);
    } as CencoriProvider;

    provider.chat = createModel;

    return provider;
}

/**
 * Default Cencori provider instance
 * Uses CENCORI_API_KEY environment variable (lazy initialization)
 * 
 * @example
 * import { cencori } from '@cencori/ai-sdk';
 * import { streamText } from 'ai';
 * 
 * const result = await streamText({
 *   model: cencori('gemini-2.5-flash'),
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 */
export const cencori: CencoriProvider = function (modelId: string, settings?: CencoriChatSettings) {
    const apiKey = process.env.CENCORI_API_KEY;
    if (!apiKey) {
        throw new Error('CENCORI_API_KEY environment variable is required. Set it or use createCencori({ apiKey: "..." }) instead.');
    }
    return new CencoriChatLanguageModel(modelId, {
        apiKey,
        baseUrl: 'https://cencori.com',
        ...settings,
    });
} as CencoriProvider;

cencori.chat = cencori;
