import { isWidgetResult, validateWidget, type WidgetNode } from '../widgets/spec';
import { partialRenderUiWidget } from '../widgets/partial';
import { Agent } from './agent';
import type { RunContext } from './context';
import { AgentsError, CencoriRunError, GuardrailTripwireTriggered, MaxTurnsExceededError } from './errors';
import { toJsonSchema, validate } from './schema';
import type { FunctionTool } from './tool';
import { readSessionEvents, Transport, type PausedAction, type ResumeNext, type TransportOptions } from './transport';

export interface RunOptions<Ctx = unknown> extends TransportOptions {
    /** Your value for tools, guardrails and dynamic instructions. Stays in your process. */
    context?: Ctx;
    /** Continue an earlier conversation: pass the sessionId from a previous result. */
    sessionId?: string;
    /** Most model calls this run may make (each tool round is one). Default 10. */
    maxTurns?: number;
    /** Stream events as they happen; see StreamedRunResult. */
    stream?: boolean;
    /** Turn on Cencori memory for this user: recalled before, written after. */
    memory?: { userId: string; [key: string]: unknown };
    /** Your end user's id: per-user quotas, billing and memory. */
    user?: string;
    /** Extra metadata on the session (strings). */
    metadata?: Record<string, string>;
}

/** A tool call waiting for a human. Approve or reject it on result.state, then run again. */
export interface ToolApprovalItem {
    type: 'tool_approval';
    callId: string;
    toolName: string;
    /** The model's arguments, as JSON text. */
    arguments: string;
    agentName: string;
}

export type RunItem =
    | { type: 'message'; agentName: string; text: string }
    | { type: 'tool_call'; agentName: string; callId: string; toolName: string; arguments: string }
    | { type: 'tool_output'; agentName: string; callId: string; toolName: string; output: string }
    | { type: 'handoff'; from: string; to: string }
    | { type: 'widget'; agentName: string; callId: string; widgetId: string; widget: WidgetNode };

export interface Usage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

export type RunStreamEvent =
    | { type: 'agent_updated'; agent: Agent<any> }
    | { type: 'text_delta'; delta: string; agentName: string }
    | { type: 'tool_call'; callId: string; toolName: string; arguments: string; agentName: string }
    | { type: 'tool_output'; callId: string; toolName: string; output: string; agentName: string }
    | { type: 'handoff'; from: string; to: string }
    /** UI to show: from the model (render_ui) or from a tool that returned { widget }. */
    | { type: 'widget'; callId: string; widgetId: string; widget: WidgetNode; agentName: string }
    /** A widget the model is still writing (render_ui): draw it, then replace it with the 'widget' for the same callId. */
    | { type: 'widget_partial'; callId: string; widget: WidgetNode; agentName: string }
    | { type: 'interruption'; interruptions: ToolApprovalItem[] };

interface PendingPause {
    actionId: string;
    actions: PausedAction[];
    text: string;
}

interface SerializedRunState {
    v: 1;
    sessionId: string;
    agentName: string;
    turnsUsed: number;
    usage: Usage;
    pending: PendingPause;
    decisions: Record<string, { approved: boolean; message?: string }>;
}

/**
 * A paused run: tool calls are waiting for a human. Approve or reject each,
 * then pass the state back to run(). Serializable with JSON.stringify, so the
 * decision can come minutes or hours later from another process (Cencori
 * keeps a paused session for 24 hours).
 */
export class RunState {
    readonly sessionId: string;
    readonly agentName: string;
    readonly turnsUsed: number;
    readonly usage: Usage;
    /** @internal */
    readonly pending: PendingPause;
    private readonly decisions: Map<string, { approved: boolean; message?: string }>;

    /** @internal */
    constructor(init: Omit<SerializedRunState, 'v' | 'decisions'> & { decisions?: SerializedRunState['decisions'] }) {
        this.sessionId = init.sessionId;
        this.agentName = init.agentName;
        this.turnsUsed = init.turnsUsed;
        this.usage = init.usage;
        this.pending = init.pending;
        this.decisions = new Map(Object.entries(init.decisions ?? {}));
    }

