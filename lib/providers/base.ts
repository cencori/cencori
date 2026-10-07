/**
 * Base Provider Interface and Types
 * 
 * This file defines the core abstraction layer for all AI providers.
 * All provider implementations (OpenAI, Anthropic, Gemini, Custom) must implement this interface.
 */

/**
 * An image that travels beside a message's text.
 *
 * `url` is either an https URL or a `data:` URL carrying base64 bytes, which is what an agent's
 * image tool returns.
 */
export interface UnifiedImagePart {
    url: string;
    detail?: 'auto' | 'low' | 'high';
}

/**
 * Unified message format across all providers
 *
 * `content` stays a string on purpose: every consumer of it — the security pipeline, custom data
 * rules, masking, token estimation, request logging — reads text. Images ride alongside in
 * `images` so a multimodal turn reaches vision-capable providers without any of those having to
 * learn a second content shape. Providers that cannot take images ignore the field, which leaves
 * them with exactly the text they received before.
 */
export interface UnifiedMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    /** Images accompanying this turn, for providers that accept them. */
    images?: UnifiedImagePart[];
    /** Tool call ID (for tool role messages) */
    toolCallId?: string;
    /** Tool calls made by the model (for assistant role messages) */
    tool_calls?: ToolCall[];
    /**
     * Provider reasoning for an assistant turn (DeepSeek `reasoning_content`).
     * Thinking-mode providers require their own reasoning to be passed back
     * on subsequent requests; dropping it turns the next turn into a 400.
     * Carried out-of-band from `content` so guards, logging and token
     * estimation keep reading visible text only.
     */
    reasoningContent?: string;
}

/**
 * Tool function definition (OpenAI-compatible format)
 */
export interface ToolFunction {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
}

/**
 * Tool definition wrapper
 */
export interface Tool {
    type: 'function';
    function: ToolFunction;
    needsApproval?: boolean;
}

/**
 * Tool call from the model
 */
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

/**
 * Unified chat request
 */
export interface UnifiedChatRequest {
    messages: UnifiedMessage[];
    model: string;
    /** Abort in-flight provider HTTP work when a caller's execution deadline expires. */
    signal?: AbortSignal;
    /** Internal transport activity, including SSE heartbeats discarded by SDK decoders. */
    onStreamActivity?: () => void;
    /**
     * Per-request timeout override (milliseconds). Bounds a single provider
     * attempt, including retries scheduled by the transport. Falls back to the
     * request/client transport timeout, then the adapter default.
     */
    timeoutMs?: number;
    /**
     * Fail the request when its computed provider cost exceeds this USD
     * amount. Enforced after unary calls (exact) — streaming calls enforce it
     * when the final usage is tallied. Never silently ignored: when set, an
     * over-budget call throws BudgetExceededError instead of returning.
     */
    maxCostUsd?: number;
    /**
     * Per-request transport override. Lets a caller attach its own fetch,
     * timeout, retry, and telemetry hooks to one call without minting a new
     * provider instance — the answer to the `globalThis.fetch` workaround.
     */
    transport?: ProviderTransportOptions;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    userId?: string;
    /** Tools available to the model */
    tools?: Tool[];
    /** Control tool usage: 'auto' | 'none' | 'required' | specific tool */
    toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
    /** Context truncation strategy: 'auto' truncates old messages, 'disabled' fails on overflow */
    truncation?: 'auto' | 'disabled';
    /** Whether to allow parallel tool calls (default: true) */
    parallelToolCalls?: boolean;
    frequencyPenalty?: number;
    presencePenalty?: number;
    /** Stable provider-side prefix-cache routing key when supported. */
    promptCacheKey?: string;
    /**
     * Reasoning effort for reasoning-capable models. Forwarded only by
     * providers with a native effort control (OpenAI and Maximo); all others
     * ignore it. Never set for non-reasoning models.
     */
    reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

/**
 * Token usage information
 */
export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    /**
     * Prompt tokens the provider served from, or wrote to, its own cache.
     * Reported alongside rather than folded into `promptTokens`, which stays
     * the count billed at the full input rate — anything that re-derives cost
     * from `promptTokens` would otherwise double-bill them.
     */
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
}

/**
 * Cost breakdown for a request
 */
export interface CostBreakdown {
    providerCostUsd: number;     // Actual cost from provider
    cencoriChargeUsd: number;    // Amount we charge the customer
    markupPercentage: number;    // Legacy response field; always zero for Cencori charges
}

/**
 * Unified chat response
 */
