import type { RunContext } from './context';
import { AgentsError } from './errors';
import type { RunOptions } from './run';
import { tool, type FunctionTool } from './tool';
import { Transport, type TransportOptions } from './transport';

/**
 * Handing a conversation to a person.
 *
 * Give an agent the humanHandoff() tool and it can pass the conversation to
 * your team: it says so, then goes quiet. While a person handles it, the
 * user's messages are kept for them (run() returns `withHuman: true` instead
 * of an answer). Your team replies with humanReply() and hands it back with
 * releaseToAgent(); it also goes back on its own after 30 quiet minutes. The
 * agent is then told what was said, and carries on.
 *
 * ```ts
 * const support = new Agent({
 *     name: 'Support',
 *     tools: [lookupOrder, humanHandoff({ onHandoff: ({ sessionId, reason }) => slack.post(`#support: ${reason} ${sessionId}`) })],
 * });
 * ```
 */

export const HUMAN_HANDOFF_TOOL = 'handoff_to_human';

export interface HumanHandoffOptions<Ctx = unknown> {
    /** When the model should use it. */
    description?: string;
    /** Tell your team: post to Slack, open a ticket, page someone. */
    onHandoff?: (event: { sessionId: string; reason: string; runContext: RunContext<Ctx> }) => void | Promise<void>;
}

export function humanHandoff<Ctx = unknown>(options: HumanHandoffOptions<Ctx> = {}): FunctionTool<Ctx> {
    return tool({
        name: HUMAN_HANDOFF_TOOL,
        description: options.description
            ?? 'Hand this conversation to a person on the team. Use it when the user asks for a human, when they are upset, or when you can\'t help. Tell the user a person will reply here.',
        parameters: {
            type: 'object',
            properties: { reason: { type: 'string', description: 'Why, in one sentence, for the person picking it up.' } },
            required: ['reason'],
            additionalProperties: false,
        },
        async execute(args, runContext) {
            const { reason } = args as { reason: string };
            const runOptions = (runContext as RunContext<Ctx> & { __runOptions?: RunOptions<Ctx> }).__runOptions;
            await new Transport(runOptions ?? {}).human(runContext.sessionId, { action: 'handoff', reason });
            await options.onHandoff?.({ sessionId: runContext.sessionId, reason, runContext });
            return 'Handed to a person on the team. Tell the user, in one short sentence, that a person will reply here soon. Don\'t try to solve it yourself now.';
        },
    }) as FunctionTool<Ctx>;
}

export interface HumanMessage {
    id: string;
    /** 'user' (your end user), 'human' (your team), 'agent'. */
    from: 'user' | 'human' | 'agent';
    text: string;
    at: string;
}

export interface HumanStatus {
    handledBy: 'human' | 'agent';
    handoff: { reason: string; at: string } | null;
    messages: HumanMessage[];
}

/** A person on your team replies in the conversation (and keeps it with them). */
export async function humanReply(sessionId: string, text: string, options: TransportOptions = {}): Promise<HumanMessage> {
    const body = await new Transport(options).human(sessionId, { action: 'reply', text }) as { message?: HumanMessage };
    if (!body.message) throw new AgentsError('The reply was not saved.');
    return body.message;
}

/** Hand the conversation back to the agent. */
export async function releaseToAgent(sessionId: string, options: TransportOptions = {}): Promise<void> {
    await new Transport(options).human(sessionId, { action: 'release' });
}

/** Who's handling the conversation, and what was said while a person was (optionally only after a time). */
export async function humanStatus(sessionId: string, options: TransportOptions & { after?: string } = {}): Promise<HumanStatus> {
    const body = await new Transport(options).humanStatus(sessionId, options.after) as { handled_by: 'human' | 'agent'; handoff: HumanStatus['handoff']; messages: HumanMessage[] };
    return { handledBy: body.handled_by, handoff: body.handoff, messages: body.messages ?? [] };
}