    approve(item: ToolApprovalItem | string): void {
        this.decisions.set(typeof item === 'string' ? item : item.callId, { approved: true });
    }

    /** The model is told the call was rejected, with your message if given. */
    reject(item: ToolApprovalItem | string, options: { message?: string } = {}): void {
        this.decisions.set(typeof item === 'string' ? item : item.callId, { approved: false, message: options.message });
    }

    /** @internal */
    decision(callId: string): { approved: boolean; message?: string } | undefined {
        return this.decisions.get(callId);
    }

    toJSON(): SerializedRunState {
        return {
            v: 1,
            sessionId: this.sessionId,
            agentName: this.agentName,
            turnsUsed: this.turnsUsed,
            usage: this.usage,
            pending: this.pending,
            decisions: Object.fromEntries(this.decisions),
        };
    }

    static fromJSON(json: string | SerializedRunState): RunState {
        const data = (typeof json === 'string' ? JSON.parse(json) : json) as SerializedRunState;
        if (data?.v !== 1 || !data.sessionId || !data.pending) throw new AgentsError('Not a cencori/agents run state.');
        return new RunState(data);
    }
}

export interface RunResult<Output = string> {
    /** The final answer: text, or the parsed outputType. Undefined while interrupted. */
    finalOutput: Output | undefined;
    /** The Cencori session: pass it as sessionId to continue the conversation. */
    sessionId: string;
    /** The agent that gave the final answer (after any handoffs). */
    lastAgent: Agent<any>;
    /** Tool calls waiting for approval; empty when the run finished. */
    interruptions: ToolApprovalItem[];
    /** Set when interrupted: approve or reject, then run(agent, state). */
    state: RunState | undefined;
    /** Messages, tool calls and handoffs in this run, in order. */
    newItems: RunItem[];
    usage: Usage;
}

/** run(..., { stream: true }): iterate events as they happen, then await completed. */
export interface StreamedRunResult<Output = string> extends AsyncIterable<RunStreamEvent> {
    /** Resolves with the result once the run ends (after you finish iterating, or on its own). */
    readonly completed: Promise<RunResult<Output>>;
    /** Only the text deltas. */
    toTextStream(): AsyncIterable<string>;
}

const DEFAULT_MAX_TURNS = 10;

