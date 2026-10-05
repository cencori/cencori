/**
 * Utility functions for Cencori SDK
 */

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry on transient failures.
 *
 * Retries 429 (honoring the server's Retry-After hint up to a 30s cap),
 * 502/503/504, and transport errors with exponential backoff (1s, 2s, 4s).
 * Other 4xx fail fast — retrying them burns budget for nothing. Returns the
 * final response for the caller to interpret (a persistent 429 still surfaces
 * as a RateLimitError carrying its retry hint).
 */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRY_AFTER_MS = 30_000;

function retryAfterMs(response: Response): number | null {
    const raw = response.headers.get('Retry-After');
    if (raw == null) return null;
    const seconds = Number(raw.trim());
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return Math.min(Math.ceil(seconds * 1000), MAX_RETRY_AFTER_MS);
}

export async function fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            if (response.ok || !RETRYABLE_STATUS.has(response.status)) {
                return response;
            }

            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

            // Don't retry on last attempt
            if (attempt === maxRetries - 1) {
                return response;
            }

            // Honor the server's backoff hint, else exponential backoff.
            await sleep(retryAfterMs(response) ?? Math.pow(2, attempt) * 1000);
        } catch (error) {
            // A caller abort is intentional — never retry it.
            if (error instanceof Error && error.name === 'AbortError') throw error;
            if (options.signal?.aborted) {
                throw error instanceof Error ? error : new Error(String(error));
            }
            lastError = error instanceof Error ? error : new Error(String(error));

            // Don't retry on last attempt
            if (attempt === maxRetries - 1) {
                throw lastError;
            }

            // Exponential backoff
            await sleep(Math.pow(2, attempt) * 1000);
        }
    }

    throw lastError || new Error('Max retries reached');
}
