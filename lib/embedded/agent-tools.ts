/**
 * The tools an agent version offers its model, and how a call to one runs.
 * One place for Preview, conversation turns (widget, share link, Sessions
 * API) and API runs, so a tool behaves the same wherever the agent answers.
 *
 * Two kinds, both run by Cencori:
 * - Webhook tools: the owner's HTTPS endpoints (see ./webhook-tools).
 * - System tools: built-in actions the owner switches on, stored on the
 *   version as `system_tools`.
 */

import { waitUntil } from '@vercel/functions';
import { safeOutboundFetch } from '@/lib/security/outbound-url';
import { isBookingTool } from './owner-alerts';
import { executeWebhookTool, readWebhookTools, webhookToolDefinitions, type WebhookTool } from './webhook-tools';
import { agentMcpBindings, readAgentIntegrations, readAgentMcpServers, runAgentMcpTool, warmAgentMcpSessions } from './agent-mcp';
import {
    END_CONVERSATION_TOOL,
    REQUEST_CALLBACK_TOOL,
    SYSTEM_TOOL_DEFAULT_DESCRIPTIONS,
    SYSTEM_TOOL_DESCRIPTION_MAX,
    TRANSFER_RULES_MAX,
    TRANSFER_RULE_MAX,
    TRANSFER_TO_HUMAN_TOOL,
} from './system-tool-defaults';

export { END_CONVERSATION_TOOL, REQUEST_CALLBACK_TOOL, TRANSFER_TO_HUMAN_TOOL };
/** Names webhook tools can't take: the model would see two tools with one name. */
export const SYSTEM_TOOL_NAMES = [END_CONVERSATION_TOOL, TRANSFER_TO_HUMAN_TOOL, REQUEST_CALLBACK_TOOL] as const;

const TRANSFER_TIMEOUT_MS = 10_000;

/**
 * Today's date for the agent's instructions. Models don't know it, so without
 * it "what's on my calendar" lists from the start of time and dates in tool
 * calls get guessed (Google rejects a bare `2026-10-01` as a time bound).
 */
export function agentClock(now = new Date()): string {
    const day = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const iso = `${now.toISOString().slice(0, 16)}:00Z`;
    return [
        `Current date and time: ${day}, ${iso.slice(11, 16)} UTC (${iso}).`,
        `When a tool takes dates or times, send full RFC 3339 timestamps such as ${iso.slice(0, 10)}T00:00:00Z. For questions about upcoming, recent or "today's" things, set a time range from the current date instead of listing everything.`,
    ].join('\n');
}
const TRANSCRIPT_MAX_MESSAGES = 20;

/**
 * A tool is on when its key is present. `description` replaces the default
 * text the model reads; transfer `rules` are the conditions to hand off on.
 */
export interface SystemTools {
    /** The agent may close the conversation once the person is done. */
    end_conversation?: { description?: string };
    /** The agent may hand the person to a human; details are POSTed to this URL. */
    transfer_to_human?: { url: string; description?: string; rules?: string[] };
    /** The agent may ask the team to call someone back; the owner is emailed (owner alerts). */
    request_callback?: { description?: string };
}

export type AgentToolCall = { id: string; name: string; args: string };

/** Where the call happens, for the outcome and what a hand-off carries. */
export interface AgentToolContext {
    organizationId: string;
    /** The agent's project: connected apps (integrations) are looked up by it. */
    projectId: string;
    agentId: string;
    agentName?: string;
    surface: 'preview' | 'conversation' | 'run';
    /** The session or run the call belongs to. */
    conversationId?: string | null;
    /** The conversation so far, for a hand-off. */
    transcript?: Array<{ role: string; content: string }>;
    signal?: AbortSignal;
}

export interface AgentToolOutcome {
    ok: boolean;
    output: string;
    status?: number;
    /** Set by end_conversation: the conversation closes after this reply. */
    endsConversation?: boolean;
}

export type FunctionToolDefinition = {
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
};