/** A tool output carrying { widget }: the checked widget and what the model reads instead. */
function toolWidget(output: string): { widgetId: string; widget: WidgetNode; modelOutput: string } | null {
    if (!output.startsWith('{') || !output.includes('"widget"')) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(output); } catch { return null; }
    if (!isWidgetResult(parsed)) return null;
    const { widget, ...rest } = parsed as { widget: unknown } & Record<string, unknown>;
    const checked = validateWidget(widget);
    if (!checked.ok) {
        console.warn(`[cencori/agents] A tool returned a widget that isn't valid, so it wasn't shown:\n${checked.errors.join('\n')}`);
        return null;
    }
    const widgetId = `wgt_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    return {
        widgetId,
        widget: checked.widget,
        modelOutput: JSON.stringify({ ...rest, rendered: true, widget_id: widgetId, note: 'The user can see this widget now; do not repeat its contents. If the user asked for anything else, do it now with the tools it needs. Never say an action happened unless its tool returned success.' }),
    };
}

function collectAgents(start: Agent<any>): Map<string, Agent<any>> {
    const seen = new Map<string, Agent<any>>();
    const visit = (agent: Agent<any>) => {
        if (seen.has(agent.name)) return;
        seen.set(agent.name, agent);
        agent.handoffs.forEach(visit);
    };
    visit(start);
    return seen;
}

function wireTools(agent: Agent<any>): Array<Record<string, unknown>> {
    const tools: Array<Record<string, unknown>> = agent.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
        // Only an unconditional approval is the server's to hold and record; a
        // conditional one is decided here, per call.
        ...(t.needsApproval === true ? { needsApproval: true } : {}),
    }));
    for (const target of agent.handoffs) {
        tools.push({
            type: 'function',
            function: {
                name: Agent.handoffToolName(target),
                description: target.handoffDescription
                    ? `Hand the conversation to ${target.name}: ${target.handoffDescription}`
                    : `Hand the conversation to the ${target.name} agent.`,
                parameters: { type: 'object', properties: {}, additionalProperties: false },
            },
        });
    }
    return tools;
}

function addUsage(total: Usage, usage: unknown): Usage {
    const u = (usage ?? {}) as { input_tokens?: number; output_tokens?: number; total_tokens?: number };
    return {
        inputTokens: total.inputTokens + (u.input_tokens ?? 0),
        outputTokens: total.outputTokens + (u.output_tokens ?? 0),
        totalTokens: total.totalTokens + (u.total_tokens ?? 0),
    };
}

/** The final text of a completed turn: the streamed deltas, else the output items. */
function completedText(streamed: string, data: Record<string, unknown>): string {
    if (streamed) return streamed;
    const out = data.output as Record<string, unknown> | undefined;
    if (typeof out?.text === 'string') return out.text;
    let text = '';
    if (Array.isArray(out?.output)) {
        for (const item of out.output as Array<Record<string, unknown>>) {
            if (item.type !== 'message' || !Array.isArray(item.content)) continue;
            for (const c of item.content as Array<Record<string, unknown>>) {
                if (c.type === 'output_text' && typeof c.text === 'string') text += c.text;
            }
        }
    }
    return text;
}

type TurnOutcome =
    | { kind: 'completed'; text: string; usage: unknown }
    | { kind: 'paused'; pause: PendingPause };

/** Read one turn's stream: emit deltas and tool calls, end on pause or completion. */
async function* consumeTurn(response: Response, agentName: string, sessionId: string, items: RunItem[]): AsyncGenerator<RunStreamEvent, TurnOutcome> {
    let text = '';
    // render_ui arguments as they stream, per call, and when each was last drawn.
    const writing = new Map<string, { args: string; drawnAt: number; drawn: string }>();
    for await (const { event, data } of readSessionEvents(response)) {
        switch (event) {
            case 'tool_call.delta': {
                if (data.tool !== 'render_ui' || typeof data.delta !== 'string') break;
                const callId = String(data.action_id ?? '');
                const w = writing.get(callId) ?? { args: '', drawnAt: 0, drawn: '' };
                w.args += data.delta;
                writing.set(callId, w);
                // Parsing on every few characters is wasted work: draw at most every 50ms.
                const now = Date.now();
                if (now - w.drawnAt < 50) break;
                const partial = partialRenderUiWidget(w.args);
                const key = partial ? JSON.stringify(partial) : '';
                if (!partial || key === w.drawn) break;
                w.drawnAt = now;
                w.drawn = key;
                yield { type: 'widget_partial', callId, widget: partial, agentName };
                break;
            }
            case 'output_text.delta': {
                const delta = typeof data.delta === 'string' ? data.delta : '';
                if (delta) {
                    text += delta;
                    yield { type: 'text_delta', delta, agentName };
                }
                break;
            }
            case 'tool_call.completed': {
                // render_ui runs on Cencori: a valid widget arrives as the call's output.
                const out = data.output as { ok?: boolean; widget_id?: string; widget?: WidgetNode } | undefined;
                if (data.tool === 'render_ui' && out?.ok && out.widget && out.widget_id) {
                    items.push({ type: 'widget', agentName, callId: String(data.action_id ?? ''), widgetId: out.widget_id, widget: out.widget });
                    yield { type: 'widget', callId: String(data.action_id ?? ''), widgetId: out.widget_id, widget: out.widget, agentName };
                }
                break;
            }
            case 'turn.paused': {
                const actions = Array.isArray(data.actions)
                    ? (data.actions as PausedAction[])
                    : [{ action_id: String(data.action_id), tool: String(data.tool), arguments: JSON.stringify((data.arguments as Record<string, unknown>)?.[String(data.tool)] ?? {}) }];
                return { kind: 'paused', pause: { actionId: String(data.action_id), actions, text } };
            }
            case 'turn.completed':
                return { kind: 'completed', text: completedText(text, data), usage: data.usage };
            case 'turn.failed': {
                const output = data.output as { error?: string } | undefined;
                throw new CencoriRunError(output?.error ?? 'The turn failed.', { code: 'turn_failed', sessionId });
            }
            case 'error': {
                const err = (data.error ?? data) as { message?: string; code?: string };
                throw new CencoriRunError(err.message ?? 'The turn failed.', { code: err.code, sessionId });
            }
            default:
                break;
        }
    }
    throw new CencoriRunError('The turn ended without a result.', { code: 'stream_ended', sessionId });
}

async function* runLoop<Ctx>(
    startAgent: Agent<Ctx, any>,
    input: string | RunState,
    options: RunOptions<Ctx>,
): AsyncGenerator<RunStreamEvent, RunResult<unknown>> {
    const transport = new Transport(options);
    const agents = collectAgents(startAgent);
    const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    const items: RunItem[] = [];

    const contextFor = (agent: Agent<any>, sessionId: string): RunContext<Ctx> => {
        const ctx: RunContext<Ctx> & { __runOptions?: RunOptions<Ctx> } = {
            context: options.context as Ctx,
            sessionId,
            agentName: agent.name,
            signal: options.signal,
        };
        Object.defineProperty(ctx, '__runOptions', { value: options, enumerable: false });
        return ctx;
    };

    const nextFor = async (agent: Agent<any>, sessionId: string): Promise<ResumeNext> => ({
        instructions: (await agent.resolveInstructions(contextFor(agent, sessionId))) ?? '',
        model: agent.model,
        tools: wireTools(agent),
        metadata: { sdk: 'cencori/agents', agent: agent.name },
    });

    let agent: Agent<any>;
    let sessionId: string;
    let turnsUsed: number;
    let usage: Usage;
    let response: Response | undefined;
    let pending: PendingPause | undefined;
    let resumedState: RunState | undefined;

    if (input instanceof RunState) {
        resumedState = input;
        const found = agents.get(input.agentName);
        if (!found) throw new AgentsError(`The run state belongs to agent "${input.agentName}", which isn't reachable from "${startAgent.name}".`);
        agent = found;
        sessionId = input.sessionId;
        turnsUsed = input.turnsUsed;
        usage = input.usage;
        pending = input.pending;
    } else {
        agent = startAgent;
        turnsUsed = 0;
        usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        // A new run's session is created together with its first turn (one round trip).
        sessionId = options.sessionId ?? '';

        // Input guardrails run on the first agent, before any model call.
        const runContext = contextFor(agent, sessionId);
        for (const guardrail of agent.inputGuardrails) {
            const verdict = await guardrail.execute({ input, agent, runContext });
            if (verdict.tripwireTriggered) throw new GuardrailTripwireTriggered('input', guardrail.name, verdict.outputInfo);
        }

        yield { type: 'agent_updated', agent };
        turnsUsed++;
        const firstTools = wireTools(agent);
        const firstTurn = {
            input,
            model: agent.model,
            instructions: await agent.resolveInstructions(runContext),
            tools: firstTools.length ? firstTools : undefined,
            ...(agent.outputType
                ? { response_format: { type: 'json_schema', json_schema: { name: 'final_output', schema: toJsonSchema(agent.outputType) } } }
                : {}),
            ...(agent.modelSettings.temperature !== undefined ? { temperature: agent.modelSettings.temperature } : {}),
            ...(agent.modelSettings.maxTokens !== undefined ? { max_output_tokens: agent.modelSettings.maxTokens } : {}),
            ...(agent.modelSettings.reasoningEffort ? { reasoning_effort: agent.modelSettings.reasoningEffort } : {}),
            ...(options.memory ? { memory: options.memory } : {}),
            ...(options.user ? { user: options.user } : {}),
            ...(agent.widgets ? { widgets: true } : {}),
            metadata: { sdk: 'cencori/agents', agent: agent.name },
        };
        if (sessionId) {
            response = await transport.turn(sessionId, firstTurn);
        } else {
            const created = await transport.createSessionWithTurn({
                ...(options.metadata ?? {}),
                sdk: 'cencori/agents',
                agent: startAgent.name,
            }, firstTurn);
            sessionId = created.sessionId;
            response = created.response;
        }
    }

    while (true) {
        if (response) {
            const outcome: TurnOutcome = yield* consumeTurn(response, agent.name, sessionId, items);
            response = undefined;
            if (outcome.kind === 'completed') {
                usage = addUsage(usage, outcome.usage);
                let finalOutput: unknown = outcome.text;
                if (agent.outputType) {
                    let parsed: unknown;
                    try {
                        parsed = JSON.parse(outcome.text);
                    } catch {
                        throw new CencoriRunError(`${agent.name} did not return valid JSON for its outputType.`, { code: 'invalid_output', sessionId });
                    }
                    finalOutput = await validate(agent.outputType, parsed, `${agent.name}'s output`);
                }
                items.push({ type: 'message', agentName: agent.name, text: outcome.text });
                const runContext = contextFor(agent, sessionId);
                for (const guardrail of agent.outputGuardrails) {
                    const verdict = await guardrail.execute({ output: finalOutput, agent, runContext });
                    if (verdict.tripwireTriggered) throw new GuardrailTripwireTriggered('output', guardrail.name, verdict.outputInfo);
                }
                return { finalOutput, sessionId, lastAgent: agent, interruptions: [], state: undefined, newItems: items, usage };
            }
            pending = outcome.pause;
            if (outcome.pause.text) items.push({ type: 'message', agentName: agent.name, text: outcome.pause.text });
            for (const action of outcome.pause.actions) {
                items.push({ type: 'tool_call', agentName: agent.name, callId: action.action_id, toolName: action.tool, arguments: action.arguments });
                yield { type: 'tool_call', callId: action.action_id, toolName: action.tool, arguments: action.arguments, agentName: agent.name };
            }
        }
        if (!pending) throw new AgentsError('Nothing to continue.');

        // Decide each paused call: run it, hand off, or wait for a human.
        const runContext = contextFor(agent, sessionId);
        const toolsByName = new Map<string, FunctionTool<any>>(agent.tools.map((t) => [t.name, t]));
        const handoffsByName = new Map<string, Agent<any>>(agent.handoffs.map((a) => [Agent.handoffToolName(a), a]));
        const interruptions: ToolApprovalItem[] = [];
        for (const action of pending.actions) {
            const t = toolsByName.get(action.tool);
            if (!t || resumedState?.decision(action.action_id)) continue;
            let needs = action.needs_approval === true || t.needsApproval === true;
            if (!needs && typeof t.needsApproval === 'function') {
                try {
                    needs = await t.needsApproval(runContext, await t.parseArguments(action.arguments), action.action_id);
                } catch {
                    needs = false; // invalid arguments: invoke reports the error to the model
                }
            }
            if (needs) {
                interruptions.push({ type: 'tool_approval', callId: action.action_id, toolName: action.tool, arguments: action.arguments, agentName: agent.name });
            }
        }
        if (interruptions.length > 0) {
            const state = new RunState({ sessionId, agentName: agent.name, turnsUsed, usage, pending });
            yield { type: 'interruption', interruptions };
            return { finalOutput: undefined, sessionId, lastAgent: agent, interruptions, state, newItems: items, usage };
        }

        if (turnsUsed >= maxTurns) throw new MaxTurnsExceededError(maxTurns, sessionId);

        let handoffTo: Agent<any> | undefined;
        const results = await Promise.all(pending.actions.map(async (action) => {
            const target = handoffsByName.get(action.tool);
            if (target) {
                if (handoffTo && handoffTo !== target) {
                    return { action, output: `Not transferred: the conversation already went to ${handoffTo.name}.` };
                }
                handoffTo = target;
                return { action, output: `Transferred to ${target.name}. You are now ${target.name}; continue the conversation.` };
            }
            const decision = resumedState?.decision(action.action_id);
            if (decision && !decision.approved) {
                return { action, output: `The user rejected this call${decision.message ? `: ${decision.message}` : '.'} Don't retry it.` };
            }
            const t = toolsByName.get(action.tool);
            if (!t) return { action, output: `Error: there is no tool named ${action.tool}.` };
            return { action, output: await t.invoke(runContext, action.arguments, action.action_id) };
        }));
        for (const result of results) {
            const { action } = result;
            if (handoffsByName.has(action.tool)) continue;
            // A tool that returned { widget } shows it; the model gets the rest of
            // its result and a note that the user can see the widget.
            const shown = toolWidget(result.output);
            if (shown) {
                result.output = shown.modelOutput;
                items.push({ type: 'widget', agentName: agent.name, callId: action.action_id, widgetId: shown.widgetId, widget: shown.widget });
                yield { type: 'widget', callId: action.action_id, widgetId: shown.widgetId, widget: shown.widget, agentName: agent.name };
            }
            const output = result.output;
            items.push({ type: 'tool_output', agentName: agent.name, callId: action.action_id, toolName: action.tool, output });
            yield { type: 'tool_output', callId: action.action_id, toolName: action.tool, output, agentName: agent.name };
        }

        let next: ResumeNext | undefined;
        if (handoffTo) {
            const from = agent.name;
            agent = handoffTo;
            next = await nextFor(agent, sessionId);
            items.push({ type: 'handoff', from, to: agent.name });
            yield { type: 'handoff', from, to: agent.name };
            yield { type: 'agent_updated', agent };
        }

        turnsUsed++;
        resumedState = undefined;
        response = await transport.resume(
            sessionId,
            pending.actionId,
            results.map(({ action, output }) => ({ action_id: action.action_id, output })),
            next,
        );
        pending = undefined;
    }
}

