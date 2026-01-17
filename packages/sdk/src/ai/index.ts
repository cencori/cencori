/**
 * AI Gateway - Chat, Completions, Embeddings, and Streaming
 * 
 * @example
 * const response = await cencori.ai.chat({
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 */

import type {
    CencoriConfig,
    ChatRequest,
    ChatResponse,
    CompletionRequest,
    EmbeddingRequest,
    EmbeddingResponse
} from '../types';

// API Response types
interface OpenAIChatResponse {
    id: string;
    model: string;
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
}

interface OpenAIEmbeddingResponse {
    model: string;
    data?: Array<{
        embedding: number[];
    }>;
    usage?: {
        total_tokens?: number;
    };
}

/**
 * Stream chunk from chat stream
 */
export interface StreamChunk {
    delta: string;
    finish_reason?: 'stop' | 'length' | 'content_filter' | 'error';
    /** Error message if the stream encountered an error */
    error?: string;
}

export class AINamespace {
    private config: Required<CencoriConfig>;

    constructor(config: Required<CencoriConfig>) {
        this.config = config;
    }

    /**
     * Create a chat completion
     * 
     * @example
     * const response = await cencori.ai.chat({
     *   model: 'gpt-4o',
     *   messages: [{ role: 'user', content: 'Hello!' }]
     * });
     */
    async chat(request: ChatRequest): Promise<ChatResponse> {
        const response = await fetch(`${this.config.baseUrl}/api/ai/chat`, {
            method: 'POST',
            headers: {
                'CENCORI_API_KEY': this.config.apiKey,
                'Content-Type': 'application/json',
                ...this.config.headers,
            },
            body: JSON.stringify({
                model: request.model,
                messages: request.messages,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                stream: false,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
            throw new Error(`Cencori API error: ${errorData.error || response.statusText}`);
        }

        const data = await response.json() as OpenAIChatResponse;

        return {
            id: data.id,
            model: data.model,
            content: data.choices?.[0]?.message?.content ?? '',
            usage: {
                promptTokens: data.usage?.prompt_tokens ?? 0,
                completionTokens: data.usage?.completion_tokens ?? 0,
                totalTokens: data.usage?.total_tokens ?? 0,
            },
        };
    }

    /**
     * Stream chat completions
     * Returns an async generator that yields chunks as they arrive
     * 
     * @example
     * for await (const chunk of cencori.ai.chatStream({ model: 'gpt-4o', messages })) {
     *   process.stdout.write(chunk.delta);
     * }
     */
    async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
        const response = await fetch(`${this.config.baseUrl}/api/ai/chat`, {
            method: 'POST',
            headers: {
                'CENCORI_API_KEY': this.config.apiKey,
                'Content-Type': 'application/json',
                ...this.config.headers,
            },
            body: JSON.stringify({
                model: request.model,
                messages: request.messages,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
            throw new Error(`Cencori API error: ${errorData.error || response.statusText}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');

                // Keep the last incomplete line in the buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (!line.startsWith('data: ')) continue;

                    const data = line.slice(6); // Remove 'data: ' prefix

                    if (data === '[DONE]') {
                        return;
                    }

                    try {
                        const chunk = JSON.parse(data) as StreamChunk;
                        yield chunk;
                    } catch {
                        // Skip malformed JSON
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Create a text completion
     * 
     * @example
     * const response = await cencori.ai.completions({
     *   model: 'gpt-4o',
     *   prompt: 'Write a haiku about coding'
     * });
     */
    async completions(request: CompletionRequest): Promise<ChatResponse> {
        // Convert to chat format internally
        return this.chat({
            model: request.model,
            messages: [{ role: 'user', content: request.prompt }],
            temperature: request.temperature,
            maxTokens: request.maxTokens,
        });
    }

    /**
     * Create embeddings
     * 
     * @example
     * const response = await cencori.ai.embeddings({
     *   model: 'text-embedding-3-small',
     *   input: 'Hello world'
     * });
     */
    async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
        const response = await fetch(`${this.config.baseUrl}/api/v1/embeddings`, {
            method: 'POST',
            headers: {
                'CENCORI_API_KEY': this.config.apiKey,
                'Content-Type': 'application/json',
                ...this.config.headers,
            },
            body: JSON.stringify({
                model: request.model,
                input: request.input,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
            throw new Error(`Cencori API error: ${errorData.error || response.statusText}`);
        }

        const data = await response.json() as OpenAIEmbeddingResponse;

        return {
            model: data.model,
            embeddings: data.data?.map((d) => d.embedding) ?? [],
            usage: {
                totalTokens: data.usage?.total_tokens ?? 0,
            },
        };
    }
}

