/**
 * Google Gemini Provider
 * 
 * Implements the AIProvider interface for Google's Gemini models
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    AIProvider,
    UnifiedChatRequest,
    UnifiedChatResponse,
    StreamChunk,
    ModelPricing,
    TokenUsage,
    ProviderTransportOptions,
    ResolvedProviderTransport,
    attemptSignal,
    enforceRequestBudget,
    resolveProviderTransport,
    runWithProviderRetry,
    transportSignal,
} from './base';
import { getPricingFromDB } from './pricing';
import { toGeminiMessages } from './utils';
import type { UnifiedMessage } from './base';
import { InvalidRequestError, normalizeProviderError, ServiceUnavailableError } from './errors';
import { getGoogleApiKey } from './google-env';
import { readResponseBuffer, safeProviderFetch } from '@/lib/security/outbound-url';

/**
 * Google's inline image cap (mirrors VISION_PROVIDER_LIMITS.google in
 * lib/vision/analyze.ts). Remote images are downloaded into memory, so the
 * cap bounds both the fetch and the inline payload.
 */
const GOOGLE_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const GOOGLE_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

/**
 * Rewrite `https:` image URLs to `data:` URLs so the (sync) message
 * converter can inline them. `data:` URLs pass through untouched; anything
 * else throws InvalidRequestError. Downloads run through the SSRF-guarded
 * fetch with the provider's byte cap and a 15s deadline, mirroring the
 * vision layer's normalization.
 *
 * Exported for tests; the adapter calls it at the top of both chat paths.
 */
