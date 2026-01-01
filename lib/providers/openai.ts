/**
 * OpenAI Provider
 * 
 * Implements the AIProvider interface for OpenAI's GPT models
 */

import OpenAI from 'openai';
import {
    AIProvider,
    UnifiedChatRequest,
    UnifiedChatResponse,
    StreamChunk,
    ModelPricing,
} from './base';
import { getPricingFromDB } from './pricing';
import { toOpenAIMessages, estimateTokenCount } from './utils';
import { normalizeProviderError } from './errors';

export class OpenAIProvider extends AIProvider {
    readonly providerName = 'openai';
    private client: OpenAI;

    constructor(apiKey?: string) {
        super();

        const key = apiKey || process.env.OPENAI_API_KEY;
        if (!key) {
            throw new Error('OpenAI API key is required - either pass it or set OPENAI_API_KEY env var');
        }

        this.client = new OpenAI({
            apiKey: key
        });
    }

    async chat(request: UnifiedChatRequest): Promise<UnifiedChatResponse> {
        const startTime = Date.now();

        try {
            const completion = await this.client.chat.completions.create({
                model: request.model,
                messages: toOpenAIMessages(request.messages),
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens,
                stream: false,
                user: request.userId,
            });

            const usage = completion.usage!;
            const pricing = await this.getPricing(request.model);

            const providerCost = this.calculateCost(
                usage.prompt_tokens,
                usage.completion_tokens,
                pricing
            );

            const cencoriCharge = this.applyMarkup(providerCost, pricing.cencoriMarkupPercentage);

            // Normalize finish_reason to our type
            const finishReason = completion.choices[0].finish_reason;

            return {
                content: completion.choices[0].message.content || '',
                model: completion.model,
                provider: this.providerName,
                usage: {
                    promptTokens: usage.prompt_tokens,
                    completionTokens: usage.completion_tokens,
                    totalTokens: usage.total_tokens,
                },
                cost: {
                    providerCostUsd: providerCost,
                    cencoriChargeUsd: cencoriCharge,
                    markupPercentage: pricing.cencoriMarkupPercentage,
                },
                latencyMs: Date.now() - startTime,
                finishReason: finishReason === 'stop' || finishReason === 'length' || finishReason === 'content_filter'
                    ? finishReason
                    : undefined,
            };
        } catch (error) {
            throw normalizeProviderError(this.providerName, error);
        }
    }

    async *stream(request: UnifiedChatRequest): AsyncGenerator<StreamChunk> {
        try {
            const stream = await this.client.chat.completions.create({
                model: request.model,
                messages: toOpenAIMessages(request.messages),
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens,
                stream: true,
                user: request.userId,
            });

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content || '';
                const finishReason = chunk.choices[0]?.finish_reason;

                yield {
                    delta,
                    finishReason: finishReason === 'stop' || finishReason === 'length' || finishReason === 'content_filter'
                        ? finishReason
                        : undefined,
                };
            }
        } catch (error) {
            throw normalizeProviderError(this.providerName, error);
        }
    }

    async countTokens(text: string, model?: string): Promise<number> {
        // OpenAI doesn't have a direct token counting API
        // Using tiktoken for accurate estimation
        try {
            const { encoding_for_model } = await import('tiktoken');
            const modelName = model || 'gpt-3.5-turbo';
            // Type assertion for tiktoken model names
            const encoding = encoding_for_model(modelName as Parameters<typeof encoding_for_model>[0]);
            const tokens = encoding.encode(text);
            encoding.free();
            return tokens.length;
        } catch (error) {
            // Fallback to rough estimation if tiktoken fails
            console.warn('[OpenAI] Tiktoken failed, using estimation:', error);
            return estimateTokenCount(text);
        }
    }

    async getPricing(model: string): Promise<ModelPricing> {
        return getPricingFromDB('openai', model);
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.client.models.list();
            return true;
        } catch {
            return false;
        }
    }
}
