/** Default timeout for outbound MCP → Cencori HTTP calls. */
export const FETCH_TIMEOUT_MS = 15_000;

/** Timeout for slow inference calls (image/document/audio generation). */
export const LONG_FETCH_TIMEOUT_MS = 60_000;

export function fetchSignal(timeoutMs: number = FETCH_TIMEOUT_MS): AbortSignal {
    return AbortSignal.timeout(timeoutMs);
}

/**
 * Extract a useful error message from a failed HTTP response.
 * Prefers JSON `error` / `error.message` over bare statusText, and appends
 * `Retry-After` when present so rate-limited callers know to back off.
 */
export async function readHttpErrorMessage(response: Response): Promise<string> {
    const errorData = (await response.json().catch(() => null)) as
        | { error?: string | { message?: string; code?: string } }
        | null;

    let message: string;
    if (typeof errorData?.error === 'string') {
        message = errorData.error;
    } else if (errorData?.error && typeof errorData.error === 'object' && errorData.error.message) {
        message = errorData.error.message;
    } else {
        message = response.statusText || `HTTP ${response.status}`;
    }

    const retryAfter = response.headers.get('retry-after');
    if (!retryAfter) {
        return message;
    }
    return /^\d+$/.test(retryAfter) ? `${message} (retry after ${retryAfter}s)` : `${message} (retry after ${retryAfter})`;
}
