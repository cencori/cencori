import { C as CencoriConfig, a as ChatRequest, b as ChatResponse, d as CompletionRequest, E as EmbeddingRequest, e as EmbeddingResponse } from '../types-Be_rWV2h.mjs';

/**
 * AI Gateway - Chat, Completions, and Embeddings
 *
 * @example
 * const response = await cencori.ai.chat({
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 */

declare class AINamespace {
    private config;
    constructor(config: Required<CencoriConfig>);
    /**
     * Create a chat completion
     *
     * @example
     * const response = await cencori.ai.chat({
     *   model: 'gpt-4o',
     *   messages: [{ role: 'user', content: 'Hello!' }]
     * });
     */
    chat(request: ChatRequest): Promise<ChatResponse>;
    /**
     * Create a text completion
     *
     * @example
     * const response = await cencori.ai.completions({
     *   model: 'gpt-4o',
     *   prompt: 'Write a haiku about coding'
     * });
     */
    completions(request: CompletionRequest): Promise<ChatResponse>;
    /**
     * Create embeddings
     *
     * @example
     * const response = await cencori.ai.embeddings({
     *   model: 'text-embedding-3-small',
     *   input: 'Hello world'
     * });
     */
    embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}

export { AINamespace };
