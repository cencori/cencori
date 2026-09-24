/**
 * JSON-Schema subset for run structured outputs. Unsupported assertion
 * keywords are rejected at creation, not silently ignored at completion.
 * Supports: type (object/array/string/number/integer/boolean/null),
 * required, properties, additionalProperties, items, enum. Unknown keywords are ignored.
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
        for (const [key, item] of Object.entries(obj)) {
            if (key in props) continue;
            if (s.additionalProperties === false) errors.push(`${path}: unexpected property '${key}'`);
            else if (s.additionalProperties && typeof s.additionalProperties === 'object') {
                errors.push(...validateJsonSchema(s.additionalProperties, item, `${path}.${key}`));
            }
        }
    }

    if ((s.type === 'array' || (!s.type && Array.isArray(value))) && Array.isArray(value) && s.items) {
        value.forEach((item, i) => errors.push(...validateJsonSchema(s.items, item, `${path}[${i}]`)));
    }

    return errors;
}

const SUPPORTED_KEYWORDS = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'description', 'title', 'default', 'examples', '$schema']);
const SUPPORTED_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);

export function validateRunSchemaDefinition(schema: unknown, path = '$'): string[] {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [`${path}: expected a schema object`];
    const node = schema as Record<string, unknown>;
    const errors: string[] = [];
    for (const key of Object.keys(node)) {
        if (!SUPPORTED_KEYWORDS.has(key)) errors.push(`${path}: unsupported JSON Schema keyword '${key}'`);
    }
    if (node.type !== undefined) {
        const types = Array.isArray(node.type) ? node.type : [node.type];
        if (!types.length || types.some((type) => typeof type !== 'string' || !SUPPORTED_TYPES.has(type))) errors.push(`${path}: invalid type`);
    }
    if (node.required !== undefined && (!Array.isArray(node.required) || node.required.some((name) => typeof name !== 'string'))) errors.push(`${path}: required must be an array of strings`);
    if (node.enum !== undefined && !Array.isArray(node.enum)) errors.push(`${path}: enum must be an array`);
    if (node.properties !== undefined) {
        if (!node.properties || typeof node.properties !== 'object' || Array.isArray(node.properties)) errors.push(`${path}: properties must be an object`);
        else for (const [key, child] of Object.entries(node.properties)) errors.push(...validateRunSchemaDefinition(child, `${path}.properties.${key}`));
    }
    if (node.items !== undefined) errors.push(...validateRunSchemaDefinition(node.items, `${path}.items`));
    if (node.additionalProperties !== undefined && typeof node.additionalProperties !== 'boolean') {
        errors.push(...validateRunSchemaDefinition(node.additionalProperties, `${path}.additionalProperties`));
    }
    return errors;
}