const cleanDescription = (value: unknown) => (typeof value === 'string' ? value.trim().slice(0, SYSTEM_TOOL_DESCRIPTION_MAX) : '');
const cleanRules = (value: unknown) => (Array.isArray(value) ? value : [])
    .map((rule) => (typeof rule === 'string' ? rule.replace(/\s+/g, ' ').trim().slice(0, TRANSFER_RULE_MAX) : ''))
    .filter(Boolean)
    .slice(0, TRANSFER_RULES_MAX);

/** The stored settings, defensively read. `end_conversation: true` is the earlier on-switch. */
export function readSystemTools(config: Record<string, unknown> | null | undefined): SystemTools {
    const raw = (config?.system_tools ?? null) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') return {};
    const tools: SystemTools = {};
    const end = raw.end_conversation as { description?: unknown } | boolean | null | undefined;
    if (end === true || (end && typeof end === 'object')) {
        const description = typeof end === 'object' ? cleanDescription(end.description) : '';
        tools.end_conversation = description ? { description } : {};
    }
    const transfer = raw.transfer_to_human as { url?: unknown; description?: unknown; rules?: unknown } | null | undefined;
    if (transfer && typeof transfer.url === 'string' && transfer.url) {
        const description = cleanDescription(transfer.description);
        const rules = cleanRules(transfer.rules);
        tools.transfer_to_human = { url: transfer.url, ...(description ? { description } : {}), ...(rules.length ? { rules } : {}) };
    }
    const callback = raw.request_callback as { description?: unknown } | boolean | null | undefined;
    if (callback === true || (callback && typeof callback === 'object')) {
        const description = typeof callback === 'object' ? cleanDescription(callback.description) : '';
        tools.request_callback = description ? { description } : {};
    }
    return tools;
}

/** Validate what the console sends: an object per tool that's on, null or absent for off. */
export function buildSystemTools(input: unknown): { ok: true; tools: SystemTools } | { ok: false; message: string } {
    if (input === undefined || input === null) return { ok: true, tools: {} };
    if (typeof input !== 'object' || Array.isArray(input)) return { ok: false, message: 'Send system tools as an object.' };
    const raw = input as Record<string, unknown>;
    const tools: SystemTools = {};
    const end = raw.end_conversation as { description?: unknown } | boolean | null | undefined;
    if (end === true || (end && typeof end === 'object')) {
        const description = typeof end === 'object' ? cleanDescription(end.description) : '';
        tools.end_conversation = description ? { description } : {};
    }
    const transfer = raw.transfer_to_human as { url?: unknown; description?: unknown; rules?: unknown } | null | undefined;
    if (transfer && typeof transfer === 'object') {
        const url = typeof transfer.url === 'string' ? transfer.url.trim() : '';
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return { ok: false, message: 'Transfer to a person needs a full URL to send the hand-off to, like https://example.com/handoff.' };
        }
        if (parsed.protocol !== 'https:') return { ok: false, message: 'The hand-off URL must use https://.' };
        const description = cleanDescription(transfer.description);
        const rules = cleanRules(transfer.rules);
        tools.transfer_to_human = { url: parsed.toString(), ...(description ? { description } : {}), ...(rules.length ? { rules } : {}) };
    }
    const callback = raw.request_callback as { description?: unknown } | boolean | null | undefined;
    if (callback === true || (callback && typeof callback === 'object')) {
        const description = typeof callback === 'object' ? cleanDescription(callback.description) : '';
        tools.request_callback = description ? { description } : {};
    }
    return { ok: true, tools };
}

