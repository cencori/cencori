/**
 * Shared types for Cencori SDK
 */
interface CencoriConfig {
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
interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
interface ChatRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}
interface ChatResponse {
    id: string;
    model: string;
    content: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
interface CompletionRequest {
    model: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
}
interface EmbeddingRequest {
    model: string;
    input: string | string[];
}
interface EmbeddingResponse {
    model: string;
    embeddings: number[][];
    usage: {
        totalTokens: number;
    };
}
interface ComputeRunOptions {
    input?: Record<string, unknown>;
    timeout?: number;
}
interface WorkflowTriggerOptions {
    data?: Record<string, unknown>;
    async?: boolean;
}
interface VectorSearchOptions {
    limit?: number;
    filter?: Record<string, unknown>;
}

export type { CencoriConfig as C, EmbeddingRequest as E, VectorSearchOptions as V, WorkflowTriggerOptions as W, ChatRequest as a, ChatResponse as b, ChatMessage as c, CompletionRequest as d, EmbeddingResponse as e, ComputeRunOptions as f };
