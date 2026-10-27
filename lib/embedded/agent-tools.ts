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
    CHECK_PAYMENT_TOOL,
    END_CONVERSATION_TOOL,
    FIND_PRODUCTS_TOOL,
    PLACE_ORDER_TOOL,
    SELL_PRODUCTS_TOOL,
    REQUEST_CALLBACK_TOOL,
    REQUEST_PAYMENT_TOOL,
    TAKE_PAYMENTS_TOOL,
    SYSTEM_TOOL_DEFAULT_DESCRIPTIONS,
    SYSTEM_TOOL_DESCRIPTION_MAX,
    TRANSFER_RULES_MAX,
    TRANSFER_RULE_MAX,
    TRANSFER_TO_HUMAN_TOOL,
} from './system-tool-defaults';

export { END_CONVERSATION_TOOL, REQUEST_CALLBACK_TOOL, TRANSFER_TO_HUMAN_TOOL };
/** Names webhook tools can't take: the model would see two tools with one name. */
export const SYSTEM_TOOL_NAMES = [END_CONVERSATION_TOOL, TRANSFER_TO_HUMAN_TOOL, REQUEST_CALLBACK_TOOL, REQUEST_PAYMENT_TOOL, CHECK_PAYMENT_TOOL, FIND_PRODUCTS_TOOL, PLACE_ORDER_TOOL] as const;

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
    /** The agent may send payment links and check them (the project's payment provider account). */
    take_payments?: { description?: string };
    /** The agent may look up the project's product catalog and take orders from it. */
    sell_products?: { description?: string };
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
    const payments = raw.take_payments as { description?: unknown } | boolean | null | undefined;
    if (payments === true || (payments && typeof payments === 'object')) {
        const description = typeof payments === 'object' ? cleanDescription(payments.description) : '';
        tools.take_payments = description ? { description } : {};
    }
    const selling = raw.sell_products as { description?: unknown } | boolean | null | undefined;
    if (selling === true || (selling && typeof selling === 'object')) {
        const description = typeof selling === 'object' ? cleanDescription(selling.description) : '';
        tools.sell_products = description ? { description } : {};
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
    const payments = raw.take_payments as { description?: unknown } | boolean | null | undefined;
    if (payments === true || (payments && typeof payments === 'object')) {
        const description = typeof payments === 'object' ? cleanDescription(payments.description) : '';
        tools.take_payments = description ? { description } : {};
    }
    const selling = raw.sell_products as { description?: unknown } | boolean | null | undefined;
    if (selling === true || (selling && typeof selling === 'object')) {
        const description = typeof selling === 'object' ? cleanDescription(selling.description) : '';
        tools.sell_products = description ? { description } : {};
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
        ...(system.take_payments ? paymentDefinitions(system) : []),
        ...(system.sell_products ? catalogDefinitions(system) : []),
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
            if (call.name === REQUEST_PAYMENT_TOOL && system.take_payments) return requestPaymentTool(call.args, context);
            // Orders are paid through links too, so selling brings check_payment with it.
            if (call.name === CHECK_PAYMENT_TOOL && (system.take_payments || system.sell_products)) return checkPaymentTool(call.args, context);
            if (call.name === FIND_PRODUCTS_TOOL && system.sell_products) return findProductsTool(call.args, context);
            if (call.name === PLACE_ORDER_TOOL && system.sell_products) return placeOrderTool(call.args, context);
            const webhook = byName.get(call.name);
            if (webhook) return executeWebhookTool(webhook, call.args, { organizationId: context.organizationId, signal: context.signal });
            const binding = mcpByName.get(call.name);
            if (binding) {
                const outcome = await runAgentMcpTool(binding, call.args, context.organizationId, context.projectId);
                // The owner hears about each booking the agent makes (owner alerts), without holding up the reply.
                if (outcome.ok && isBookingTool(binding.tool)) {
                    waitUntil(import('./owner-alerts').then(async ({ notifyBooking }) => {
                        const { createAdminClient } = await import('@/lib/supabaseAdmin');
                        const db = createAdminClient();
                        await notifyBooking({ db, projectId: context.projectId, agentId: context.agentId, agentName: context.agentName, surface: context.surface, conversationId: context.conversationId }, call.args);
                        // Kept for Studio's Sales tab too (previews aren't real bookings).
                        if (context.surface !== 'preview') {
                            const { recordBooking } = await import('./bookings');
                            await recordBooking(db, { projectId: context.projectId, agentId: context.agentId, conversationId: context.conversationId ?? null, argsJson: call.args });
                        }
                    }).catch(() => undefined));
                }
                return outcome;
            }
            return { ok: false, output: `There's no tool named ${call.name}.` };
        },
    };
}

