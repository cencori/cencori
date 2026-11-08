/**
 * Schemas for tool parameters and structured output, without depending on a
 * validation library. Anything implementing Standard Schema works (zod 3.24+,
 * zod 4, valibot, arktype); JSON Schema is read from Standard JSON Schema
 * (zod 4.2+), a schema's own toJSONSchema(), or given directly as an object.
 */

/** The Standard Schema interface (https://standardschema.dev), inlined. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly '~standard': {
        readonly version: 1;
        readonly vendor: string;
        readonly validate: (value: unknown) =>
            | StandardResult<Output>
            | Promise<StandardResult<Output>>;
        readonly types?: { readonly input: Input; readonly output: Output } | undefined;
        readonly jsonSchema?: {
            readonly input: (options: { target: string }) => Record<string, unknown>;
            readonly output: (options: { target: string }) => Record<string, unknown>;
        };
    };
}

type StandardResult<Output> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> };

/** A JSON Schema object, passed through as is. */
export type JsonSchema = Record<string, unknown>;

/** What tool parameters and outputType accept. */
export type SchemaLike<T = unknown> = StandardSchemaV1<unknown, T> | JsonSchema;

/** The type a schema validates to; `unknown` for plain JSON Schema. */
export type InferSchema<S> = S extends StandardSchemaV1<unknown, infer O> ? O : unknown;

function isStandard(schema: unknown): schema is StandardSchemaV1 {
    return typeof schema === 'object' && schema !== null && '~standard' in schema
        && typeof (schema as StandardSchemaV1)['~standard']?.validate === 'function';
}

/** JSON Schema for a tool's parameters or an output type. */
export function toJsonSchema(schema: SchemaLike | undefined): JsonSchema {
    if (!schema) return { type: 'object', properties: {}, additionalProperties: false };
    let json: JsonSchema | undefined;
    if (isStandard(schema)) {
        const std = schema['~standard'];
        if (std.jsonSchema) {
            json = std.jsonSchema.input({ target: 'draft-2020-12' });
        } else if (typeof (schema as { toJSONSchema?: unknown }).toJSONSchema === 'function') {
            json = (schema as unknown as { toJSONSchema: () => JsonSchema }).toJSONSchema();
        } else if (std.vendor === 'zod' && (schema as { _def?: { typeName?: unknown } })._def?.typeName) {
            json = zod3ToJsonSchema(schema as unknown as Zod3);
        } else {
            throw new TypeError(
                `This ${std.vendor} schema can't be converted to JSON Schema. Use zod 4, a library that implements Standard JSON Schema, or pass a JSON Schema object.`,
            );
        }
    } else {
        json = schema;
    }
    // Providers want the bare schema; the $schema keyword only adds noise.
    const { $schema: _ignored, ...rest } = json as JsonSchema & { $schema?: unknown };
    return rest;
}

export class SchemaValidationError extends Error {
    readonly issues: ReadonlyArray<{ message: string; path?: string }>;
    constructor(what: string, issues: ReadonlyArray<{ message: string; path?: string }>) {
        super(`${what}: ${issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('; ')}`);
        this.name = 'SchemaValidationError';
        this.issues = issues;
    }
}

/** Validate a value against a Standard Schema; JSON Schema values pass through unchecked. */
export async function validate<T>(schema: SchemaLike<T> | undefined, value: unknown, what: string): Promise<T> {
    if (!schema || !isStandard(schema)) return value as T;
    const result = await schema['~standard'].validate(value);
    if (result.issues) {
        throw new SchemaValidationError(what, result.issues.map((issue) => ({
            message: issue.message,
            path: issue.path?.map((p) => String(typeof p === 'object' && p !== null && 'key' in p ? p.key : p)).join('.') || undefined,
        })));
    }
    return result.value as T;
}

/** zod 3 keeps its structure in _def; it has no JSON Schema output of its own. */
interface Zod3 {
    _def: Record<string, unknown> & { typeName: string; description?: string };
    description?: string;
}

/**
 * JSON Schema for the zod 3 types tool parameters use. Anything else throws,
 * naming the type, rather than sending the model a wrong schema.
 */
function zod3ToJsonSchema(schema: Zod3): JsonSchema {
    const def = schema._def;
    const describe = (json: JsonSchema): JsonSchema =>
        def.description ? { ...json, description: def.description } : json;
    switch (def.typeName) {
        case 'ZodString': return describe({ type: 'string' });
        case 'ZodNumber': {
            const checks = (def.checks as Array<{ kind: string }> | undefined) ?? [];
            return describe({ type: checks.some((c) => c.kind === 'int') ? 'integer' : 'number' });
        }
        case 'ZodBigInt': return describe({ type: 'integer' });
        case 'ZodBoolean': return describe({ type: 'boolean' });
        case 'ZodNull': return describe({ type: 'null' });
        case 'ZodDate': return describe({ type: 'string', format: 'date-time' });
        case 'ZodAny':
        case 'ZodUnknown': return describe({});
        case 'ZodLiteral': return describe({ const: def.value });
        case 'ZodEnum': return describe({ type: 'string', enum: def.values as unknown[] });
        case 'ZodNativeEnum': return describe({ enum: Object.values(def.values as Record<string, unknown>) });
        case 'ZodArray': return describe({ type: 'array', items: zod3ToJsonSchema(def.type as Zod3) });
        case 'ZodTuple': return describe({ type: 'array', prefixItems: (def.items as Zod3[]).map(zod3ToJsonSchema) });
        case 'ZodRecord': return describe({ type: 'object', additionalProperties: zod3ToJsonSchema(def.valueType as Zod3) });
        case 'ZodUnion':
        case 'ZodDiscriminatedUnion': {
            const options = (Array.isArray(def.options) ? def.options : [...(def.options as Map<unknown, Zod3>).values()]) as Zod3[];
            return describe({ anyOf: options.map(zod3ToJsonSchema) });
        }
        case 'ZodNullable': return describe({ anyOf: [zod3ToJsonSchema(def.innerType as Zod3), { type: 'null' }] });
        case 'ZodOptional':
        case 'ZodDefault':
        case 'ZodCatch':
        case 'ZodReadonly':
        case 'ZodBranded': {
            const inner = zod3ToJsonSchema((def.innerType ?? def.type) as Zod3);
            return def.description ? { ...inner, description: def.description } : inner;
        }
        case 'ZodEffects': return describe(zod3ToJsonSchema(def.schema as Zod3));
        case 'ZodLazy': return describe(zod3ToJsonSchema((def.getter as () => Zod3)()));
        case 'ZodObject': {
            const shape = (typeof def.shape === 'function' ? (def.shape as () => Record<string, Zod3>)() : def.shape) as Record<string, Zod3>;
            const properties: Record<string, JsonSchema> = {};
            const required: string[] = [];
            for (const [key, value] of Object.entries(shape)) {
                properties[key] = zod3ToJsonSchema(value);
                const kind = value._def.typeName;
                if (kind !== 'ZodOptional' && kind !== 'ZodDefault') required.push(key);
            }
            return describe({
                type: 'object',
                properties,
                ...(required.length ? { required } : {}),
                additionalProperties: def.unknownKeys === 'passthrough',
            });
        }
        default:
            throw new TypeError(`zod type ${def.typeName} isn't supported in tool parameters. Use zod 4 or pass a JSON Schema object.`);
    }
}
