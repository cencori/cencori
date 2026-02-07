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
    EmbeddingResponse,
    GenerateObjectRequest,
    GenerateObjectResponse,
    ImageGenerationRequest,
    ImageGenerationResponse,
    ToolCall
} from '../types';

// API Response types
interface OpenAIChatResponse {
    id: string;
    model: string;
    choices?: Array<{
        message?: {
            content?: string;
            tool_calls?: Array<{
                id: string;
                type: 'function';
                function: {
                    name: string;
                    arguments: string;
                };
            }>;
        };
        finish_reason?: string;
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
    finish_reason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
    /** Tool calls in progress during streaming */
    toolCalls?: ToolCall[];
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
                tools: request.tools,
                toolChoice: request.toolChoice,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
            throw new Error(`Cencori API error: ${errorData.error || response.statusText}`);
        }

        const data = await response.json() as OpenAIChatResponse;

        const choice = data.choices?.[0];
        const toolCalls = choice?.message?.tool_calls?.map(tc => ({
            id: tc.id,
            type: tc.type as 'function',
            function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
            },
        }));

        return {
            id: data.id,
            model: data.model,
            content: choice?.message?.content ?? '',
            toolCalls,
            finishReason: choice?.finish_reason as ChatResponse['finishReason'],
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
                tools: request.tools,
                toolChoice: request.toolChoice,
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
        const response = await fetch(`${this.config.baseUrl}/api/ai/embeddings`, {
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

    /**
     * Generate structured output with JSON schema
     * 
     * @example
     * const response = await cencori.ai.generateObject({
     *   model: 'gpt-4o',
     *   prompt: 'Generate a user profile',
     *   schema: {
     *     type: 'object',
     *     properties: {
     *       name: { type: 'string' },
     *       age: { type: 'number' }
     *     },
     *     required: ['name', 'age']
     *   }
     * });
     * console.log(response.object); // { name: 'John', age: 30 }
     */
    async generateObject<T = unknown>(request: GenerateObjectRequest): Promise<GenerateObjectResponse<T>> {
        // Build messages from prompt or use provided messages
        const messages = request.messages ?? [
            { role: 'user' as const, content: request.prompt ?? '' }
        ];

        // Use function calling to enforce JSON schema
        const response = await fetch(`${this.config.baseUrl}/api/ai/chat`, {
            method: 'POST',
            headers: {
                'CENCORI_API_KEY': this.config.apiKey,
                'Content-Type': 'application/json',
                ...this.config.headers,
            },
            body: JSON.stringify({
                model: request.model,
                messages,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                stream: false,
                tools: [{
                    type: 'function',
                    function: {
                        name: request.schemaName ?? 'generate_object',
                        description: request.schemaDescription ?? 'Generate a structured object matching the schema',
                        parameters: request.schema,
                    },
                }],
                toolChoice: {
                    type: 'function',
                    function: { name: request.schemaName ?? 'generate_object' },
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
            throw new Error(`Cencori API error: ${errorData.error || response.statusText}`);
        }

        const data = await response.json() as OpenAIChatResponse;
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

        if (!toolCall) {
            throw new Error('Model did not return structured output');
        }

        let parsedObject: T;
        try {
            parsedObject = JSON.parse(toolCall.function.arguments) as T;
        } catch {
            throw new Error('Failed to parse structured output as JSON');
        }

        return {
            object: parsedObject,
            usage: {
                promptTokens: data.usage?.prompt_tokens ?? 0,
                completionTokens: data.usage?.completion_tokens ?? 0,
                totalTokens: data.usage?.total_tokens ?? 0,
            },
        };
    }

    /**
     * Generate images from a text prompt
     * 
     * @example
     * const response = await cencori.ai.generateImage({
     *   prompt: 'A futuristic city at sunset',
     *   model: 'dall-e-3',
     *   size: '1024x1024'
     * });
     * console.log(response.images[0].url);
     */
    async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
        const response = await fetch(`${this.config.baseUrl}/api/ai/images/generate`, {
            method: 'POST',
            headers: {
                'CENCORI_API_KEY': this.config.apiKey,
                'Content-Type': 'application/json',
                ...this.config.headers,
            },
            body: JSON.stringify({
                prompt: request.prompt,
                model: request.model ?? 'dall-e-3',
                n: request.n,
                size: request.size,
                quality: request.quality,
                style: request.style,
                responseFormat: request.responseFormat,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string; message?: string };
            throw new Error(`Cencori API error: ${errorData.message || errorData.error || response.statusText}`);
        }

        const data = await response.json() as {
            images: Array<{ url?: string; b64_json?: string; revisedPrompt?: string }>;
            model: string;
            provider: string;
        };

        return {
            images: data.images.map(img => ({
                url: img.url,
                b64Json: img.b64_json,
                revisedPrompt: img.revisedPrompt,
            })),
            model: data.model,
            provider: data.provider,
        };
    }
}

