import type { CencoriClient, ErrorResponse } from '../client';

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatParams {
    messages: Message[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    userId?: string;
}

export interface ChatResponse {
    content: string;
    model: string;
    provider: string;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    cost_usd: number;
    finish_reason: 'stop' | 'length' | 'content_filter' | 'error';
}

export interface StreamChunk {
    delta: string;
    finish_reason?: 'stop' | 'length' | 'content_filter' | 'error';
    /** Error message if the stream encountered an error (e.g., rate limit, provider failure) */
    error?: string;
}

export class AIModule {
    constructor(private client: CencoriClient) { }

    /**
     * Send a chat completion request (non-streaming)
     */
    async chat(params: ChatParams): Promise<ChatResponse> {
        const response = await this.client.request<ChatResponse>('/api/ai/chat', {
            method: 'POST',
            body: JSON.stringify({ ...params, stream: false }),
        });

        return response;
    }

    /**
     * Send a chat completion request with streaming
     * Returns an async generator that yields chunks as they arrive
     */
    async *chatStream(params: ChatParams): AsyncGenerator<StreamChunk, void, unknown> {
        const url = `${this.client.getBaseUrl()}/api/ai/chat`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'CENCORI_API_KEY': this.client.getApiKey(),
        };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...params, stream: true }),
        });

        if (!response.ok) {
            const error = await response.json() as ErrorResponse;
            throw new Error(error.error || 'Stream request failed');
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
                    } catch (e) {
                        console.error('Failed to parse SSE data:', e);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }
}