export interface UnifiedChatResponse {
    content: string;
    model: string;
    provider: string;
    usage: TokenUsage;
    cost: CostBreakdown;
    latencyMs: number;
    finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
    /** Tool calls requested by the model */
    toolCalls?: ToolCall[];
    /** Provider reasoning trace (DeepSeek `reasoning_content`), when the model produced one. */
    reasoning?: string;
}

/**
 * Streaming chunk
 */
export interface StreamChunk {
    delta: string;
    finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
    /** Error message if the stream encountered an error */
    error?: string;
    /** Tool calls in this chunk (streamed incrementally) */
    toolCalls?: ToolCall[];
    /** Reasoning-trace delta (DeepSeek `reasoning_content`); accumulates like `delta`. */
    reasoning?: string;
    /**
     * Final token usage, emitted once on the terminal chunk by adapters whose
     * provider reports it. Absent on every earlier chunk, and absent entirely
     * for adapters that cannot report usage — consumers must treat it as
     * optional rather than assuming the last chunk carries it.
     */
    usage?: TokenUsage;
}

/**
 * Model pricing information
 */
export interface ModelPricing {
    inputPer1KTokens: number;
    outputPer1KTokens: number;
    /** Legacy pricing field retained for compatibility; gateway charging ignores it. */
    cencoriMarkupPercentage: number;
    /** Discounted provider rate for cached prompt tokens, when reported. */
    cachedInputPer1KTokens?: number;
    /**
     * Multiplier on the input rate for tokens written to a provider-side cache.
     * Anthropic charges 1.25x the base input rate for a 5-minute cache write
     * (2x for the 1-hour TTL, which nothing here requests). Providers that do
     * not charge a write premium leave this unset and bill writes as input.
     */
    cacheWriteMultiplier?: number;
    /** Prompt-token count above which the long-context rates apply. */
    longContextThresholdTokens?: number;
    longContextInputPer1KTokens?: number;
    longContextOutputPer1KTokens?: number;
    longContextCachedInputPer1KTokens?: number;
    /** Review deadline for temporary/promotional pricing. */
    pricingExpiresAt?: string;
    /** Legacy platform-fee field retained for compatibility; gateway charging ignores it. */
    fixedFeePerRequest?: number;
}

/**
 * Prompt tokens a provider served from, or wrote to, its own prompt cache.
 * Reported separately from the uncached prompt count because providers price
 * them differently — and because providers disagree on whether they are part
 * of the headline prompt-token figure. Anthropic excludes them from
 * `input_tokens`; OpenAI counts cache reads inside `prompt_tokens`.
 */
export interface CachedTokenUsage {
    /** Prompt tokens served from cache, billed at the discounted cache rate. */
    cacheReadTokens?: number;
    /** Prompt tokens written to cache, billed at a premium over the input rate. */
    cacheWriteTokens?: number;
}

/**
 * Split an OpenAI-shaped usage object into billable and cached prompt tokens.
 *
 * OpenAI counts cache reads *inside* `prompt_tokens` and breaks them out under
 * `prompt_tokens_details.cached_tokens`, so billing the headline figure charges
 * cached tokens at the full input rate. Providers on the OpenAI-compatible
 * wire format that omit the details object simply report no cache activity,
 * which yields the original prompt count unchanged.
 *
 * OpenAI does not charge a premium for cache writes, so there is no write
 * component to separate out here.
 */
export function splitOpenAICachedTokens(usage: {
    prompt_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number | null } | null;
}): { promptTokens: number; cached: CachedTokenUsage } {
    const promptTokens = Math.max(0, Number(usage.prompt_tokens) || 0);
    const reported = Math.max(0, Number(usage.prompt_tokens_details?.cached_tokens) || 0);
    // Never let a bogus cache count drive the billable remainder negative.
    const cacheReadTokens = Math.min(reported, promptTokens);
    return {
        promptTokens: promptTokens - cacheReadTokens,
        cached: { cacheReadTokens },
    };
}

/**
 * Calculate provider token cost, including request-wide long-context tiers.
 *
 * `promptTokens` is the count of prompt tokens billed at the full input rate —
 * i.e. NOT served from or written to a provider cache. Adapters whose provider
 * folds cached tokens into its headline prompt count must subtract them before
 * calling; passing them twice double-bills. Omitting `cached` entirely bills
 * every prompt token at the input rate, which is the correct behaviour for
 * providers that report no cache activity.
 */