/** The payment tools as the model sees them. */
function paymentDefinitions(system: SystemTools): FunctionToolDefinition[] {
    return [
        {
            type: 'function',
            function: {
                name: REQUEST_PAYMENT_TOOL,
                description: system.take_payments?.description || SYSTEM_TOOL_DEFAULT_DESCRIPTIONS[TAKE_PAYMENTS_TOOL],
                parameters: {
                    type: 'object',
                    properties: {
                        amount: { type: 'number', description: 'The amount in the business\'s currency (naira unless the instructions say otherwise), e.g. 20000.' },
                        description: { type: 'string', description: 'What it pays for, as the customer and owner will see it, e.g. "Deposit: table for 4, Sat 2 Nov 8pm".' },
                        email: { type: 'string', description: 'The customer\'s email for the payment receipt, if they gave one. Optional.' },
                    },
                    required: ['amount', 'description'],
                },
            },
        },
        CHECK_PAYMENT_DEFINITION,
    ];
}

const CHECK_PAYMENT_DEFINITION: FunctionToolDefinition = {
    type: 'function',
    function: {
        name: CHECK_PAYMENT_TOOL,
        description: 'Check whether the customer\'s latest payment link in this conversation has been paid, e.g. when they say they\'ve paid.',
        parameters: { type: 'object', properties: { reference: { type: 'string', description: 'A specific payment reference; omit for the latest one here.' } }, required: [] },
    },
};

/** The catalog tools as the model sees them (and check_payment, when payments didn't bring it). */
function catalogDefinitions(system: SystemTools): FunctionToolDefinition[] {
    return [
        {
            type: 'function',
            function: {
                name: FIND_PRODUCTS_TOOL,
                description: system.sell_products?.description || SYSTEM_TOOL_DEFAULT_DESCRIPTIONS[SELL_PRODUCTS_TOOL],
                parameters: {
                    type: 'object',
                    properties: { query: { type: 'string', description: 'What they\'re looking for, e.g. "red ankara dress" or "chicken". Empty to list the catalog.' } },
                    required: [],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: PLACE_ORDER_TOOL,
                description: 'Place the customer\'s order once they\'ve confirmed the items, quantities and options. Prices come from the catalog. Read the order back to them first, and ask for delivery details (address, or pickup) if the business delivers. Returns a payment link to send when the business takes payments online; the order is confirmed once it\'s paid.',
                parameters: {
                    type: 'object',
                    properties: {
                        items: {
                            type: 'array',
                            description: 'What they\'re ordering.',
                            items: {
                                type: 'object',
                                properties: {
                                    product_id: { type: 'string', description: 'The id from find_products.' },
                                    quantity: { type: 'integer', minimum: 1 },
                                    option: { type: 'string', description: 'The option they chose (size, colour…), when the product has options.' },
                                },
                                required: ['product_id', 'quantity'],
                            },
                        },
                        customer_name: { type: 'string', description: 'Their name.' },
                        delivery: { type: 'string', description: 'Delivery address and phone, or "pickup".' },
                        note: { type: 'string', description: 'Anything else for the business, e.g. "gift wrap". Optional.' },
                        email: { type: 'string', description: 'Their email for the payment receipt, if they gave one. Optional.' },
                    },
                    required: ['items'],
                },
            },
        },
        ...(system.take_payments ? [] : [CHECK_PAYMENT_DEFINITION]),
    ];
}

async function findProductsTool(argumentsJson: string, context: AgentToolContext): Promise<AgentToolOutcome> {
    let query = '';
    try {
        const args = JSON.parse(argumentsJson || '{}') as { query?: unknown };
        query = typeof args.query === 'string' ? args.query.slice(0, 200) : '';
    } catch {
        // list the catalog instead
    }
    const [{ getCatalog }, { describeProduct, searchProducts }, { createAdminClient }] = await Promise.all([import('./catalog'), import('./catalog-format'), import('@/lib/supabaseAdmin')]);
    const catalog = await getCatalog(createAdminClient(), context.projectId);
    const products = catalog?.metadata.products.filter((p) => p.available) ?? [];
    if (!catalog || products.length === 0) return { ok: false, output: 'The business hasn\'t added its products yet. Offer to take their details for the team instead.' };
    const found = searchProducts(products, query, query.trim() ? 10 : 30);
    if (found.length === 0) return { ok: true, output: `Nothing matches "${query}". There are ${products.length} products; search with other words, or with none to list them.` };
    const more = !query.trim() && products.length > found.length ? `\n(${products.length - found.length} more; search to narrow down.)` : '';
    return { ok: true, output: `${found.map((p) => `- ${describeProduct(p, catalog.metadata.currency)}`).join('\n')}${more}` };
}

async function placeOrderTool(argumentsJson: string, context: AgentToolContext): Promise<AgentToolOutcome> {
    let args: { items?: unknown; customer_name?: unknown; delivery?: unknown; note?: unknown; email?: unknown };
    try {
        args = JSON.parse(argumentsJson || '{}') as typeof args;
    } catch {
        return { ok: false, output: 'The order details weren\'t valid JSON.' };
    }
    const field = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);
    const [{ placeOrder, orderSummary }, { formatPrice }, { createAdminClient }] = await Promise.all([import('./catalog'), import('./catalog-format'), import('@/lib/supabaseAdmin')]);
    const result = await placeOrder(
        { db: createAdminClient(), projectId: context.projectId, agentId: context.agentId, agentName: context.agentName, surface: context.surface, conversationId: context.conversationId },
        {
            items: Array.isArray(args.items) ? args.items as Array<Record<string, unknown>> : [],
            customer_name: field(args.customer_name, 200),
            delivery: field(args.delivery, 500),
            note: field(args.note, 500),
            email: field(args.email, 200),
        },
    );
    if (!result.ok) return { ok: false, output: result.message };
    const { order, link } = result;
    const total = formatPrice(order.total, order.currency);
    if (link) return { ok: true, output: `Order ${order.id}: ${orderSummary(order)}, total ${total}. Payment link: ${link}\nSend this link as it is. The order is confirmed once they've paid; they'll get a confirmation here automatically, or use check_payment when they say they've paid.` };
    return { ok: true, output: `Order ${order.id} placed: ${orderSummary(order)}, total ${total}. The business has it and will contact them to arrange payment and delivery. Tell them so; don't say it's paid.` };
}