/** A system tool as the model sees it: the owner's description or the default, plus transfer rules. */
function systemDefinition(name: typeof END_CONVERSATION_TOOL | typeof TRANSFER_TO_HUMAN_TOOL | typeof REQUEST_CALLBACK_TOOL, system: SystemTools): FunctionToolDefinition {
    if (name === REQUEST_CALLBACK_TOOL) {
        return {
            type: 'function',
            function: {
                name,
                description: system.request_callback?.description || SYSTEM_TOOL_DEFAULT_DESCRIPTIONS[REQUEST_CALLBACK_TOOL],
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'The person\'s name.' },
                        phone: { type: 'string', description: 'The number to call them on.' },
                        reason: { type: 'string', description: 'What they need, in a sentence or two, so the team can call prepared.' },
                    },
                    required: ['phone', 'reason'],
                },
            },
        };
    }
    if (name === END_CONVERSATION_TOOL) {
        return {
            type: 'function',
            function: {
                name,
                description: system.end_conversation?.description || SYSTEM_TOOL_DEFAULT_DESCRIPTIONS[END_CONVERSATION_TOOL],
                parameters: {
                    type: 'object',
                    properties: { reason: { type: 'string', description: 'Why the conversation is ending, in a few words.' } },
                    required: [],
                },
            },
        };
    }
    const transfer = system.transfer_to_human;
    const rules = transfer?.rules?.length ? `\n\nAlso transfer when any of these apply:\n${transfer.rules.map((rule) => `- ${rule}`).join('\n')}` : '';
    return {
        type: 'function',
        function: {
            name,
            description: `${transfer?.description || SYSTEM_TOOL_DEFAULT_DESCRIPTIONS[TRANSFER_TO_HUMAN_TOOL]}${rules}`,
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'The person\'s name.' },
                    contact: { type: 'string', description: 'How to reach them: an email address or phone number.' },
                    summary: { type: 'string', description: 'What they need, in one or two sentences, so the team can pick it up without asking again.' },
                },
                required: ['contact', 'summary'],
            },
        },
    };
}

export interface AgentToolset {
    definitions: FunctionToolDefinition[];
    has(name: string): boolean;
    run(call: AgentToolCall, context: AgentToolContext): Promise<AgentToolOutcome>;
    /**
     * Start what a tool call will need (a connected app's session) while the
     * model is still deciding, so the call doesn't wait for it. Never throws.
     */
    warm(projectId: string): void;
}

/** The version's tools: its webhook tools, the MCP tools switched on, and the system tools switched on. */
export function agentToolset(config: Record<string, unknown> | null | undefined): AgentToolset {
    const webhooks = readWebhookTools(config).filter((tool) => !(SYSTEM_TOOL_NAMES as readonly string[]).includes(tool.name));
    const system = readSystemTools(config);
    const local: FunctionToolDefinition[] = [
        ...webhookToolDefinitions(webhooks),
        ...(system.end_conversation ? [systemDefinition(END_CONVERSATION_TOOL, system)] : []),
        ...(system.transfer_to_human ? [systemDefinition(TRANSFER_TO_HUMAN_TOOL, system)] : []),
        ...(system.request_callback ? [systemDefinition(REQUEST_CALLBACK_TOOL, system)] : []),
    ];
    // MCP and connected-app tool names never shadow the agent's own tools.
    const mcp = agentMcpBindings([...readAgentMcpServers(config), ...readAgentIntegrations(config)], new Set(local.map((d) => d.function.name)));
    const definitions = [...local, ...mcp.map((binding) => binding.definition)];
    const byName = new Map<string, WebhookTool>(webhooks.map((tool) => [tool.name, tool]));
    const mcpByName = new Map(mcp.map((binding) => [binding.definition.function.name, binding]));
    const names = new Set(definitions.map((definition) => definition.function.name));

    return {
        definitions,
        has: (name) => names.has(name),
        warm(projectId) {
            warmAgentMcpSessions(mcp, projectId);
        },
        async run(call, context) {
            if (call.name === END_CONVERSATION_TOOL && system.end_conversation) {
                return { ok: true, output: 'The conversation will close after your reply. Say a short goodbye.', endsConversation: true };
            }
            if (call.name === TRANSFER_TO_HUMAN_TOOL && system.transfer_to_human) {
                return transferToHuman(system.transfer_to_human.url, call.args, context);
            }
            if (call.name === REQUEST_CALLBACK_TOOL && system.request_callback) {
                return requestCallback(call.args, context);
            }
            const webhook = byName.get(call.name);
            if (webhook) return executeWebhookTool(webhook, call.args, { organizationId: context.organizationId, signal: context.signal });
            const binding = mcpByName.get(call.name);
            if (binding) {
                const outcome = await runAgentMcpTool(binding, call.args, context.organizationId, context.projectId);
                // The owner hears about each booking the agent makes (owner alerts), without holding up the reply.
                if (outcome.ok && isBookingTool(binding.tool)) {
                    waitUntil(import('./owner-alerts').then(async ({ notifyBooking }) => {
                        const { createAdminClient } = await import('@/lib/supabaseAdmin');
                        await notifyBooking({ db: createAdminClient(), projectId: context.projectId, agentId: context.agentId, agentName: context.agentName, surface: context.surface, conversationId: context.conversationId }, call.args);
                    }).catch(() => undefined));
                }
                return outcome;
            }
            return { ok: false, output: `There's no tool named ${call.name}.` };
        },
    };
}

