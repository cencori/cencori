/**
 * Minimal JSON-Schema validator (subset) for run structured outputs.
 * Supports: type (object/array/string/number/integer/boolean/null),
 * required, properties, items, enum. Unknown keywords are ignored.
 * Full JSON Schema (oneOf, $ref, formats, …) is out of scope for alpha.
 */

export function validateJsonSchema(schema: unknown, value: unknown, path = '$'): string[] {
    const errors: string[] = [];
    if (!schema || typeof schema !== 'object') return errors;
    const s = schema as Record<string, unknown>;

    if (Array.isArray(s.enum) && !s.enum.some((v) => JSON.stringify(v) === JSON.stringify(value))) {
        errors.push(`${path}: value not in enum`);
        return errors;
    }

    const types = Array.isArray(s.type) ? (s.type as string[]) : s.type !== undefined ? [s.type as string] : [];
    if (types.length > 0) {
        const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' ? (Number.isInteger(value) ? 'integer' : 'number') : typeof value;
        const matches = types.some((t) => t === actual || (t === 'number' && actual === 'integer'));
        if (!matches) {
            errors.push(`${path}: expected ${types.join('|')}, got ${actual}`);
            return errors;
        }
    }

    if ((s.type === 'object' || (!s.type && typeof value === 'object' && value !== null && !Array.isArray(value))) && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        for (const req of (s.required as string[] | undefined) ?? []) {
            if (!(req in obj)) errors.push(`${path}: missing required property '${req}'`);
        }
        const props = (s.properties as Record<string, unknown> | undefined) ?? {};
        for (const [key, sub] of Object.entries(props)) {
            if (key in obj) errors.push(...validateJsonSchema(sub, obj[key], `${path}.${key}`));
        }
    }

    if ((s.type === 'array' || (!s.type && Array.isArray(value))) && Array.isArray(value) && s.items) {
        value.forEach((item, i) => errors.push(...validateJsonSchema(s.items, item, `${path}[${i}]`)));
    }

    return errors;
}
