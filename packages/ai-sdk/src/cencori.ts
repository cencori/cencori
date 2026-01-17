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

import type { CencoriConfig } from './types';
import { AINamespace } from './ai';
import { ComputeNamespace } from './compute';
import { WorkflowNamespace } from './workflow';
import { StorageNamespace } from './storage';

const DEFAULT_BASE_URL = 'https://cencori.com';

export class Cencori {
    private config: Required<CencoriConfig>;

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
    constructor(config: CencoriConfig = {}) {
        const apiKey = config.apiKey ?? process.env.CENCORI_API_KEY;

        if (!apiKey) {
            throw new Error(
                'Cencori API key is required. ' +
                'Pass it via new Cencori({ apiKey: "csk_..." }) or set CENCORI_API_KEY environment variable.'
            );
        }

        this.config = {
            apiKey,
            baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
            headers: config.headers ?? {},
        };

        // Initialize namespaces
        this.ai = new AINamespace(this.config);
        this.compute = new ComputeNamespace();
        this.workflow = new WorkflowNamespace();
        this.storage = new StorageNamespace();
    }

    /**
     * Get the current configuration (API key is masked)
     */
    getConfig(): { baseUrl: string; apiKeyHint: string } {
        return {
            baseUrl: this.config.baseUrl,
            apiKeyHint: `${this.config.apiKey.slice(0, 6)}...${this.config.apiKey.slice(-4)}`,
        };
    }
}

// Export types
export type { CencoriConfig, ChatRequest, ChatResponse, ChatMessage } from './types';
export type { AINamespace } from './ai';
export type { ComputeNamespace } from './compute';
export type { WorkflowNamespace } from './workflow';
export type { StorageNamespace } from './storage';
