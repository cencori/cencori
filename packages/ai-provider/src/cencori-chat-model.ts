/**
 * Cencori Chat Language Model
 * 
 * Implements the Vercel AI SDK's LanguageModelV2 interface
 */

import type {
    LanguageModelV2,
    LanguageModelV2CallOptions,
    LanguageModelV2CallWarning,
    LanguageModelV2FinishReason,
    LanguageModelV2StreamPart,
    LanguageModelV2Content,
    LanguageModelV2Usage,
} from '@ai-sdk/provider';

export interface CencoriChatModelSettings {
    apiKey: string;
    baseUrl: string;
    headers?: Record<string, string>;
    userId?: string;
}

interface CencoriMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface CencoriResponse {
    content: string;
    model: string;
    provider: string;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    cost_usd: number;
    finish_reason?: string;
}

interface CencoriStreamChunk {
    delta: string;
    finish_reason?: string;
}

export class CencoriChatLanguageModel implements LanguageModelV2 {
    readonly specificationVersion = 'v2' as const;
    readonly provider = 'cencori';
    readonly defaultObjectGenerationMode = 'json' as const;
    readonly supportsImageUrls = false;
    readonly supportedUrls: Record<string, RegExp[]> = {};

    readonly modelId: string;
    private readonly settings: CencoriChatModelSettings;

    constructor(modelId: string, settings: CencoriChatModelSettings) {
        this.modelId = modelId;
        this.settings = settings;
    }

    private getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'CENCORI_API_KEY': this.settings.apiKey,
            ...this.settings.headers,
        };
    }

    private convertMessages(options: LanguageModelV2CallOptions): CencoriMessage[] {
        const messages: CencoriMessage[] = [];

        // Handle system prompt
        if (options.prompt && typeof options.prompt === 'object' && 'system' in options.prompt && options.prompt.system) {
            messages.push({ role: 'system', content: options.prompt.system as string });
        }

        // Convert AI SDK messages to Cencori format
        if (options.prompt && typeof options.prompt === 'object' && 'messages' in options.prompt) {
            const promptMessages = options.prompt.messages as Array<{
                role: string;
                content: unknown;
            }>;

            for (const msg of promptMessages) {
                let content = '';

                if (typeof msg.content === 'string') {
                    content = msg.content;
                } else if (Array.isArray(msg.content)) {
                    // Handle multipart messages (text + images)
                    content = msg.content
                        .filter((part: { type: string }) => part.type === 'text')
                        .map((part: { type: string; text?: string }) => part.text || '')
                        .join('');
                }

                if (content) {
                    messages.push({
                        role: msg.role as 'system' | 'user' | 'assistant',
                        content,
                    });
                }
            }
        }

        return messages;
    }

    private mapFinishReason(reason?: string): LanguageModelV2FinishReason {
        switch (reason) {
            case 'stop':
            case 'end_turn':
                return 'stop';
            case 'length':
            case 'max_tokens':
                return 'length';
            case 'content_filter':
                return 'content-filter';
            case 'tool_calls':
            case 'tool-calls':
                return 'tool-calls';
            default:
                return 'stop';
        }
    }

    async doGenerate(options: LanguageModelV2CallOptions): Promise<{
        content: LanguageModelV2Content[];
        finishReason: LanguageModelV2FinishReason;
        usage: LanguageModelV2Usage;
        rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
        rawResponse?: { headers?: Record<string, string> };
        warnings: LanguageModelV2CallWarning[];
    }> {
        const messages = this.convertMessages(options);

        const response = await fetch(`${this.settings.baseUrl}/api/ai/chat`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                messages,
                model: this.modelId,
                temperature: options.temperature,
                maxTokens: options.maxOutputTokens,
                stream: false,
                userId: this.settings.userId,
            }),
            signal: options.abortSignal,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
            throw new Error(`Cencori API error: ${error.error || response.statusText}`);
        }

        const data = await response.json() as CencoriResponse;

        const content: LanguageModelV2Content[] = [{
            type: 'text',
            text: data.content,
        }];

        return {
            content,
            finishReason: this.mapFinishReason(data.finish_reason),
            usage: {
                inputTokens: data.usage.prompt_tokens,
                outputTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            },
            rawCall: {
                rawPrompt: messages,
                rawSettings: {
                    model: this.modelId,
                    temperature: options.temperature,
                    maxOutputTokens: options.maxOutputTokens,
                },
            },
            warnings: [],
        };
    }

    async doStream(options: LanguageModelV2CallOptions): Promise<{
        stream: ReadableStream<LanguageModelV2StreamPart>;
        rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
        rawResponse?: { headers?: Record<string, string> };
        warnings: LanguageModelV2CallWarning[];
    }> {
        const messages = this.convertMessages(options);

        const response = await fetch(`${this.settings.baseUrl}/api/ai/chat`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                messages,
                model: this.modelId,
                temperature: options.temperature,
                maxTokens: options.maxOutputTokens,
                stream: true,
                userId: this.settings.userId,
            }),
            signal: options.abortSignal,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
            throw new Error(`Cencori API error: ${error.error || response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Response body is null');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let textPartId = 'text-0';

        const stream = new ReadableStream<LanguageModelV2StreamPart>({
            async pull(controller) {
                try {
                    const { done, value } = await reader.read();

                    if (done) {
                        // Send final usage and finish
                        controller.enqueue({
                            type: 'finish',
                            finishReason: 'stop',
                            usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
                        });
                        controller.close();
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
                            controller.enqueue({
                                type: 'finish',
                                finishReason: 'stop',
                                usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
                            });
                            controller.close();
                            return;
                        }

                        try {
                            const chunk = JSON.parse(data) as CencoriStreamChunk;

                            if (chunk.delta) {
                                outputTokens += Math.ceil(chunk.delta.length / 4); // Rough estimate
                                controller.enqueue({
                                    type: 'text-delta',
                                    id: textPartId,
                                    delta: chunk.delta,
                                });
                            }

                            if (chunk.finish_reason) {
                                controller.enqueue({
                                    type: 'finish',
                                    finishReason: 'stop',
                                    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
                                });
                                controller.close();
                                return;
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                } catch (error) {
                    controller.error(error);
                }
            },
            cancel() {
                reader.cancel();
            },
        });

        return {
            stream,
            rawCall: {
                rawPrompt: messages,
                rawSettings: {
                    model: this.modelId,
                    temperature: options.temperature,
                    maxOutputTokens: options.maxOutputTokens,
                },
            },
            warnings: [],
        };
    }
}