export function calculateProviderTokenCost(
    promptTokens: number,
    completionTokens: number,
    pricing: ModelPricing,
    cached?: CachedTokenUsage
): number {
    const safe = (value: number | undefined) => Math.max(0, Number(value) || 0);
    const safePromptTokens = safe(promptTokens);
    const safeCompletionTokens = safe(completionTokens);
    const cacheReadTokens = safe(cached?.cacheReadTokens);
    const cacheWriteTokens = safe(cached?.cacheWriteTokens);

    // Providers tier on the size of the whole request, so the threshold has to
    // see cached tokens too — they occupy the context window like any other.
    const totalPromptTokens = safePromptTokens + cacheReadTokens + cacheWriteTokens;
    const useLongContext = pricing.longContextThresholdTokens !== undefined
        && totalPromptTokens > pricing.longContextThresholdTokens;
    const inputRate = useLongContext
        ? pricing.longContextInputPer1KTokens
        : pricing.inputPer1KTokens;
    const outputRate = useLongContext
        ? pricing.longContextOutputPer1KTokens
        : pricing.outputPer1KTokens;

    if (inputRate === undefined || outputRate === undefined) {
        throw new Error('Long-context pricing is incomplete');
    }

    // Fail toward the input rate rather than toward zero: an unpriced cache
    // read is a rate we do not know, not a token we were given for free.
    const cacheReadRate = (useLongContext
        ? pricing.longContextCachedInputPer1KTokens ?? pricing.cachedInputPer1KTokens
        : pricing.cachedInputPer1KTokens) ?? inputRate;
    const cacheWriteRate = inputRate * (pricing.cacheWriteMultiplier ?? 1);

    return (safePromptTokens / 1000) * inputRate
        + (cacheReadTokens / 1000) * cacheReadRate
        + (cacheWriteTokens / 1000) * cacheWriteRate
        + (safeCompletionTokens / 1000) * outputRate;
}

import { BudgetExceededError, ProviderError, RateLimitError } from './errors';

/**
 * First-class transport controls for provider adapters.
 *
 * Every adapter hard-wired `fetch`, `timeout`, and `maxRetries` at
 * construction, which forced downstream agent runtimes to monkey-patch
 * `globalThis.fetch` for tracing, proxying, or telemetry. These options are
 * the supported alternative: injectable per instance (constructor) or per
 * call (`UnifiedChatRequest.transport`), with the historical behaviour as the
 * default so existing callers see zero change.
 */

/** Drop-in fetch compatible with the OpenAI/Anthropic SDK `fetch` option. */
export type ProviderFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ProviderAttemptEvent {
    provider: string;
    model: string;
    /** 1-based attempt number. */
    attempt: number;
}

export interface ProviderRetryEvent extends ProviderAttemptEvent {
    error: unknown;
    nextDelayMs: number;
}

export interface ProviderSettledEvent {
    provider: string;
    model: string;
    attempts: number;
    latencyMs: number;
    error?: unknown;
}

export interface ProviderTransportHooks {
    /** Fires before every attempt, including the first. Must never throw — hook errors are swallowed. */
    onAttempt?: (event: ProviderAttemptEvent) => void;
    /** Fires when a failed attempt will be retried. Must never throw. */
    onRetry?: (event: ProviderRetryEvent) => void;
    /** Fires exactly once per call, success or failure. Must never throw. */
    onSettled?: (event: ProviderSettledEvent) => void;
}

export interface ProviderTransportOptions {
    /**
     * Custom fetch implementation (tracing proxy, test stub, telemetry
     * wrapper). Adapters that already route through `safeProviderFetch` keep
     * it as the default; adapters on the SDK/global default keep that.
     * The SSRF guard is only as strong as the fetch you inject — wrap
     * `safeProviderFetch`, don't replace it, unless you mean to.
     */
    fetch?: ProviderFetch;
    /** Per-attempt timeout in milliseconds. */
    timeoutMs?: number;
    /** Retries after the first attempt. SDK clients stay at 0 unless set — the gateway owns cross-provider failover. */
    maxRetries?: number;
    /** Base delay for exponential retry backoff. Doubles per attempt. */
    retryBaseDelayMs?: number;
    hooks?: ProviderTransportHooks;
}

/** Historical adapter behaviour, preserved as the default. */
export const DEFAULT_PROVIDER_TIMEOUT_MS = 55_000;
export const DEFAULT_PROVIDER_MAX_RETRIES = 0;
export const DEFAULT_PROVIDER_RETRY_BASE_DELAY_MS = 500;
/** Upper bound so a misconfigured `maxRetries` cannot loop a call for minutes. */
export const MAX_PROVIDER_RETRIES = 10;

