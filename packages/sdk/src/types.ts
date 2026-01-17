/**
 * Shared types for Cencori SDK
 */

export interface CencoriConfig {
    /**
     * Cencori API key (starts with 'csk_')
     */
    apiKey?: string;

    /**
     * Base URL for Cencori API
     * @default 'https://cencori.com'
     */
    baseUrl?: string;

    /**
     * Custom headers to include in requests
     */
    headers?: Record<string, string>;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}

export interface ChatResponse {
    id: string;
    model: string;
    content: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface CompletionRequest {
    model: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
}

export interface EmbeddingRequest {
    model: string;
    input: string | string[];
}

export interface EmbeddingResponse {
    model: string;
    embeddings: number[][];
    usage: {
        totalTokens: number;
    };
}

// Placeholder types for future products
export interface ComputeRunOptions {
    input?: Record<string, unknown>;
    timeout?: number;
}

export interface WorkflowTriggerOptions {
    data?: Record<string, unknown>;
    async?: boolean;
}

export interface VectorSearchOptions {
    limit?: number;
    filter?: Record<string, unknown>;
}

/**
 * Options for generic API requests
 */
export interface RequestOptions {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: string;
    headers?: Record<string, string>;
}

