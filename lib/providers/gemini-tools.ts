/**
 * Function calling for the native Gemini adapter: tool definitions in,
 * tool calls out, and tool calls / results in conversation history.
 *
 * Gemini takes a subset of JSON Schema (OpenAPI 3.0 style): no `$schema`,
 * `additionalProperties`, `oneOf`/`allOf`, `const`, `default`… and an
 * OBJECT with no properties is refused. MCP servers and webhook tools send
 * full JSON Schema, so schemas are reduced to what Gemini accepts.
 *
 * Thinking models attach a `thoughtSignature` to each function call that
 * must come back with it on the next turn (Gemini 3 rejects a turn without
 * it). Tool loops keep only a call's id, name and arguments, so the
 * signature rides inside the id (`gem_<n>.<signature>`) and is restored
 * when history is rebuilt.
 */

import { randomBytes } from 'crypto';
import type { ToolCall, UnifiedChatRequest } from './base';

type JsonSchema = Record<string, unknown>;

/** What a Gemini schema node may carry. */
const GEMINI_STRING_FORMATS = new Set(['enum', 'date-time']);
const GEMINI_NUMBER_FORMATS = new Set(['float', 'double', 'int32', 'int64']);
const MAX_DEPTH = 12;
/** Signatures longer than this aren't carried (ids travel through events and logs). */
const MAX_SIGNATURE_CHARS = 16_000;

/**
 * Reduce a JSON Schema to Gemini's subset. `["string","null"]` becomes a
 * nullable string; `anyOf`/`oneOf` keep their first non-null branch; an
 * object without properties becomes a JSON string the model fills in.
 */
export function toGeminiSchema(schema: unknown, depth = 0): JsonSchema {
    const node = (schema && typeof schema === 'object' && !Array.isArray(schema) ? schema : {}) as JsonSchema;
    if (depth > MAX_DEPTH) return { type: 'string' };

    const union = (Array.isArray(node.anyOf) ? node.anyOf : Array.isArray(node.oneOf) ? node.oneOf : null) as JsonSchema[] | null;
    if (union) {
        const branches = union.filter((branch) => branch && branch.type !== 'null');
        const picked = toGeminiSchema({ ...(branches[0] ?? { type: 'string' }), ...(typeof node.description === 'string' ? { description: node.description } : {}) }, depth + 1);
        return branches.length < union.length ? { ...picked, nullable: true } : picked;
    }
    if (Array.isArray(node.allOf) && node.allOf.length > 0) {
        const merged = (node.allOf as JsonSchema[]).reduce<JsonSchema>((acc, part) => ({
            ...acc,
            ...part,
            properties: { ...(acc.properties as JsonSchema ?? {}), ...(part?.properties as JsonSchema ?? {}) },
            required: [...((acc.required as string[]) ?? []), ...((part?.required as string[]) ?? [])],
        }), {});
        return toGeminiSchema({ ...merged, description: node.description ?? merged.description }, depth + 1);
    }

    let type = node.type;
    let nullable = node.nullable === true;
    if (Array.isArray(type)) {
        nullable = nullable || type.includes('null');
        type = type.find((t) => t !== 'null') ?? 'string';
    }
    if (typeof type !== 'string') type = node.properties ? 'object' : node.items ? 'array' : node.enum ? 'string' : 'string';

    const out: JsonSchema = { type };
    if (typeof node.description === 'string' && node.description) out.description = node.description.slice(0, 1000);
    if (nullable) out.nullable = true;

    switch (type) {
        case 'object': {
            const properties = (node.properties && typeof node.properties === 'object' ? node.properties : {}) as Record<string, unknown>;
            const names = Object.keys(properties);
            if (names.length === 0) {
                // Gemini refuses empty objects; take free-form ones as a JSON string.
                return { type: 'string', description: `${out.description ? `${out.description} ` : ''}(a JSON object)`.trim(), ...(nullable ? { nullable: true } : {}) };
            }
            out.properties = Object.fromEntries(names.map((name) => [name, toGeminiSchema(properties[name], depth + 1)]));
            const required = (Array.isArray(node.required) ? node.required : []).filter((name): name is string => typeof name === 'string' && names.includes(name));
            if (required.length > 0) out.required = required;
            break;
        }
        case 'array':
            out.items = toGeminiSchema(node.items ?? { type: 'string' }, depth + 1);
            if (typeof node.minItems === 'number') out.minItems = node.minItems;
            if (typeof node.maxItems === 'number') out.maxItems = node.maxItems;
            break;
        case 'string':
            if (Array.isArray(node.enum)) {
                const values = node.enum.filter((v) => typeof v === 'string');
                if (values.length > 0) {
                    out.enum = values;
                    out.format = 'enum';
                }
            } else if (typeof node.format === 'string' && GEMINI_STRING_FORMATS.has(node.format)) {
                out.format = node.format;
            }
            break;
        case 'number':
        case 'integer':
            if (typeof node.format === 'string' && GEMINI_NUMBER_FORMATS.has(node.format)) out.format = node.format;
            if (Array.isArray(node.enum)) {
                // Gemini enums are strings only; keep the choices in the description.
                out.description = `${out.description ? `${out.description} ` : ''}One of: ${node.enum.join(', ')}.`;
            }
            break;
        case 'boolean':
            break;
        default:
            out.type = 'string';
    }
    return out;
}