export interface ResolvedProviderTransport {
    /** Undefined means "whatever this adapter used before" — never a silent behaviour change. */
    fetch?: ProviderFetch;
    timeoutMs: number;
    maxRetries: number;
    retryBaseDelayMs: number;
    hooks?: ProviderTransportHooks;
}

function normalizeTimeoutMs(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Resolve the effective transport for one call. Precedence, highest first:
 * per-request `timeoutMs`, per-request `transport`, constructor transport,
 * adapter legacy default. Out-of-range values are sanitized, never thrown —
 * transport resolution must not fail a call that validation already passed.
 */
export function resolveProviderTransport(
    clientTransport?: ProviderTransportOptions,
    request?: Pick<UnifiedChatRequest, 'transport' | 'timeoutMs'> | null,
    fallback?: { timeoutMs?: number; maxRetries?: number },
): ResolvedProviderTransport {
    const fallbackTimeout = normalizeTimeoutMs(fallback?.timeoutMs, DEFAULT_PROVIDER_TIMEOUT_MS);
    const timeoutMs = normalizeTimeoutMs(
        request?.timeoutMs ?? request?.transport?.timeoutMs ?? clientTransport?.timeoutMs,
        fallbackTimeout,
    );
    const rawRetries = request?.transport?.maxRetries ?? clientTransport?.maxRetries ?? fallback?.maxRetries ?? DEFAULT_PROVIDER_MAX_RETRIES;
    const maxRetries = typeof rawRetries === 'number' && Number.isFinite(rawRetries)
        ? Math.min(MAX_PROVIDER_RETRIES, Math.max(0, Math.floor(rawRetries)))
        : DEFAULT_PROVIDER_MAX_RETRIES;
    const retryBaseDelayMs = normalizeTimeoutMs(
        request?.transport?.retryBaseDelayMs ?? clientTransport?.retryBaseDelayMs,
        DEFAULT_PROVIDER_RETRY_BASE_DELAY_MS,
    );
    return {
        fetch: request?.transport?.fetch ?? clientTransport?.fetch,
        timeoutMs,
        maxRetries,
        retryBaseDelayMs,
        hooks: request?.transport?.hooks ?? clientTransport?.hooks,
    };
}

/**
 * Combine the caller's cancellation signal with a per-attempt timeout. A new
 * timeout signal is created per call, so every retry attempt gets a fresh
 * deadline rather than sharing one clock across the whole call.
 *
 * The returned `timedOut` reports whether OUR deadline fired while the caller
 * was still live — adapters use it to classify SDK-wrapped aborts as
 * retryable timeouts instead of opaque failures.
 */
export function attemptSignal(
    signal?: AbortSignal | null,
    timeoutMs: number = DEFAULT_PROVIDER_TIMEOUT_MS,
): { signal: AbortSignal | undefined; timedOut: () => boolean } {
    const timeoutSignal = AbortSignal.timeout(normalizeTimeoutMs(timeoutMs, DEFAULT_PROVIDER_TIMEOUT_MS));
    if (!signal) return { signal: timeoutSignal, timedOut: () => timeoutSignal.aborted };
    if (signal.aborted) return { signal, timedOut: () => false };
    const combined = AbortSignal.any([signal, timeoutSignal]);
    return { signal: combined, timedOut: () => timeoutSignal.aborted && !signal.aborted };
}

/**
 * Backwards-compatible convenience over {@link attemptSignal} for call sites
 * (streams) that only need the combined signal.
 */
export function transportSignal(signal?: AbortSignal | null, timeoutMs: number = DEFAULT_PROVIDER_TIMEOUT_MS): AbortSignal | undefined {
    return attemptSignal(signal, timeoutMs).signal;
}

/**
 * Enforce a caller-supplied cost budget against a finished call. No-op when
 * the request carries no budget. Throws BudgetExceededError (never
 * retryable) carrying cost and usage for the caller's circuit-breaker.
 */
export function enforceRequestBudget(args: {
    provider: string;
    model: string;
    costUsd: number;
    budgetUsd?: number | null;
    usage?: TokenUsage;
}): void {
    const { provider, model, costUsd, budgetUsd, usage } = args;
    if (budgetUsd === undefined || budgetUsd === null) return;
    if (typeof budgetUsd !== 'number' || !Number.isFinite(budgetUsd) || budgetUsd < 0) return;
    if (costUsd > budgetUsd) {
        throw new BudgetExceededError(provider, model, costUsd, budgetUsd, usage);
    }
}

function sleepMs(ms: number, signal?: AbortSignal | null): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason ?? new Error('Aborted'));
            return;
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal?.reason ?? new Error('Aborted'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

function isRetryableFailure(error: unknown, callerSignal?: AbortSignal | null): boolean {
    // Caller cancellation is never retried — only our own attempt timeout is.
    if (callerSignal?.aborted) return false;
    if (error instanceof ProviderError) return error.retryable;
    if (error instanceof Error && error.name === 'AbortError') return true;
    const status = (error as { status?: unknown })?.status;
    if (typeof status === 'number') {
        return status === 429 || status === 408 || (status >= 500 && status < 600);
    }
    return false;
}

function safeHook(fn: (() => void) | undefined): void {
    if (!fn) return;
    try {
        fn();
    } catch {
        // Telemetry must never break the call it observes.
    }
}

/**
 * Run one unary provider call with provider-enforced retry, backoff, and
 * telemetry. Only failures classified retryable (`ProviderError.retryable`,
 * HTTP 408/429/5xx, attempt timeouts) are retried; everything else — auth,
 * bad requests, budget overruns, caller cancellation — fails fast on the
 * first attempt. Streaming calls must not use this: a partially-yielded
 * stream cannot be replayed, so streams surface the first error immediately.
 */
export async function runWithProviderRetry<T>(args: {
    provider: string;
    model: string;
    transport: ResolvedProviderTransport;
    callerSignal?: AbortSignal | null;
    operation: () => Promise<T>;
}): Promise<T> {
    const { provider, model, transport, callerSignal, operation } = args;
    const maxAttempts = 1 + transport.maxRetries;
    const startTime = Date.now();
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        safeHook(() => transport.hooks?.onAttempt?.({ provider, model, attempt }));
        try {
            const result = await operation();
            safeHook(() => transport.hooks?.onSettled?.({
                provider, model, attempts: attempt, latencyMs: Date.now() - startTime,
            }));
            return result;
        } catch (error) {
            lastError = error;
            const exhausted = attempt >= maxAttempts;
            if (exhausted || !isRetryableFailure(error, callerSignal)) {
                safeHook(() => transport.hooks?.onSettled?.({
                    provider, model, attempts: attempt, latencyMs: Date.now() - startTime, error,
                }));
                throw error;
            }
            let nextDelayMs = transport.retryBaseDelayMs * 2 ** (attempt - 1);
            if (error instanceof RateLimitError && typeof error.retryAfter === 'number' && Number.isFinite(error.retryAfter)) {
                nextDelayMs = Math.min(Math.max(error.retryAfter * 1000, 0), 60_000);
            }
            safeHook(() => transport.hooks?.onRetry?.({ provider, model, attempt, error, nextDelayMs }));
            await sleepMs(nextDelayMs, callerSignal);
        }
    }

    safeHook(() => transport.hooks?.onSettled?.({
        provider, model, attempts: maxAttempts, latencyMs: Date.now() - startTime, error: lastError,
    }));
    throw lastError;
}

