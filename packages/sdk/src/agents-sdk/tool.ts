import { toJsonSchema, validate, type InferSchema, type JsonSchema, type SchemaLike } from './schema';
import type { RunContext } from './context';

export const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/** Whether a call needs a human's approval before it runs. */
export type NeedsApproval<Args, Ctx> =
    | boolean
    | ((runContext: RunContext<Ctx>, args: Args, callId: string) => boolean | Promise<boolean>);

export interface ToolOptions<S extends SchemaLike, Ctx = unknown, Out = unknown> {
    /** Name the model calls it by: letters, digits, _ and -, at most 64. */
    name: string;
    /** What it does and when to use it. The model reads this. */
    description: string;
    /** Parameters: a zod (or any Standard Schema) object, or a JSON Schema object. */
    parameters?: S;
    /** Runs the tool. Return anything; non-strings are sent to the model as JSON. */
    execute: (args: InferSchema<S>, runContext: RunContext<Ctx>, details: { callId: string }) => Out | Promise<Out>;
    /**
     * Ask a human before running it. `true` also records the request and the
     * decision in your project's governance ledger; a function decides per call.
     */
    needsApproval?: NeedsApproval<InferSchema<S>, Ctx>;
    /** What the model sees when execute throws. Default: the error's message. */
    errorFunction?: (error: unknown, runContext: RunContext<Ctx>) => string | Promise<string>;
}

export interface FunctionTool<Ctx = unknown> {
    readonly type: 'function';
    readonly name: string;
    readonly description: string;
    readonly parameters: JsonSchema;
    readonly needsApproval: NeedsApproval<unknown, Ctx>;
    /** Validate the model's arguments, run the tool, and return what the model sees. */
    invoke(runContext: RunContext<Ctx>, rawArguments: string, callId: string): Promise<string>;
    /** Parse and validate arguments (used to decide on approval before running). */
    parseArguments(rawArguments: string): Promise<unknown>;
}

function stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === undefined) return '';
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/**
 * Define a tool the agent can call. It runs in your process, with your
 * credentials and data; Cencori only sees its name, arguments and result.
 *
 * ```ts
 * const getOrder = tool({
 *   name: 'get_order',
 *   description: 'Look up an order by id',
 *   parameters: z.object({ id: z.string() }),
 *   execute: async ({ id }) => db.orders.find(id),
 * });
 * ```
 */
export function tool<S extends SchemaLike, Ctx = unknown, Out = unknown>(options: ToolOptions<S, Ctx, Out>): FunctionTool<Ctx> {
    if (!TOOL_NAME_PATTERN.test(options.name)) {
        throw new TypeError(`Tool name "${options.name}" must be 1-64 letters, digits, _ or -.`);
    }
    const jsonSchema = toJsonSchema(options.parameters);

    const parseArguments = async (rawArguments: string): Promise<unknown> => {
        let parsed: unknown = {};
        if (rawArguments && rawArguments.trim()) {
            try {
                parsed = JSON.parse(rawArguments);
            } catch {
                throw new SyntaxError(`The arguments for ${options.name} are not valid JSON.`);
            }
        }
        return validate(options.parameters, parsed, `Invalid arguments for ${options.name}`);
    };

    return {
        type: 'function',
        name: options.name,
        description: options.description,
        parameters: jsonSchema,
        needsApproval: (options.needsApproval ?? false) as NeedsApproval<unknown, Ctx>,
        parseArguments,
        async invoke(runContext, rawArguments, callId) {
            try {
                const args = await parseArguments(rawArguments);
                const out = await options.execute(args as InferSchema<S>, runContext, { callId });
                return stringify(out);
            } catch (error) {
                if (options.errorFunction) return options.errorFunction(error, runContext);
                const message = error instanceof Error ? error.message : String(error);
                return `Error running ${options.name}: ${message}`;
            }
        },
    };
}
