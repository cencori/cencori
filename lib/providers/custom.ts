/**
 * Custom Provider
 * 
 * Allows users to configure their own AI provider endpoints
 * Supports OpenAI-compatible and Anthropic-compatible APIs
 */

import {
    AIProvider,
    UnifiedChatRequest,
    UnifiedChatResponse,
    StreamChunk,
    ModelPricing,
    ProviderFetch,
    ProviderTransportOptions,
    ResolvedProviderTransport,
    attemptSignal,
    enforceRequestBudget,
    resolveProviderTransport,
    runWithProviderRetry,
    transportSignal,
} from './base';
import { toOpenAIMessages, toAnthropicMessages, estimateTokenCount } from './utils';
import { normalizeProviderError, ServiceUnavailableError } from './errors';
import { safeOutboundFetch } from '@/lib/security/outbound-url';

export interface CustomProviderConfig {
    baseUrl: string;
    apiKey?: string;
    format: 'openai' | 'anthropic'; // Which API format to use
    organizationId?: string; // For tracking
    providerId?: string; // Database ID
    pricing?: ModelPricing;
    transport?: ProviderTransportOptions;
}

export class CustomProvider extends AIProvider {
    readonly providerName = 'custom';
    private config: CustomProviderConfig;

    constructor(config: CustomProviderConfig) {
        super();
        this.config = config;
    }

    async chat(request: UnifiedChatRequest): Promise<UnifiedChatResponse> {
        const transport = resolveProviderTransport(this.config.transport, request);
        return runWithProviderRetry({
            provider: this.providerName,
            model: request.model,
            transport,
            callerSignal: request.signal,
            operation: () => this.executeChat(request, transport),
        });
    }

    private async executeChat(request: UnifiedChatRequest, transport: ResolvedProviderTransport): Promise<UnifiedChatResponse> {
        const startTime = Date.now();
        const { signal, timedOut } = attemptSignal(request.signal, transport.timeoutMs);

        try {
            const body = this.formatRequest(request);

            const response = await this.fetchImpl(transport)(`${this.config.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
                },
                body: JSON.stringify(body),
                signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Custom provider error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            const result = this.parseResponse(data, request.model, startTime);
            enforceRequestBudget({
                provider: this.providerName,
                model: request.model,
                costUsd: result.cost.providerCostUsd,
                budgetUsd: request.maxCostUsd,
                usage: result.usage,
            });
            return result;
        } catch (error) {
            if (timedOut()) {
                throw new ServiceUnavailableError(this.providerName, error);
            }
            throw normalizeProviderError(this.providerName, error);
        }
    }

    /**
     * Transport fetch with the SSRF-guarded default this adapter always used.
     * NOTE: unlike the other adapters this one previously had NO timeout —
     * direct calls were unbounded (the gateway's 60s outer bound was the only
     * guard). The default 55s attempt timeout now applies uniformly.
     */
    private fetchImpl(transport: ResolvedProviderTransport): ProviderFetch {
        if (transport.fetch) return transport.fetch;
        return (input, init) => safeOutboundFetch(input as string, init ?? {}, { maxRedirects: 0 });
    }

    async *stream(request: UnifiedChatRequest): AsyncGenerator<StreamChunk> {
        // Streams never retry: a partially-yielded stream cannot be replayed.
        const transport = resolveProviderTransport(this.config.transport, request);
        try {
            const body = this.formatRequest(request, true);

            const response = await this.fetchImpl(transport)(`${this.config.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
                },
                body: JSON.stringify(body),
                signal: transportSignal(request.signal, transport.timeoutMs),
            });

            if (!response.ok) {
                throw new Error(`Custom provider error: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const json = line.slice(6);
                        if (json === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(json);
                            const delta = parsed.choices?.[0]?.delta?.content || '';
                            const finishReasonRaw = parsed.choices?.[0]?.finish_reason;
                            const finishReason = finishReasonRaw === 'stop' || finishReasonRaw === 'length' || finishReasonRaw === 'content_filter'
                                ? finishReasonRaw
                                : undefined;

                            yield {
                                delta,
                                finishReason,
                            };
                        } catch {
                            continue;
                        }
                    }
                }
            }
        } catch (error) {
            throw normalizeProviderError(this.providerName, error);
        }
    }

    async countTokens(text: string): Promise<number> {
        // Custom providers typically don't have token counting APIs
        // Use rough estimation
        return estimateTokenCount(text);
    }

    async getPricing(model: string): Promise<ModelPricing> {
        return this.config.pricing || {
            inputPer1KTokens: 0,
            outputPer1KTokens: 0,
            cencoriMarkupPercentage: 0,
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await safeOutboundFetch(this.config.baseUrl, {
                headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
            }, { maxRedirects: 0 });
            return response.ok || response.status === 404; // 404 is OK, means server is reachable
        } catch {
            return false;
        }
    }

    /**
     * Format request based on API format
     */
    private formatRequest(request: UnifiedChatRequest, stream = false): Record<string, unknown> {
        if (this.config.format === 'openai') {
            return {
                model: request.model,
                messages: toOpenAIMessages(request.messages),
                temperature: request.temperature,
                max_tokens: request.maxTokens,
                stream,
                user: request.userId,
            };
        } else if (this.config.format === 'anthropic') {
            const { system, messages } = toAnthropicMessages(request.messages);
            return {
                model: request.model,
                max_tokens: request.maxTokens ?? 4096,
                temperature: request.temperature,
                system,
                messages,
                stream,
            };
        }

        // Default to OpenAI format
        return {
            model: request.model,
            messages: toOpenAIMessages(request.messages),
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            stream,
        };
    }

    /**
     * Parse response based on format
     */
    private parseResponse(data: unknown, model: string, startTime: number): UnifiedChatResponse {
        // Parse OpenAI-compatible response (most common)
        const responseData = data as Record<string, unknown>;
        const usage = (responseData.usage as Record<string, unknown>) || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        };

        const pricing = this.config.pricing || {
            inputPer1KTokens: 0,
            outputPer1KTokens: 0,
            cencoriMarkupPercentage: 0
        };

        const promptTokens = (usage.prompt_tokens as number) || 0;
        const completionTokens = (usage.completion_tokens as number) || 0;

        const providerCost = this.calculateCost(
            promptTokens,
            completionTokens,
            pricing
        );

        const choices = (responseData.choices as Array<Record<string, unknown>>) || [];
        const firstChoice = choices[0] || {};
        const message = (firstChoice.message as Record<string, unknown>) || {};
        const finishReasonRaw = firstChoice.finish_reason || '';
        const finishReason = finishReasonRaw === 'stop' || finishReasonRaw === 'length' || finishReasonRaw === 'content_filter'
            ? finishReasonRaw
            : undefined;

        return {
            content: (message.content as string) || '',
            model,
            provider: this.providerName,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens: (usage.total_tokens as number) || 0,
            },
            cost: {
                providerCostUsd: providerCost,
                cencoriChargeUsd: providerCost,
                markupPercentage: 0,
            },
            latencyMs: Date.now() - startTime,
            finishReason,
        };
    }
}