/** Email the owner to call someone back. The outcome tells the agent whether a callback was really arranged. */
async function requestCallback(argumentsJson: string, context: AgentToolContext): Promise<AgentToolOutcome> {
    let args: { name?: unknown; phone?: unknown; reason?: unknown };
    try {
        args = JSON.parse(argumentsJson || '{}') as typeof args;
    } catch {
        return { ok: false, output: 'The callback details weren\'t valid JSON.' };
    }
    const phone = typeof args.phone === 'string' ? args.phone.trim().slice(0, 60) : '';
    const reason = typeof args.reason === 'string' ? args.reason.trim().slice(0, 1000) : '';
    if (!phone) return { ok: false, output: 'Ask for the number to call them on first.' };
    if (!reason) return { ok: false, output: 'Include what they need, in a sentence or two.' };
    const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim().slice(0, 200) : null;
    try {
        const [{ notifyCallback }, { createAdminClient }] = await Promise.all([import('./owner-alerts'), import('@/lib/supabaseAdmin')]);
        const sent = await notifyCallback({ db: createAdminClient(), projectId: context.projectId, agentId: context.agentId, agentName: context.agentName, surface: context.surface, conversationId: context.conversationId }, { name, contact: phone, reason });
        if (sent) return { ok: true, output: `Done: the team has the request and will call ${phone}.` };
    } catch {
        // fall through
    }
    return { ok: false, output: 'The callback request couldn\'t be passed on right now. Don\'t promise a callback; give them the business\'s phone number if you know it.' };
}

/**
 * POST the hand-off to the owner's URL: who to contact, what they need and
 * the conversation so far. Never throws: the outcome is what the agent says.
 */
async function transferToHuman(url: string, argumentsJson: string, context: AgentToolContext): Promise<AgentToolOutcome> {
    let args: { name?: unknown; contact?: unknown; summary?: unknown };
    try {
        args = JSON.parse(argumentsJson || '{}') as typeof args;
    } catch {
        return { ok: false, output: 'The hand-off details weren\'t valid JSON.' };
    }
    const contact = typeof args.contact === 'string' ? args.contact.trim().slice(0, 200) : '';
    const summary = typeof args.summary === 'string' ? args.summary.trim().slice(0, 2000) : '';
    if (!contact) return { ok: false, output: 'Ask the person how to reach them (an email or phone number) before handing off.' };
    if (!summary) return { ok: false, output: 'Include a short summary of what they need.' };

    const payload = {
        type: 'agent.transfer_to_human',
        created_at: new Date().toISOString(),
        agent: { id: context.agentId, name: context.agentName ?? null },
        surface: context.surface,
        conversation_id: context.conversationId ?? null,
        person: { name: typeof args.name === 'string' ? args.name.trim().slice(0, 200) || null : null, contact },
        summary,
        transcript: (context.transcript ?? [])
            .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
            .slice(-TRANSCRIPT_MAX_MESSAGES)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
    };
    const timeout = AbortSignal.timeout(TRANSFER_TIMEOUT_MS);
    try {
        const response = await safeOutboundFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Cencori-Agent-Tools/1.0' },
            body: JSON.stringify(payload),
            signal: context.signal ? AbortSignal.any([context.signal, timeout]) : timeout,
        });
        await response.body?.cancel().catch(() => undefined);
        if (!response.ok) return { ok: false, status: response.status, output: `The hand-off couldn't be sent (HTTP ${response.status}). Apologize and give them another way to reach the team if you know one.` };
        return { ok: true, status: response.status, output: `Handed off. Someone from the team will follow up at ${contact}.` };
    } catch {
        return { ok: false, output: 'The hand-off couldn\'t be sent right now. Apologize and give them another way to reach the team if you know one.' };
    }
}