/**
 * Run an agent until it answers, pausing tool calls run in your process.
 *
 * ```ts
 * const result = await run(support, 'Where is order 1042?');
 * result.finalOutput; // "It shipped yesterday..."
 * ```
 *
 * Pass `{ stream: true }` for events as they happen, `{ sessionId }` to
 * continue a conversation, or a RunState to resume after approvals.
 */
export function run<Ctx, Out>(agent: Agent<Ctx, Out>, input: string | RunState, options: RunOptions<Ctx> & { stream: true }): StreamedRunResult<Out>;
export function run<Ctx, Out>(agent: Agent<Ctx, Out>, input: string | RunState, options?: RunOptions<Ctx> & { stream?: false }): Promise<RunResult<Out>>;
export function run<Ctx, Out>(agent: Agent<Ctx, Out>, input: string | RunState, options: RunOptions<Ctx> = {}): Promise<RunResult<unknown>> | StreamedRunResult<unknown> {
    if (options.stream) return streamed(agent, input, options);
    return (async () => {
        const loop = runLoop(agent, input, options);
        while (true) {
            const step = await loop.next();
            if (step.done) return step.value;
        }
    })();
}

function streamed<Ctx>(agent: Agent<Ctx, any>, input: string | RunState, options: RunOptions<Ctx>): StreamedRunResult<unknown> {
    const loop = runLoop(agent, input, options);
    let resolve!: (r: RunResult<unknown>) => void;
    let reject!: (e: unknown) => void;
    const completed = new Promise<RunResult<unknown>>((res, rej) => { resolve = res; reject = rej; });
    // Callers that only await completed shouldn't see an unhandled rejection twice.
    completed.catch(() => {});
    let started = false;

    const events = async function* (): AsyncGenerator<RunStreamEvent> {
        if (started) throw new AgentsError('A streamed run can be iterated once.');
        started = true;
        try {
            while (true) {
                const step = await loop.next();
                if (step.done) {
                    resolve(step.value);
                    return;
                }
                yield step.value;
            }
        } catch (error) {
            reject(error);
            throw error;
        }
    };

    let iterator: AsyncGenerator<RunStreamEvent> | undefined;
    return {
        [Symbol.asyncIterator]() {
            iterator ??= events();
            return iterator;
        },
        get completed() {
            // Awaiting completed without iterating drains the run.
            if (!started) {
                void (async () => {
                    try {
                        for await (const _event of this) { /* drain */ }
                    } catch {
                        /* surfaced through completed */
                    }
                })();
            }
            return completed;
        },
        async *toTextStream() {
            for await (const event of this) {
                if (event.type === 'text_delta') yield event.delta;
            }
        },
    };
}
