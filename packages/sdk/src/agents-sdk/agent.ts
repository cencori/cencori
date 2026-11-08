import type { RunContext } from './context';
import type { SchemaLike, StandardSchemaV1 } from './schema';
import { tool, TOOL_NAME_PATTERN, type FunctionTool } from './tool';
import type { RunOptions } from './run';

/** Checks the user's input before the first model call. */
export interface InputGuardrail<Ctx = unknown> {
    name: string;
    execute: (args: { input: string; agent: Agent<Ctx, any>; runContext: RunContext<Ctx> }) =>
        GuardrailResult | Promise<GuardrailResult>;
}

/** Checks the final answer before the run returns it. */
export interface OutputGuardrail<Ctx = unknown> {
    name: string;
    execute: (args: { output: unknown; agent: Agent<Ctx, any>; runContext: RunContext<Ctx> }) =>
        GuardrailResult | Promise<GuardrailResult>;
}

export interface GuardrailResult {
    /** true stops the run with a GuardrailTripwireTriggered error. */
    tripwireTriggered: boolean;
    /** Anything you want back on the error. */
    outputInfo?: unknown;
}

export interface ModelSettings {
    temperature?: number;
    maxTokens?: number;
    /**
     * How hard a reasoning model thinks before answering. Lower is faster;
     * 'none' skips thinking where the model allows it. Default: the model's own.
     */
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}

export interface AgentOptions<Ctx = unknown, Out = string> {
    /** Shown in traces, and used for handoff tool names (transfer_to_<name>). */
    name: string;
    /** System prompt. A function gets the run context, for per-user instructions. */
    instructions?: string | ((runContext: RunContext<Ctx>) => string | Promise<string>);
    /**
     * Any model in the Cencori catalog: 'claude-sonnet-4-5', 'gemini-2.5-flash'...
     * Default: DEFAULT_MODEL, GPT OSS 120B on Cerebras (fast, calls tools).
     */
    model?: string;
    tools?: FunctionTool<Ctx>[];
    /** Agents this one can hand the conversation to. */
    handoffs?: Agent<Ctx, any>[];
    /** Tells other agents when to hand off to this one. */
    handoffDescription?: string;
    /** Structured final output: a zod (or Standard Schema) object, or a JSON Schema. */
    outputType?: StandardSchemaV1<unknown, Out> | Record<string, unknown>;
    modelSettings?: ModelSettings;
    inputGuardrails?: InputGuardrail<Ctx>[];
    outputGuardrails?: OutputGuardrail<Ctx>[];
}

/** The model an agent uses when none is given: GPT OSS 120B on Cerebras, chosen for speed. */
export const DEFAULT_MODEL = 'gpt-oss-120b';

function toolSafe(name: string): string {
    const safe = name.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return safe || 'agent';
}

/**
 * An agent: a model, instructions and tools. It holds no state; run() drives
 * it in a Cencori session.
 *
 * ```ts
 * const support = new Agent({
 *   name: 'Support',
 *   instructions: 'Answer order questions. Be brief.',
 *   model: 'claude-sonnet-4-5',
 *   tools: [getOrder],
 * });
 * ```
 */
export class Agent<Ctx = unknown, Out = string> {
    readonly name: string;
    readonly instructions: AgentOptions<Ctx, Out>['instructions'];
    readonly model: string;
    readonly tools: FunctionTool<Ctx>[];
    readonly handoffs: Agent<Ctx, any>[];
    readonly handoffDescription?: string;
    readonly outputType?: SchemaLike;
    readonly modelSettings: ModelSettings;
    readonly inputGuardrails: InputGuardrail<Ctx>[];
    readonly outputGuardrails: OutputGuardrail<Ctx>[];

    constructor(options: AgentOptions<Ctx, Out>) {
        if (!options.name?.trim()) throw new TypeError('An agent needs a name.');
        if (options.model !== undefined && !options.model.trim()) throw new TypeError(`Agent "${options.name}" needs a model.`);
        this.name = options.name;
        this.instructions = options.instructions;
        this.model = options.model ?? DEFAULT_MODEL;
        this.tools = options.tools ?? [];
        this.handoffs = options.handoffs ?? [];
        this.handoffDescription = options.handoffDescription;
        this.outputType = options.outputType;
        this.modelSettings = options.modelSettings ?? {};
        this.inputGuardrails = options.inputGuardrails ?? [];
        this.outputGuardrails = options.outputGuardrails ?? [];

        const names = new Set<string>();
        for (const t of [...this.tools.map((t) => t.name), ...this.handoffs.map((a) => Agent.handoffToolName(a))]) {
            if (names.has(t)) throw new TypeError(`Agent "${this.name}" has two tools named "${t}".`);
            names.add(t);
        }
    }

    /** A copy with some options changed. */
    clone(overrides: Partial<AgentOptions<Ctx, Out>>): Agent<Ctx, Out> {
        return new Agent<Ctx, Out>({
            name: this.name,
            instructions: this.instructions,
            model: this.model,
            tools: this.tools,
            handoffs: this.handoffs,
            handoffDescription: this.handoffDescription,
            outputType: this.outputType as AgentOptions<Ctx, Out>['outputType'],
            modelSettings: this.modelSettings,
            inputGuardrails: this.inputGuardrails,
            outputGuardrails: this.outputGuardrails,
            ...overrides,
        });
    }

    /** The tool name a handoff to this agent goes by. */
    static handoffToolName(agent: Agent<any>): string {
        const name = `transfer_to_${toolSafe(agent.name)}`.slice(0, 64);
        if (!TOOL_NAME_PATTERN.test(name)) throw new TypeError(`Can't make a handoff tool name for "${agent.name}".`);
        return name;
    }

    /** Instructions for this run, resolving a function if given. */
    async resolveInstructions(runContext: RunContext<Ctx>): Promise<string | undefined> {
        if (typeof this.instructions === 'function') return this.instructions(runContext);
        return this.instructions;
    }

    /**
     * Use this agent as a tool of another: it runs on its own (in its own
     * session) and returns its final answer, while the calling agent keeps the
     * conversation. Compare handoffs, where this agent would take it over.
     */
    asTool(options: { toolName?: string; toolDescription?: string; runOptions?: Pick<RunOptions<Ctx>, 'maxTurns' | 'apiKey' | 'baseUrl'> } = {}): FunctionTool<Ctx> {
        const agent = this;
        return tool({
            name: options.toolName ?? toolSafe(this.name).slice(0, 64),
            description: options.toolDescription ?? this.handoffDescription ?? `Ask the ${this.name} agent.`,
            parameters: {
                type: 'object',
                properties: { input: { type: 'string', description: `What to ask ${this.name}.` } },
                required: ['input'],
                additionalProperties: false,
            },
            async execute(args, runContext) {
                const { run } = await import('./run');
                const { input } = args as { input: string };
                const inherited = (runContext as RunContext<Ctx> & { __runOptions?: RunOptions<Ctx> }).__runOptions;
                const result = await run(agent, input, {
                    // Same transport as the calling run: key, endpoint and any custom fetch.
                    apiKey: inherited?.apiKey,
                    baseUrl: inherited?.baseUrl,
                    fetch: inherited?.fetch,
                    user: inherited?.user,
                    ...options.runOptions,
                    context: runContext.context,
                    signal: runContext.signal,
                    metadata: { parent_session_id: runContext.sessionId, ...(inherited?.metadata ?? {}) },
                });
                return result.finalOutput;
            },
        });
    }
}
