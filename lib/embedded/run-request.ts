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