async function requestPaymentTool(argumentsJson: string, context: AgentToolContext): Promise<AgentToolOutcome> {
    let args: { amount?: unknown; amount_naira?: unknown; description?: unknown; email?: unknown };
    try {
        args = JSON.parse(argumentsJson || '{}') as typeof args;
    } catch {
        return { ok: false, output: 'The payment details weren\'t valid JSON.' };
    }
    const amount = Number(args.amount ?? args.amount_naira);
    const description = typeof args.description === 'string' ? args.description.trim().slice(0, 200) : '';
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, output: 'Give the amount.' };
    if (!description) return { ok: false, output: 'Say what the payment is for.' };
    const [{ requestPayment }, { createAdminClient }] = await Promise.all([import('./payments'), import('@/lib/supabaseAdmin')]);
    const result = await requestPayment(
        { db: createAdminClient(), projectId: context.projectId, agentId: context.agentId, agentName: context.agentName, surface: context.surface, conversationId: context.conversationId },
        { amount, description, email: typeof args.email === 'string' ? args.email.trim() : null },
    );
    if (!result.ok) return { ok: false, output: `${result.message} Don't confirm anything that needs payment; offer the business's phone number if you know it.` };
    return { ok: true, output: `Payment link for ${result.amount} (${description}): ${result.link}\nSend this link as it is. Tell them it's confirmed once they've paid; they'll get a confirmation here automatically. Reference: ${result.reference}` };
}

async function checkPaymentTool(argumentsJson: string, context: AgentToolContext): Promise<AgentToolOutcome> {
    let reference = '';
    try {
        const args = JSON.parse(argumentsJson || '{}') as { reference?: unknown };
        reference = typeof args.reference === 'string' ? args.reference.trim() : '';
    } catch {
        // check the latest instead
    }
    const [{ findPayment, latestPaymentIn, settlePayment, formatMoney }, { createAdminClient }] = await Promise.all([import('./payments'), import('@/lib/supabaseAdmin')]);
    const db = createAdminClient();
    const found = reference ? await findPayment(db, reference) : await latestPaymentIn(db, context.projectId, context.conversationId);
    if (!found || found.connection.projectId !== context.projectId) return { ok: false, output: 'There\'s no payment link from this conversation to check.' };
    try {
        const payment = await settlePayment(db, found.connection, found.payment);
        if (payment.status === 'paid') return { ok: true, output: `Paid: ${formatMoney(payment.amount, payment.currency)} for ${payment.description}. It's confirmed.` };
        if (payment.status === 'expired') return { ok: true, output: `The link for ${payment.description} expired unpaid. Offer a new one if they still want it.` };
        return { ok: true, output: `Not paid yet (${formatMoney(payment.amount, payment.currency)} for ${payment.description}). If they've just paid, it can take a minute; the link is ${payment.link}` };
    } catch {
        return { ok: false, output: 'Couldn\'t reach the payment provider to check right now. Ask them to try again in a moment.' };
    }
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
        const db = createAdminClient();
        const sent = await notifyCallback({ db, projectId: context.projectId, agentId: context.agentId, agentName: context.agentName, surface: context.surface, conversationId: context.conversationId }, { name, contact: phone, reason });
        // Studio shows the chat as needing the owner.
        await import('@/lib/studio/takeover').then(({ flagNeedsOwner }) => flagNeedsOwner(db, context.conversationId, `Wants a call back: ${reason}`)).catch(() => undefined);
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
    // Studio shows the chat as needing the owner, whatever their hand-off address does, and tells them.
    await Promise.all([import('@/lib/studio/takeover'), import('@/lib/studio/push'), import('@/lib/supabaseAdmin')])
        .then(async ([{ flagNeedsOwner }, { pushToOwners }, { createAdminClient }]) => {
            const db = createAdminClient();
            await flagNeedsOwner(db, context.conversationId, summary);
            if (context.surface !== 'preview') {
                const who = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : 'A customer';
                await pushToOwners(db, context.projectId, { title: `${who} needs you`, body: summary.slice(0, 200), url: context.conversationId ? `/inbox/${context.conversationId}` : '/inbox', tag: `needs-${context.conversationId ?? contact}` });
            }
        })
        .catch(() => undefined);

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
