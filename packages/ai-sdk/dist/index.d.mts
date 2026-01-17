import { C as CencoriConfig } from './types-Be_rWV2h.mjs';
export { c as ChatMessage, a as ChatRequest, b as ChatResponse, d as CompletionRequest, E as EmbeddingRequest, e as EmbeddingResponse } from './types-Be_rWV2h.mjs';
import { AINamespace } from './ai/index.mjs';
import { ComputeNamespace } from './compute/index.mjs';
import { WorkflowNamespace } from './workflow/index.mjs';
import { StorageNamespace } from './storage/index.mjs';
export { CencoriChatSettings, CencoriProvider, CencoriProviderSettings, cencori, createCencori } from './vercel/index.mjs';
import '@ai-sdk/provider';

/**
 * Cencori - Unified AI Infrastructure SDK
 *
 * One SDK for AI Gateway, Compute, Workflow, and Storage.
 * Every operation is secured, logged, and tracked.
 *
 * @example
 * import { Cencori } from 'cencori';
 *
 * const cencori = new Cencori({ apiKey: 'csk_...' });
 *
 * // AI Gateway
 * const response = await cencori.ai.chat({
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 *
 * // Compute (coming soon)
 * await cencori.compute.run('my-function', { input: data });
 *
 * // Workflow (coming soon)
 * await cencori.workflow.trigger('pipeline-id', { data });
 *
 * // Storage (coming soon)
 * await cencori.storage.vectors.search('query');
 */

declare class Cencori {
    private config;
    /**
     * AI Gateway - Chat, completions, embeddings with security & observability
     *
     * @example
     * await cencori.ai.chat({ model: 'gpt-4o', messages: [...] });
     */
    readonly ai: AINamespace;
    /**
     * Compute - Serverless functions & GPU access
     *
     * 🚧 Coming Soon
     *
     * @example
     * await cencori.compute.run('my-function', { input: data });
     */
    readonly compute: ComputeNamespace;
    /**
     * Workflow - AI pipelines & orchestration
     *
     * 🚧 Coming Soon
     *
     * @example
     * await cencori.workflow.trigger('pipeline-id', { data });
     */
    readonly workflow: WorkflowNamespace;
    /**
     * Storage - Vector database, knowledge base, RAG
     *
     * 🚧 Coming Soon
     *
     * @example
     * await cencori.storage.vectors.search('query');
     */
    readonly storage: StorageNamespace;
    /**
     * Create a new Cencori client
     *
     * @param config - Configuration options
     * @param config.apiKey - Your Cencori API key (starts with 'csk_')
     * @param config.baseUrl - Custom API base URL (default: https://cencori.com)
     * @param config.headers - Custom headers to include in requests
     *
     * @example
     * const cencori = new Cencori({
     *   apiKey: process.env.CENCORI_API_KEY
     * });
     */
    constructor(config?: CencoriConfig);
    /**
     * Get the current configuration (API key is masked)
     */
    getConfig(): {
        baseUrl: string;
        apiKeyHint: string;
    };
}

export { AINamespace, Cencori, CencoriConfig, ComputeNamespace, StorageNamespace, WorkflowNamespace, Cencori as default };
