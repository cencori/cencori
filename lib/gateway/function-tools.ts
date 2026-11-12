import type { Tool } from '@/lib/providers/base';

/**
 * A function tool arrives in one of two shapes: Chat Completions nests the
 * definition (`{ type: 'function', function: { name, parameters } }`), the
 * Responses API keeps it flat (`{ type: 'function', name, parameters }`).
 * Everything past the request boundary reads the nested shape, so the flat one
 * is rewritten here. Anything that isn't a function tool is returned as given.
 */
export function asNestedFunctionTool<T>(tool: T): T | Tool {
    if (!tool || typeof tool !== 'object') return tool;
    const flat = tool as {
        type?: unknown; function?: unknown; name?: unknown; description?: unknown;
        parameters?: unknown; needsApproval?: unknown;
    };
    if (flat.type !== 'function' || (flat.function && typeof flat.function === 'object')) return tool;
    if (typeof flat.name !== 'string' || !flat.name) return tool;
    return {
        type: 'function',
        function: {
            name: flat.name,
            description: typeof flat.description === 'string' ? flat.description : '',
            parameters: flat.parameters && typeof flat.parameters === 'object'
                ? flat.parameters as Record<string, unknown>
                : { type: 'object', properties: {} },
        },
        ...(flat.needsApproval === true ? { needsApproval: true } : {}),
    };
}

/** A function tool with no usable name can't be offered to a model or matched to a call. */
export function unnamedFunctionToolIndex(tools: unknown[] | null | undefined): number {
    return (tools ?? []).findIndex((tool) => {
        const t = tool as { type?: unknown; function?: { name?: unknown } } | null;
        return !!t && typeof t === 'object' && t.type === 'function'
            && !(t.function && typeof t.function.name === 'string' && t.function.name);
    });
}
