/** Preserve request controls in the run row without changing the public input shape. */
const RUN_REQUEST_MARKER = '__cencori_run_request_v1';

export interface RunResponseFormat {
    type: 'json_schema';
    json_schema: { name?: string; schema: Record<string, unknown>; strict?: boolean };
}

export function isRunResponseFormat(value: unknown): value is RunResponseFormat {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const format = value as Record<string, unknown>;
    if (format.type !== 'json_schema' || !format.json_schema || typeof format.json_schema !== 'object' || Array.isArray(format.json_schema)) return false;
    const jsonSchema = format.json_schema as Record<string, unknown>;
    return Boolean(jsonSchema.schema && typeof jsonSchema.schema === 'object' && !Array.isArray(jsonSchema.schema));
}

export function encodeRunRequest(input: unknown, responseFormat?: RunResponseFormat, mode = 'background'): Record<string, unknown> {
    return { [RUN_REQUEST_MARKER]: true, input, ...(responseFormat ? { response_format: responseFormat } : {}), mode };
}

/**
 * Deterministic JSON serialization with recursively sorted object keys.
 * Postgres `jsonb` does not preserve key insertion order (keys are stored
 * sorted), so a plain `JSON.stringify` comparison between a freshly encoded
 * request and a row read back from the database can report a false mismatch
 * for semantically identical bodies. This helper mirrors `JSON.stringify`
 * semantics (skipping `undefined`, preserving array order) while sorting
 * object keys so identical payloads compare equal regardless of storage
 * round-trip ordering.
 */
export function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    // Respect toJSON (e.g. Date) exactly like JSON.stringify does.
    const maybeJson = value as { toJSON?: unknown };
    if (typeof maybeJson.toJSON === 'function') {
        try {
            return stableStringify((maybeJson.toJSON as () => unknown).call(value));
        } catch {
            return JSON.stringify(value) ?? 'null';
        }
    }
    if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined && typeof entry !== 'function' && typeof entry !== 'symbol')
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
}

/**
 * Idempotency body comparison: true when a stored `input_ref` matches the
 * freshly encoded request, tolerating key-order normalization from `jsonb`
 * round-trips. Also accepts legacy rows that stored only the raw input.
 */
export function sameRunRequestBody(stored: unknown, persistedRequest: Record<string, unknown>): boolean {
    try {
        if (stableStringify(stored) === stableStringify(persistedRequest)) return true;
    } catch {
        return false;
    }
    // Legacy rows (pre-envelope) stored only the raw input.
    const decoded = decodeRunRequest(stored);
    const legacyShape = decoded.responseFormat === undefined && decoded.mode === undefined;
    if (legacyShape) {
        try {
            const input = (persistedRequest as Record<string, unknown>).input;
            const mode = (persistedRequest as Record<string, unknown>).mode;
            const hasFormat = (persistedRequest as Record<string, unknown>).response_format !== undefined;
            return !hasFormat && (mode === undefined || mode === 'background') && stableStringify(stored) === stableStringify(input);
        } catch {
            return false;
        }
    }
    return false;
}

export function decodeRunRequest(stored: unknown): { input: unknown; responseFormat?: RunResponseFormat; mode?: string } {
    if (stored && typeof stored === 'object' && !Array.isArray(stored) && (stored as Record<string, unknown>)[RUN_REQUEST_MARKER] === true) {
        const record = stored as Record<string, unknown>;
        return {
            input: record.input ?? {},
            ...(isRunResponseFormat(record.response_format) ? { responseFormat: record.response_format } : {}),
            mode: typeof record.mode === 'string' ? record.mode : undefined,
        };
    }
    // Runs created before this envelope stored only input_ref.
    return { input: stored ?? {} };
}
