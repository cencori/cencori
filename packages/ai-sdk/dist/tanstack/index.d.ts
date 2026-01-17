import { TextAdapter, DefaultMessageMetadataByModality, TextOptions, StreamChunk } from '@tanstack/ai';
export { StreamChunk, TextAdapter, TextOptions } from '@tanstack/ai';

/**
 * Cencori AI SDK - TanStack AI Integration
 *
 * @example
 * import { cencori } from 'cencori/tanstack';
 * import { chat } from '@tanstack/ai';
 *
 * const result = await chat({
 *   adapter: cencori('gpt-4o'),
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 *
 * @packageDocumentation
 */

/**
 * Cencori provider options
 */
interface CencoriProviderOptions {
    /** Cencori API key */
    apiKey?: string;
    /** Base URL for Cencori API (defaults to https://cencori.com) */
    baseUrl?: string;
    /** Custom headers */
    headers?: Record<string, string>;
}
/**
 * Cencori model-specific options
 */
interface CencoriModelOptions {
    /** User ID for attribution */
    userId?: string;
}
declare const CENCORI_CHAT_MODELS: readonly ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "claude-3-5-sonnet", "claude-3-opus", "claude-3-haiku", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-3-pro", "grok-4", "grok-3", "mistral-large", "codestral", "deepseek-v3.2", "deepseek-reasoner", "llama-3-70b", "mixtral-8x7b"];
type CencoriChatModel = (typeof CENCORI_CHAT_MODELS)[number];
/**
 * Cencori adapter for TanStack AI
 */
declare class CencoriTextAdapter implements TextAdapter<CencoriChatModel, CencoriModelOptions, readonly ['text', 'image'], DefaultMessageMetadataByModality> {
    readonly kind: "text";
    readonly name = "cencori";
    readonly model: CencoriChatModel;
    '~types': {
        providerOptions: CencoriModelOptions;
        inputModalities: readonly ['text', 'image'];
        messageMetadataByModality: DefaultMessageMetadataByModality;
    };
    private config;
    private providerOptions;
    constructor(model: CencoriChatModel, options?: CencoriProviderOptions);
    /**
     * Stream chat completions from the model
     */
    chatStream(options: TextOptions<CencoriModelOptions>): AsyncIterable<StreamChunk>;
    /**
     * Generate structured output
     */
    structuredOutput(options: {
        chatOptions: TextOptions<CencoriModelOptions>;
        outputSchema: any;
    }): Promise<{
        data: unknown;
        rawText: string;
    }>;
    private generateId;
}
/**
 * Create a Cencori adapter for TanStack AI
 *
 * @example
 * import { createCencori } from 'cencori/tanstack';
 *
 * const myProvider = createCencori({ apiKey: 'csk_...' });
 * const adapter = myProvider('gpt-4o');
 */
declare function createCencori(options?: CencoriProviderOptions): <T extends CencoriChatModel>(model: T) => CencoriTextAdapter;
/**
 * Default Cencori provider
 * Uses CENCORI_API_KEY environment variable
 *
 * @example
 * import { cencori } from 'cencori/tanstack';
 * import { chat } from '@tanstack/ai';
 *
 * const result = await chat({
 *   adapter: cencori('gpt-4o'),
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 */
declare function cencori<T extends CencoriChatModel>(model: T): CencoriTextAdapter;

export { CENCORI_CHAT_MODELS, type CencoriChatModel, type CencoriModelOptions, type CencoriProviderOptions, CencoriTextAdapter, cencori, createCencori };
