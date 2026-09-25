/**
 * Upstream provider error excerpts for connection test / model-sync diagnostics.
 *
 * Connection probes hit third-party `/models` endpoints. When those return 4xx/5xx
 * the raw body is the only thing that tells `invalid_request_error` apart from
 * bad credentials — but it must never leak key material and must stay small.
 */

const MAX_EXCERPT_CHARS = 500;

function redactSecrets(text: string): string {
    return text
        // OpenAI-style keys, bearer tokens, long hex secrets.
        .replace(/sk-[A-Za-z0-9._\-+/=]{8,}/g, '[redacted]')
        .replace(/Bearer\s+[A-Za-z0-9._\-+/=]{8,}/gi, 'Bearer [redacted]')
        .replace(/x-api-key\s*[:=]\s*[A-Za-z0-9._\-+/=]{8,}/gi, 'x-api-key: [redacted]')
        .replace(/api[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9._\-+/=]{12,}['"]?/gi, 'api_key: [redacted]');
}

function truncate(text: string): string {
    const collapsed = text.replace(/\s+/g, ' ').trim();
    return collapsed.length > MAX_EXCERPT_CHARS
        ? `${collapsed.slice(0, MAX_EXCERPT_CHARS)}…`
        : collapsed;
}

export interface UpstreamErrorDetails {
    code: string | null;
    message: string | null;
    excerpt: string | null;
}

/**
 * Pull a stable `{code, message}` out of an upstream error payload.
 * Handles OpenAI (`{error:{message,code,type}}`), Anthropic
 * (`{error:{message,type}}`), and flat `{message,code}` / `{error: string}` shapes.
 * Always redacted + truncated; never throws.
 */
export function extractUpstreamErrorDetails(raw: unknown): UpstreamErrorDetails {
    if (raw == null) return { code: null, message: null, excerpt: null };
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return { code: null, message: null, excerpt: null };
        try {
            return extractUpstreamErrorDetails(JSON.parse(trimmed));
        } catch {
            return { code: null, message: null, excerpt: truncate(redactSecrets(trimmed)) };
        }
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        return { code: null, message: null, excerpt: null };
    }
    const root = raw as Record<string, unknown>;
    const nested = (root.error && typeof root.error === 'object' && !Array.isArray(root.error)
        ? (root.error as Record<string, unknown>)
        : null);

    const messageRaw =
        (nested?.message ?? root.message ?? (typeof root.error === 'string' ? root.error : null));
    const codeRaw =
        (nested?.code ?? nested?.type ?? root.code ?? root.type ?? null);

    const message = typeof messageRaw === 'string' && messageRaw.trim()
        ? truncate(redactSecrets(messageRaw))
        : null;
    const code = typeof codeRaw === 'string' && codeRaw.trim()
        ? codeRaw.trim().slice(0, 120)
        : null;
    const excerpt = message ?? truncate(redactSecrets(JSON.stringify(root).slice(0, 2000)));

    return { code, message, excerpt };
}