/**
 * Abstract base class for all AI providers
 * All providers must extend this class and implement all methods
 */
export abstract class AIProvider {
    abstract readonly providerName: string;
    /** True only when this adapter faithfully maps tool definitions/results. */
    readonly supportsTools: boolean = false;

    /**
     * Send a chat request (non-streaming)
     */
    abstract chat(request: UnifiedChatRequest): Promise<UnifiedChatResponse>;

    /**
     * Send a chat request (streaming)
     * Returns an async generator that yields chunks of the response
     */
    abstract stream(request: UnifiedChatRequest): AsyncGenerator<StreamChunk>;

    /**
     * Count tokens in text
     * Used for cost estimation and validation
     */
    abstract countTokens(text: string, model?: string): Promise<number>;

    /**
     * Get pricing for a specific model
     * Retrieves from database or provider-specific defaults
     */
    abstract getPricing(model: string): Promise<ModelPricing>;

    /**
     * Test provider connection/authentication
     * Returns true if provider is accessible, false otherwise
     */
    abstract testConnection(): Promise<boolean>;

    /**
     * Calculate cost based on token usage
     * Common implementation for all providers
     */
    protected calculateCost(
        promptTokens: number,
        completionTokens: number,
        pricing: ModelPricing,
        cached?: CachedTokenUsage
    ): number {
        return calculateProviderTokenCost(promptTokens, completionTokens, pricing, cached);
    }
}
