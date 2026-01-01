import { LanguageModelV1, LanguageModelV1CallOptions, LanguageModelV1FunctionToolCall, LanguageModelV1FinishReason, LanguageModelV1CallWarning, LanguageModelV1LogProbs, LanguageModelV1ProviderMetadata, LanguageModelV1StreamPart } from '@ai-sdk/provider';

/**
 * Cencori Chat Language Model
 *
 * Implements the Vercel AI SDK's LanguageModelV1 interface
 */

interface CencoriChatModelSettings {
    apiKey: string;
    baseUrl: string;
    headers?: Record<string, string>;
    userId?: string;
}
declare class CencoriChatLanguageModel implements LanguageModelV1 {
    readonly specificationVersion: "v1";
    readonly provider = "cencori";
    readonly defaultObjectGenerationMode: "json";
    readonly supportsImageUrls = false;
    readonly modelId: string;
    private readonly settings;
    constructor(modelId: string, settings: CencoriChatModelSettings);
    private getHeaders;
    private convertMessages;
    private mapFinishReason;
    doGenerate(options: LanguageModelV1CallOptions): Promise<{
        text?: string;
        toolCalls?: LanguageModelV1FunctionToolCall[];
        finishReason: LanguageModelV1FinishReason;
        usage: {
            promptTokens: number;
            completionTokens: number;
        };
        rawCall: {
            rawPrompt: unknown;
            rawSettings: Record<string, unknown>;
        };
        rawResponse?: {
            headers?: Record<string, string>;
        };
        warnings?: LanguageModelV1CallWarning[];
        logprobs?: LanguageModelV1LogProbs;
        providerMetadata?: LanguageModelV1ProviderMetadata;
    }>;
    doStream(options: LanguageModelV1CallOptions): Promise<{
        stream: ReadableStream<LanguageModelV1StreamPart>;
        rawCall: {
            rawPrompt: unknown;
            rawSettings: Record<string, unknown>;
        };
        rawResponse?: {
            headers?: Record<string, string>;
        };
        warnings?: LanguageModelV1CallWarning[];
    }>;
}

/**
 * Types for Cencori AI Provider
 */
interface CencoriProviderSettings {
    /**
     * Cencori API key (csk_ or cpk_ prefix)
     */
    apiKey?: string;
    /**
     * Base URL for the Cencori API
     * @default 'https://cencori.com'
     */
    baseUrl?: string;
    /**
     * Custom headers to include in requests
     */
    headers?: Record<string, string>;
}
interface CencoriChatSettings {
    /**
     * Optional user ID for rate limiting and analytics
     */
    userId?: string;
}

/**
 * Cencori AI Provider for Vercel AI SDK
 *
 * Use Cencori with streamText(), generateText(), and useChat()
 */

interface CencoriProvider {
    /**
     * Create a Cencori chat model for use with Vercel AI SDK
     *
     * @param modelId - The model ID (e.g., 'gemini-2.5-flash', 'gpt-4o', 'claude-3-opus')
     * @param settings - Optional model-specific settings
     * @returns A LanguageModelV1 compatible model
     *
     * @example
     * import { cencori } from '@cencori/ai-provider';
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
 * import { createCencori } from '@cencori/ai-provider';
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
declare function createCencori(options?: CencoriProviderSettings): CencoriProvider;
/**
 * Default Cencori provider instance
 * Uses CENCORI_API_KEY environment variable (lazy initialization)
 *
 * @example
 * import { cencori } from '@cencori/ai-provider';
 * import { streamText } from 'ai';
 *
 * const result = await streamText({
 *   model: cencori('gemini-2.5-flash'),
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 */
declare const cencori: CencoriProvider;

export { CencoriChatLanguageModel, type CencoriChatSettings, type CencoriProvider, type CencoriProviderSettings, cencori, createCencori };
