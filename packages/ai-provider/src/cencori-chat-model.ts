/**
 * Cencori Chat Language Model
 * 
 * Implements the Vercel AI SDK's LanguageModelV3 interface (AI SDK v6 compatible)
 */

import type {
    LanguageModelV3,
    LanguageModelV3CallOptions,
    LanguageModelV3GenerateResult,
    LanguageModelV3StreamResult,
    LanguageModelV3StreamPart,
    LanguageModelV3Content,
    LanguageModelV3Usage,
    LanguageModelV3FinishReason,
    SharedV3Warning,
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

export class CencoriChatLanguageModel implements LanguageModelV3 {
    readonly specificationVersion = 'v3' as const;
    readonly provider = 'cencori';

    readonly modelId: string;
    readonly supportedUrls: Record<string, RegExp[]> = {};
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

    private convertMessages(options: LanguageModelV3CallOptions): CencoriMessage[] {
        const messages: CencoriMessage[] = [];

        // In V3, options.prompt is directly an array of LanguageModelV3Message
        const promptMessages = options.prompt;

        if (!promptMessages || !Array.isArray(promptMessages)) {
            return messages;
        }

        for (const msg of promptMessages) {
            let content = '';

            if (msg.role === 'system') {
                // System messages have content as string directly
                content = msg.content as string;
            } else if (msg.role === 'user' || msg.role === 'assistant') {
                // User and assistant messages have content as array of parts
                const msgContent = msg.content;
                if (Array.isArray(msgContent)) {
                    content = msgContent
                        .filter((part: { type: string }) => part.type === 'text')
                        .map((part: { type: string; text?: string }) => part.text || '')
                        .join('');
                } else if (typeof msgContent === 'string') {
                    content = msgContent;
                }
            }

            if (content && (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant')) {
                messages.push({
                    role: msg.role as 'system' | 'user' | 'assistant',
                    content,
                });
            }
        }

        return messages;
    }

    private mapFinishReason(reason?: string): LanguageModelV3FinishReason {
        let unified: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other';

        switch (reason) {
            case 'stop':
            case 'end_turn':
                unified = 'stop';
                break;
            case 'length':
            case 'max_tokens':
                unified = 'length';
                break;
            case 'content_filter':
                unified = 'content-filter';
                break;
            case 'tool_calls':
            case 'tool-calls':
                unified = 'tool-calls';
                break;
            case 'error':
                unified = 'error';
                break;
            default:
                unified = 'stop';
        }

        return { unified, raw: reason };
    }

    private buildUsage(inputTokens: number, outputTokens: number): LanguageModelV3Usage {
        return {
            inputTokens: {
                total: inputTokens,
                noCache: inputTokens,
                cacheRead: undefined,
                cacheWrite: undefined,
            },
            outputTokens: {
                total: outputTokens,
                text: outputTokens,
                reasoning: undefined,
            },
        };
    }

    async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
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

        const content: LanguageModelV3Content[] = [{
            type: 'text',
            text: data.content,
            providerMetadata: undefined,
        }];

        const warnings: SharedV3Warning[] = [];

        return {
            content,
            finishReason: this.mapFinishReason(data.finish_reason),
            usage: this.buildUsage(data.usage.prompt_tokens, data.usage.completion_tokens),
            warnings,
        };
    }

    async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
        const messages = this.convertMessages(options);
        const self = this;

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
        const textPartId = 'text-0';
        let started = false;

        const stream = new ReadableStream<LanguageModelV3StreamPart>({
            async pull(controller) {
                try {
                    const { done, value } = await reader.read();

                    if (done) {
                        // End text block and finish
                        if (started) {
                            controller.enqueue({
                                type: 'text-end',
                                id: textPartId,
                            });
                        }
                        controller.enqueue({
                            type: 'finish',
                            finishReason: self.mapFinishReason('stop'),
                            usage: self.buildUsage(inputTokens, outputTokens),
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
                            if (started) {
                                controller.enqueue({
                                    type: 'text-end',
                                    id: textPartId,
                                });
                            }
                            controller.enqueue({
                                type: 'finish',
                                finishReason: self.mapFinishReason('stop'),
                                usage: self.buildUsage(inputTokens, outputTokens),
                            });
                            controller.close();
                            return;
                        }

                        try {
                            const chunk = JSON.parse(data) as CencoriStreamChunk;

                            if (chunk.delta) {
                                // Start text if not started
                                if (!started) {
                                    started = true;
                                    controller.enqueue({
                                        type: 'text-start',
                                        id: textPartId,
                                    });
                                }

                                outputTokens += Math.ceil(chunk.delta.length / 4); // Rough estimate
                                controller.enqueue({
                                    type: 'text-delta',
                                    id: textPartId,
                                    delta: chunk.delta,
                                });
                            }

                            if (chunk.finish_reason) {
                                if (started) {
                                    controller.enqueue({
                                        type: 'text-end',
                                        id: textPartId,
                                    });
                                }
                                controller.enqueue({
                                    type: 'finish',
                                    finishReason: self.mapFinishReason(chunk.finish_reason),
                                    usage: self.buildUsage(inputTokens, outputTokens),
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
        };
    }
}
