/**
 * Cencori AI SDK - TanStack AI Integration
 * 
 * @example
 * import { cencori } from '@cencori/ai-sdk/tanstack';
 * import { chat } from '@tanstack/ai';
 * 
 * const result = await chat({
 *   adapter: cencori('gpt-4o'),
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * 
 * @packageDocumentation
 */

import type {
    TextAdapter,
    TextOptions,
    StreamChunk,
    ContentStreamChunk,
    DoneStreamChunk,
    ErrorStreamChunk,
    Modality,
    DefaultMessageMetadataByModality,
} from '@tanstack/ai';

// Re-export types for convenience
export type {
    TextAdapter,
    TextOptions,
    StreamChunk,
};

/**
 * Cencori provider options
 */
export interface CencoriProviderOptions {
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
export interface CencoriModelOptions {
    /** User ID for attribution */
    userId?: string;
}

// All models supported through Cencori Gateway
export const CENCORI_CHAT_MODELS = [
    // OpenAI
    'gpt-4o',
    'gpt-4o-mini',
    'o1',
    'o1-mini',
    // Anthropic
    'claude-3-5-sonnet',
    'claude-3-opus',
    'claude-3-haiku',
    // Google
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3-pro',
    // xAI
    'grok-4',
    'grok-3',
    // Mistral
    'mistral-large',
    'codestral',
    // DeepSeek
    'deepseek-v3.2',
    'deepseek-reasoner',
    // Groq
    'llama-3-70b',
    'mixtral-8x7b',
] as const;

export type CencoriChatModel = (typeof CENCORI_CHAT_MODELS)[number];

/**
 * Cencori adapter for TanStack AI
 */
class CencoriTextAdapter implements TextAdapter<
    CencoriChatModel,
    CencoriModelOptions,
    readonly ['text', 'image'],
    DefaultMessageMetadataByModality
> {
    readonly kind = 'text' as const;
    readonly name = 'cencori';
    readonly model: CencoriChatModel;

    '~types': {
        providerOptions: CencoriModelOptions;
        inputModalities: readonly ['text', 'image'];
        messageMetadataByModality: DefaultMessageMetadataByModality;
    } = {} as any;

    private config: {
        apiKey: string;
        baseUrl: string;
        headers?: Record<string, string>;
    };
    private providerOptions: CencoriProviderOptions;

    constructor(model: CencoriChatModel, options: CencoriProviderOptions = {}) {
        this.model = model;
        this.providerOptions = options;

        const apiKey = options.apiKey ?? process.env.CENCORI_API_KEY;
        if (!apiKey) {
            throw new Error(
                'Cencori API key is required. Pass it via options.apiKey or set CENCORI_API_KEY environment variable.'
            );
        }

        this.config = {
            apiKey,
            baseUrl: options.baseUrl ?? 'https://cencori.com',
            headers: options.headers,
        };
    }

    /**
     * Stream chat completions from the model
     */
    async *chatStream(options: TextOptions<CencoriModelOptions>): AsyncIterable<StreamChunk> {
        const response = await fetch(`${this.config.baseUrl}/api/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CENCORI_API_KEY': this.config.apiKey!,
                ...this.config.headers,
            },
            body: JSON.stringify({
                model: this.model,
                messages: options.messages,
                temperature: options.temperature,
                maxTokens: options.maxTokens,
                stream: true,
                userId: options.modelOptions?.userId,
            }),
            signal: options.abortController?.signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
            const errorChunk: ErrorStreamChunk = {
                type: 'error',
                id: this.generateId(),
                model: this.model,
                timestamp: Date.now(),
                error: {
                    message: errorData.error || response.statusText,
                    code: String(response.status),
                },
            };
            yield errorChunk;
            return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Response body is null');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let content = '';
        let promptTokens = 0;
        let completionTokens = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    // Emit done chunk
                    const doneChunk: DoneStreamChunk = {
                        type: 'done',
                        id: this.generateId(),
                        model: this.model,
                        timestamp: Date.now(),
                        finishReason: 'stop',
                        usage: {
                            promptTokens,
                            completionTokens,
                            totalTokens: promptTokens + completionTokens,
                        },
                    };
                    yield doneChunk;
                    return;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (!line.startsWith('data: ')) continue;

                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        const doneChunk: DoneStreamChunk = {
                            type: 'done',
                            id: this.generateId(),
                            model: this.model,
                            timestamp: Date.now(),
                            finishReason: 'stop',
                            usage: {
                                promptTokens,
                                completionTokens,
                                totalTokens: promptTokens + completionTokens,
                            },
                        };
                        yield doneChunk;
                        return;
                    }

                    try {
                        const chunk = JSON.parse(data);

                        if (chunk.delta) {
                            content += chunk.delta;
                            completionTokens += Math.ceil(chunk.delta.length / 4);

                            const contentChunk: ContentStreamChunk = {
                                type: 'content',
                                id: this.generateId(),
                                model: this.model,
                                timestamp: Date.now(),
                                delta: chunk.delta,
                                content: content,
                                role: 'assistant',
                            };
                            yield contentChunk;
                        }

                        if (chunk.finish_reason) {
                            const doneChunk: DoneStreamChunk = {
                                type: 'done',
                                id: this.generateId(),
                                model: this.model,
                                timestamp: Date.now(),
                                finishReason: chunk.finish_reason === 'stop' ? 'stop' : null,
                                usage: {
                                    promptTokens,
                                    completionTokens,
                                    totalTokens: promptTokens + completionTokens,
                                },
                            };
                            yield doneChunk;
                            return;
                        }
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
     * Generate structured output
     */
    async structuredOutput(options: {
        chatOptions: TextOptions<CencoriModelOptions>;
        outputSchema: any;
    }): Promise<{ data: unknown; rawText: string }> {
        const response = await fetch(`${this.config.baseUrl}/api/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CENCORI_API_KEY': this.config.apiKey!,
                ...this.config.headers,
            },
            body: JSON.stringify({
                model: this.model,
                messages: options.chatOptions.messages,
                temperature: options.chatOptions.temperature,
                maxTokens: options.chatOptions.maxTokens,
                stream: false,
                responseFormat: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'structured_output',
                        schema: options.outputSchema,
                        strict: true,
                    },
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
            throw new Error(`Cencori API error: ${errorData.error || response.statusText}`);
        }

        const result = await response.json() as { content: string };
        const rawText = result.content;

        try {
            const data = JSON.parse(rawText);
            return { data, rawText };
        } catch {
            throw new Error(`Failed to parse structured output: ${rawText}`);
        }
    }

    private generateId(): string {
        return `cencori-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Create a Cencori adapter for TanStack AI
 * 
 * @example
 * import { createCencori } from '@cencori/ai-sdk/tanstack';
 * 
 * const myProvider = createCencori({ apiKey: 'csk_...' });
 * const adapter = myProvider('gpt-4o');
 */
export function createCencori(options: CencoriProviderOptions = {}) {
    return function cencoriProvider<T extends CencoriChatModel>(model: T) {
        return new CencoriTextAdapter(model, options);
    };
}

/**
 * Default Cencori provider
 * Uses CENCORI_API_KEY environment variable
 * 
 * @example
 * import { cencori } from '@cencori/ai-sdk/tanstack';
 * import { chat } from '@tanstack/ai';
 * 
 * const result = await chat({
 *   adapter: cencori('gpt-4o'),
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 */
export function cencori<T extends CencoriChatModel>(model: T) {
    return new CencoriTextAdapter(model, {});
}

// Export adapter class for advanced use cases
export { CencoriTextAdapter };
