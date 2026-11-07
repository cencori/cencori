/**
 * Responses "custom" tools on providers that only know function tools.
 *
 * A custom tool (`{ type: 'custom', name, description, format }`) takes free text instead of JSON
 * arguments; Codex-style agents use one for `apply_patch`. Only OpenAI models accept them. Every
 * other provider speaks chat-completions function tools, and the gateway used to drop custom tools
 * on the way there, so a Tensor agent on Claude, Maximo, GLM or DeepSeek never saw `apply_patch`
 * and wrote every file edit as a heredoc inside a shell command.
 *
 * Here a custom tool becomes a function tool with one string parameter, `input`. When the model
 * calls it, the call goes back to the client as the `custom_tool_call` it offered, carrying the
 * text, so the client cannot tell the tool was ever translated. Its history (`custom_tool_call`,
 * `custom_tool_call_output`) is translated back into chat turns by responses-translate.ts.
 */

import type { Tool } from '@/lib/providers/base';

export type CustomTool = {
    type: 'custom';
    name: string;
    description?: string;
    format?: { type?: string; syntax?: string; definition?: string };
};

/** The grammar is the only spec the model gets for the text; past this it is cut, not dropped. */
const MAX_GRAMMAR_CHARS = 4_000;

export function isCustomTool(tool: unknown): tool is CustomTool {
    return (
        !!tool &&
        typeof tool === 'object' &&
        (tool as { type?: unknown }).type === 'custom' &&
        typeof (tool as { name?: unknown }).name === 'string'
    );
}

/**
 * The client's description is written for a free-text tool ("do not wrap the patch in JSON"),
 * which is wrong once it is a function, so it is restated around the one parameter.
 */
export function customToolAsFunction(tool: CustomTool): Tool {
    const grammar = tool.format?.type === 'grammar' && tool.format.definition
        ? tool.format.definition.slice(0, MAX_GRAMMAR_CHARS)
        : null;
    const description = [
        `Put the complete raw text for this tool in \`input\`, exactly as it should be read: no JSON inside it, no Markdown fences.`,
        tool.description?.trim() ?? '',
        grammar ? `The text must match this ${tool.format?.syntax ?? ''} grammar:\n${grammar}` : '',
    ]
        .filter(Boolean)
        .join('\n\n');
    return {
        type: 'function',
        function: {
            name: tool.name,
            description,
            parameters: {
                type: 'object',
                properties: {
                    input: { type: 'string', description: `The raw text for ${tool.name}.` },
                },
                required: ['input'],
                additionalProperties: false,
            },
        },
    };
}

/** Swap every custom tool for its function form, and remember which names were custom. */
export function translateCustomTools<T>(tools: T[] | undefined): {
    tools: Array<T | Tool> | undefined;
    customToolNames: Set<string>;
} {
    const customToolNames = new Set<string>();
    if (!tools) return { tools, customToolNames };
    const translated = tools.map((tool) => {
        if (!isCustomTool(tool)) return tool;
        customToolNames.add(tool.name);
        return customToolAsFunction(tool);
    });
    return { tools: translated, customToolNames };
}

/**
 * The text a model put in a translated tool's `input`. A model that ignored the schema and sent
 * the raw text, or JSON with a different key, still gets its text through rather than an empty
 * call the client can only reject.
 */
export function customToolInput(args: string): string {
    try {
        const parsed: unknown = JSON.parse(args);
        if (typeof parsed === 'string') return parsed;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const record = parsed as Record<string, unknown>;
            if (typeof record.input === 'string') return record.input;
            const strings = Object.values(record).filter((v): v is string => typeof v === 'string');
            if (strings.length === 1) return strings[0];
        }
    } catch {
        // Not JSON: the model sent the text itself.
    }
    return args;
}

/** The arguments a translated call carries on the chat wire, rebuilt from the client's history. */
export function customToolArguments(input: string): string {
    return JSON.stringify({ input });
}
