/**
 * Cencori Error Classes
 *
 * Custom error types for better error handling. Every API failure carries
 * the HTTP status, the machine-readable code, the request id (for support
 * correlation), and any retry hint the server sent — so callers never have
 * to guess from a bare message again.
 */

export class CencoriError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public code?: string,
        public options?: {
            requestId?: string | null;
            retryAfterMs?: number | null;
            errorBody?: unknown;
        }
    ) {
        super(message);
        this.name = 'CencoriError';
        Object.setPrototypeOf(this, CencoriError.prototype);
    }

    /** Request id for support correlation (X-Request-Id), when the server sent one. */
    get requestId(): string | null {
        return this.options?.requestId ?? null;
    }

    /** Server-advised wait before retrying, when sent (Retry-After / retry_after_ms). */
    get retryAfterMs(): number | null {
        return this.options?.retryAfterMs ?? null;
    }

    /** True for failures worth retrying: rate limits, bad gateway, unavailable, timeouts. */
    get isRetryable(): boolean {
        if (this.statusCode == null) return true; // transport failure (no response at all)
        return this.statusCode === 429 || (this.statusCode >= 500 && this.statusCode < 600);
    }
}

export class AuthenticationError extends CencoriError {
    constructor(message = 'Invalid API key', options?: { requestId?: string | null }) {
        super(message, 401, 'INVALID_API_KEY', options);
        this.name = 'AuthenticationError';
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}

export class RateLimitError extends CencoriError {
    constructor(
        message = 'Rate limit exceeded',
        public retryAfterSeconds?: number | null,
        options?: { requestId?: string | null; errorBody?: unknown }
    ) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', {
            requestId: options?.requestId,
            retryAfterMs:
                typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
                    ? Math.ceil(retryAfterSeconds * 1000)
                    : null,
            errorBody: options?.errorBody,
        });
        // Preserve the legacy field: some callers read retryAfterSeconds directly.
        this.retryAfterSeconds = retryAfterSeconds;
        this.name = 'RateLimitError';
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}

export class SafetyError extends CencoriError {
    constructor(message = 'Content safety violation', public reasons?: string[], options?: { requestId?: string | null; errorBody?: unknown }) {
        super(message, 400, 'SAFETY_VIOLATION', options);
        this.name = 'SafetyError';
        Object.setPrototypeOf(this, SafetyError.prototype);
    }
}

/** Loose shape of gateway error bodies (flat and OpenAI-envelope variants). */
export interface GatewayErrorBody {
    error?: { message?: string; code?: string; type?: string } | string;
    message?: string;
    code?: string;
    reasons?: string[];
    retry_after_ms?: number;
    retry_after_seconds?: number;
    retry_after?: number;
}

/** Parse a Retry-After header value (seconds, possibly fractional) to ms. */
export function parseRetryAfterMs(value: string | null | undefined): number | null {
    if (value == null) return null;
    const seconds = Number(String(value).trim());
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return Math.ceil(seconds * 1000);
}

/**
 * Build the right typed error from a failed fetch Response + parsed body.
 * Extracts message, machine code, request id, and retry hints in one place so
 * no call site drops them again.
 */
export function throwCencoriError(
    response: { status: number; statusText: string; headers: { get(name: string): string | null } },
    body: GatewayErrorBody | null
): never {
    const requestId = response.headers.get('X-Request-Id');
    const errObj = typeof body?.error === 'object' ? body.error : undefined;
    const message =
        errObj?.message || (typeof body?.error === 'string' ? body.error : undefined) || body?.message || response.statusText || `Request failed with status ${response.status}`;
    const code = errObj?.code || body?.code;
    const reasons = Array.isArray(body?.reasons) ? (body.reasons as string[]) : undefined;

    if (response.status === 401) {
        throw new AuthenticationError(typeof message === 'string' ? message : 'Invalid API key', { requestId });
    }
    if (response.status === 429) {
        const fromHeader = parseRetryAfterMs(response.headers.get('Retry-After'));
        const hint = body as GatewayErrorBody | null;
        const retryAfterMs =
            fromHeader ??
            (typeof hint?.retry_after_ms === 'number' && hint.retry_after_ms >= 0 ? Math.ceil(hint.retry_after_ms) : null) ??
            (typeof hint?.retry_after_seconds === 'number' && hint.retry_after_seconds >= 0 ? Math.ceil(hint.retry_after_seconds * 1000) : null) ??
            (typeof hint?.retry_after === 'number' && hint.retry_after >= 0 ? Math.ceil(hint.retry_after * 1000) : null);
        throw new RateLimitError(typeof message === 'string' ? message : 'Rate limit exceeded', retryAfterMs != null ? retryAfterMs / 1000 : null, {
            requestId,
            errorBody: body ?? undefined,
        });
    }
    if (response.status === 400 && reasons) {
        throw new SafetyError(typeof message === 'string' ? message : 'Content safety violation', reasons, {
            requestId,
            errorBody: body ?? undefined,
        });
    }
    throw new CencoriError(typeof message === 'string' ? message : `Request failed with status ${response.status}`, response.status, code, {
        requestId,
        errorBody: body ?? undefined,
    });
}
