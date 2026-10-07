/**
 * Provider Error Classes
 * 
 * Unified error handling for all AI providers
 */

import type { TokenUsage } from './base';

export class ProviderError extends Error {
    /**
     * Upstream HTTP status when known, preserved from the original error.
     * Lets retry logic classify by status code instead of message
     * substrings — a bare "500" previously fell through to non-retryable.
     */
    public status?: number;
    constructor(
        public provider: string,
        message: string,
        public originalError?: unknown,
        public retryable: boolean = false,
        status?: number
    ) {
        super(`[${provider}] ${message}`);
        this.name = 'ProviderError';
        this.status = status ?? readErrorStatus(originalError);
    }
}

/** Numeric HTTP status off an SDK error (`status`, `statusCode`), if present. */
function readErrorStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    for (const key of ['status', 'statusCode'] as const) {
        const value = (error as Record<string, unknown>)[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return undefined;
}

/** Bare status code in a message, e.g. "500 Internal Server Error". */
function readMessageStatus(message: string): number | undefined {
    const match = message.match(/\b(408|429|500|502|503|504)\b/);
    return match ? Number(match[1]) : undefined;
}

export class AuthenticationError extends ProviderError {
    constructor(provider: string, originalError?: unknown) {
        super(provider, 'Authentication failed. Check API key configuration.', originalError, false);
        this.name = 'AuthenticationError';
    }
}

export class RateLimitError extends ProviderError {
    constructor(
        provider: string,
        public retryAfter?: number,
        originalError?: unknown
    ) {
        super(provider, 'Rate limit exceeded.', originalError, true);
        this.name = 'RateLimitError';
    }
}

export class InvalidRequestError extends ProviderError {
    constructor(provider: string, message: string, originalError?: unknown) {
        super(provider, `Invalid request: ${message}`, originalError, false);
        this.name = 'InvalidRequestError';
    }
}

export class ModelNotFoundError extends ProviderError {
    constructor(provider: string, modelName: string, originalError?: unknown) {
        super(provider, `Model '${modelName}' not found or not accessible.`, originalError, false);
        this.name = 'ModelNotFoundError';
    }
}

export class ServiceUnavailableError extends ProviderError {
    constructor(provider: string, originalError?: unknown) {
        super(provider, 'Service temporarily unavailable.', originalError, true);
        this.name = 'ServiceUnavailableError';
    }
}

export class ContentFilterError extends ProviderError {
    constructor(provider: string, originalError?: unknown) {
        super(provider, 'Content filtered by provider safety system.', originalError, false);
        this.name = 'ContentFilterError';
    }
}

export class PricingUnavailableError extends ProviderError {
    constructor(provider: string, model: string, detail?: string) {
        super(
            provider,
            `Pricing is not configured for ${provider}/${model}${detail ? `: ${detail}` : ''}`,
            undefined,
            false
        );
        this.name = 'PricingUnavailableError';
    }
}

export class ModelAccessDeniedError extends ProviderError {
    constructor(provider: string, model: string) {
        super(provider, `API key is not authorized to use ${provider}/${model}.`, undefined, false);
        this.name = 'ModelAccessDeniedError';
    }
}

/**
 * Thrown when a request's computed provider cost exceeds the caller's
 * `maxCostUsd` budget. Never retryable — retrying a call that already
 * overspent only spends more. Carries the offending cost and usage so
 * callers can circuit-break the loop that issued the request.
 */
export class BudgetExceededError extends ProviderError {
    public readonly costUsd: number;
    public readonly budgetUsd: number;
    public readonly usage?: TokenUsage;

    constructor(provider: string, model: string, costUsd: number, budgetUsd: number, usage?: TokenUsage) {
        super(
            provider,
            `Request cost $${costUsd.toFixed(6)} exceeds budget $${budgetUsd.toFixed(6)} for ${provider}/${model}.`,
            undefined,
            false
        );
        this.name = 'BudgetExceededError';
        this.costUsd = costUsd;
        this.budgetUsd = budgetUsd;
        this.usage = usage;
    }
}

/**
 * Convert provider-specific errors to unified error types
 */
export function normalizeProviderError(provider: string, error: unknown): ProviderError {
    if (error instanceof ProviderError) {
        return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorLower = errorMessage.toLowerCase();

    // Authentication errors
    if (errorLower.includes('unauthorized') ||
        errorLower.includes('invalid api key') ||
        errorLower.includes('authentication')) {
        return new AuthenticationError(provider, error);
    }

    // Rate limit errors
    if (errorLower.includes('rate limit') ||
        errorLower.includes('too many requests') ||
        errorLower.includes('429')) {
        return new RateLimitError(provider, undefined, error);
    }

    // Model not found
    // Groq's actual string is "The model 'gpt-oss-120b' does not exist or you
    // do not have access to it" — contains "does not exist", not "model not
    // found", so it previously fell through to generic 502. Match both.
    if (errorLower.includes('model not found') ||
        errorLower.includes('model_not_found') ||
        errorLower.includes('unsupported model') ||
        errorLower.includes('model does not exist') ||
        errorLower.includes('does not exist')) {
        return new ModelNotFoundError(provider, 'unknown', error);
    }

    // HTTP 408 / 5xx by status code or message — retryable outages. A bare
    // "500" previously fell through to generic non-retryable while the
    // gateway's own classifier treated it as retryable; classify once, here.
    const statusCode = readErrorStatus(error) ?? readMessageStatus(errorMessage);
    if (statusCode === 408 || (statusCode !== undefined && statusCode >= 500 && statusCode < 600)) {
        return new ServiceUnavailableError(provider, error);
    }

    // Service unavailable
    if (errorLower.includes('service unavailable') ||
        errorLower.includes('503') ||
        errorLower.includes('timeout')) {
        return new ServiceUnavailableError(provider, error);
    }

    // Content filter
    if (errorLower.includes('content_filter') ||
        errorLower.includes('safety') ||
        errorLower.includes('blocked')) {
        return new ContentFilterError(provider, error);
    }

    // Invalid request
    if (errorLower.includes('invalid') ||
        errorLower.includes('bad request') ||
        errorLower.includes('400')) {
        return new InvalidRequestError(provider, errorMessage, error);
    }

    // Generic provider error
    return new ProviderError(provider, errorMessage, error, false);
}