export async function resolveMessageImages(messages: UnifiedMessage[]): Promise<UnifiedMessage[]> {
    return Promise.all(messages.map(async (msg) => {
        if (!msg.images?.length) return msg;
        const images = await Promise.all(msg.images.map(async (image) => {
            if (image.url.startsWith('data:')) return image;
            if (!/^https?:\/\//i.test(image.url)) {
                throw new InvalidRequestError('google', 'Image URL must be a data: URL or an http(s):// URL.');
            }
            let response: Response;
            try {
                response = await safeProviderFetch(
                    image.url,
                    {
                        headers: { 'User-Agent': 'Cencori-Gateway/1.0 (+https://cencori.com)' },
                        signal: AbortSignal.timeout(15_000),
                    },
                    GOOGLE_MAX_IMAGE_BYTES,
                );
            } catch (error) {
                throw new InvalidRequestError('google', `Could not fetch image URL: ${error instanceof Error ? error.message : 'fetch failed'}.`);
            }
            if (!response.ok) {
                throw new InvalidRequestError('google', `Could not fetch image URL: HTTP ${response.status}.`);
            }
            const mimeType = (response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg').toLowerCase().trim();
            if (!GOOGLE_IMAGE_FORMATS.includes(mimeType)) {
                throw new InvalidRequestError(
                    'google',
                    `Image format "${mimeType}" is not supported by google. ` +
                    `Supported formats: ${GOOGLE_IMAGE_FORMATS.map(m => m.replace('image/', '').toUpperCase()).join(', ')}.`,
                );
            }
            const buffer = await readResponseBuffer(response, GOOGLE_MAX_IMAGE_BYTES);
            return { ...image, url: `data:${mimeType};base64,${buffer.toString('base64')}` };
        }));
        return { ...msg, images };
    }));
}

export class GeminiProvider extends AIProvider {
    readonly providerName = 'google';
    private client: GoogleGenerativeAI;
    private readonly transport?: ProviderTransportOptions;

    constructor(apiKey?: string, transport?: ProviderTransportOptions) {
        super();

        const key = apiKey || getGoogleApiKey();
        if (!key) {
            throw new Error('Gemini API key is required. Set GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_AI_API_KEY, or GEMINI_API_KEY.');
        }

        // NOTE: the Google SDK exposes no fetch/timeout injection — it uses
        // the global fetch. A custom `transport.fetch` is therefore ignored
        // by this adapter (documented, not silent); timeout, retry, hooks,
        // and budget are still provider-enforced via signal + wrapper.
        this.transport = transport;
        this.client = new GoogleGenerativeAI(key);
    }

    async chat(request: UnifiedChatRequest): Promise<UnifiedChatResponse> {
        const transport = resolveProviderTransport(this.transport, request);
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
            const model = this.client.getGenerativeModel({ model: request.model });

            // Convert unified format to Gemini format
            const { history, prompt } = toGeminiMessages(await resolveMessageImages(request.messages));

            const chat = model.startChat({
                history,
                generationConfig: {
                    temperature: request.temperature ?? 0.7,
                    maxOutputTokens: request.maxTokens ?? 2048,
                },
            });

            // Send the message
            const result = await chat.sendMessage(prompt, { signal });
            const response = result.response;
            const text = response.text();

            // Prefer the usage the provider actually billed. countTokens() only
            // sees the prompt string, so it misses history, system instructions
            // and tools, and has no concept of cached content — it is a fallback
            // for responses that arrive without usageMetadata, not the source of
            // truth. It also costs two extra round trips.
            const meta = response.usageMetadata;
            const cachedTokens = Math.max(0, Number(meta?.cachedContentTokenCount) || 0);
            const reportedPromptTokens = Math.max(0, Number(meta?.promptTokenCount) || 0);
            const promptTokens = meta
                ? reportedPromptTokens
                : (await model.countTokens(prompt)).totalTokens;
            const completionTokens = meta
                ? Math.max(0, Number(meta.candidatesTokenCount) || 0)
                : (await model.countTokens(text)).totalTokens;

            // Gemini counts cached content inside promptTokenCount, so bill the
            // remainder at the input rate and the cached slice at its own rate.
            const cacheReadTokens = Math.min(cachedTokens, promptTokens);
            const billablePromptTokens = promptTokens - cacheReadTokens;

            // Get pricing and calculate costs
            const pricing = await this.getPricing(request.model);
            const providerCost = this.calculateCost(
                billablePromptTokens,
                completionTokens,
                pricing,
                { cacheReadTokens }
            );
            const cencoriCharge = providerCost;

            enforceRequestBudget({
                provider: this.providerName,
                model: request.model,
                costUsd: providerCost,
                budgetUsd: request.maxCostUsd,
                usage: {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens,
                },
            });

            return {
                content: text,
                model: request.model,
                provider: this.providerName,
                usage: {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens,
                    ...(cacheReadTokens ? { cacheReadTokens } : {}),
                },
                cost: {
                    providerCostUsd: providerCost,
                    cencoriChargeUsd: cencoriCharge,
                    markupPercentage: 0,
                },
                latencyMs: Date.now() - startTime,
            };
        } catch (error) {
            if (timedOut()) {
                throw new ServiceUnavailableError(this.providerName, error);
            }
            throw normalizeProviderError(this.providerName, error);
        }
    }

    async *stream(request: UnifiedChatRequest): AsyncGenerator<StreamChunk> {
        // Streams never retry: a partially-yielded stream cannot be replayed.
        const transport = resolveProviderTransport(this.transport, request);
        try {
            const model = this.client.getGenerativeModel({ model: request.model });

            const { history, prompt } = toGeminiMessages(await resolveMessageImages(request.messages));

            const chat = model.startChat({
                history,
                generationConfig: {
                    temperature: request.temperature ?? 0.7,
                    maxOutputTokens: request.maxTokens ?? 2048,
                },
            });

            const result = await chat.sendMessageStream(prompt, {
                signal: transportSignal(request.signal, transport.timeoutMs),
            });

            for await (const chunk of result.stream) {
                yield {
                    delta: chunk.text(),
                };
            }

            // The aggregated response resolves once the stream drains and is
            // the only place the billed usage appears. Never let a missing
            // figure fail a stream that already delivered its content — the
            // gateway falls back to estimating when usage is absent.
            let usage: TokenUsage | undefined;
            try {
                const meta = (await result.response).usageMetadata;
                if (meta) {
                    const promptTokens = Math.max(0, Number(meta.promptTokenCount) || 0);
                    const cacheReadTokens = Math.min(
                        Math.max(0, Number(meta.cachedContentTokenCount) || 0),
                        promptTokens,
                    );
                    usage = {
                        promptTokens: promptTokens - cacheReadTokens,
                        completionTokens: Math.max(0, Number(meta.candidatesTokenCount) || 0),
                        totalTokens: Math.max(0, Number(meta.totalTokenCount) || 0),
                        ...(cacheReadTokens ? { cacheReadTokens } : {}),
                    };
                }
            } catch {
                usage = undefined;
            }

            // Stream complete
            yield {
                delta: '',
                finishReason: 'stop',
                ...(usage ? { usage } : {}),
            };
        } catch (error) {
            throw normalizeProviderError(this.providerName, error);
        }
    }

    async countTokens(text: string, model?: string): Promise<number> {
        try {
            const genModel = this.client.getGenerativeModel({
                model: model || 'gemini-2.5-flash'
            });
            const result = await genModel.countTokens(text);
            return result.totalTokens;
        } catch (error) {
            throw normalizeProviderError(this.providerName, error);
        }
    }

    async getPricing(model: string): Promise<ModelPricing> {
        return getPricingFromDB('google', model);
    }

    async testConnection(): Promise<boolean> {
        try {
            const model = this.client.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const result = await model.generateContent('test');
            return !!result.response.text();
        } catch {
            return false;
        }
    }
}