type GeminiFunctionDeclaration = { name: string; description?: string; parameters?: JsonSchema };

/** The request's function tools as Gemini declarations. Parameter-less tools carry no schema. */
export function toGeminiTools(tools: UnifiedChatRequest['tools']): Array<{ functionDeclarations: GeminiFunctionDeclaration[] }> | undefined {
    const declarations = (tools ?? [])
        .filter((tool) => tool?.type === 'function' && tool.function?.name)
        .map((tool) => {
            const parameters = toGeminiSchema(tool.function.parameters ?? { type: 'object', properties: {} });
            return {
                name: tool.function.name.slice(0, 64),
                ...(tool.function.description ? { description: tool.function.description.slice(0, 2000) } : {}),
                // An object with no properties came back as a string: the tool takes no input.
                ...(parameters.type === 'object' ? { parameters } : {}),
            };
        });
    return declarations.length > 0 ? [{ functionDeclarations: declarations }] : undefined;
}

/** `tool_choice` as Gemini's function-calling mode. */
export function toGeminiToolConfig(choice: UnifiedChatRequest['toolChoice'], hasTools: boolean) {
    if (!hasTools || !choice || choice === 'auto') return undefined;
    if (choice === 'none') return { functionCallingConfig: { mode: 'NONE' } };
    if (choice === 'required') return { functionCallingConfig: { mode: 'ANY' } };
    return { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [choice.function.name] } };
}

/** A call id that carries the call's thought signature, when it has one. */
export function geminiCallId(signature?: string): string {
    const id = `gem_${randomBytes(6).toString('hex')}`;
    return signature && signature.length <= MAX_SIGNATURE_CHARS ? `${id}.${signature}` : id;
}

export function geminiCallSignature(id: string | undefined): string | undefined {
    if (!id?.startsWith('gem_')) return undefined;
    const dot = id.indexOf('.');
    return dot === -1 ? undefined : id.slice(dot + 1);
}

type RawPart = { text?: string; thought?: boolean; functionCall?: { name?: string; args?: unknown }; thoughtSignature?: string };

/** Function calls in a response's parts, as unified tool calls. */
export function geminiToolCalls(parts: RawPart[] | undefined): ToolCall[] {
    return (parts ?? [])
        .filter((part) => part?.functionCall?.name)
        .map((part) => ({
            id: geminiCallId(part.thoughtSignature),
            type: 'function' as const,
            function: { name: part.functionCall!.name!, arguments: JSON.stringify(part.functionCall!.args ?? {}) },
        }));
}
