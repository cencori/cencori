import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import type { CopilotToolContext } from "@/lib/copilot/tools";
import type { PrepareResult } from "@/lib/copilot/actions";
import { readSystemTools } from "@/lib/embedded/agent-tools";
import { readAgentIntegrations, readAgentMcpServers } from "@/lib/embedded/agent-mcp";
import { RESTAURANT_DEFAULTS, restaurantInstructions, type RestaurantDetails } from "@/lib/embedded/templates";
import { getOwnerAlerts } from "@/lib/embedded/owner-alerts";

/**
 * Copilot as an agent builder: read the project's embedded agents, and
 * propose building or changing one. Proposals run the same studio, knowledge
 * and alerts endpoints the console's own buttons use, as the user, after they
 * confirm. A proposal can be several requests in a row (create the agent,
 * then add its menu, then set its alerts), each able to use ids returned by
 * the ones before it ({{agent_id}}, {{version_id}}).
 */

/** The model a new agent gets when the user doesn't name one. */
export const DEFAULT_AGENT_MODEL = "claude-haiku-5-5";
const INSTRUCTIONS_MAX = 20_000;
const KNOWLEDGE_MAX = 50_000;

const agentRef = { type: "string", description: "The agent's id or exact name (from list_agents)." } as const;

export const AGENT_READ_TOOLS: ChatCompletionFunctionTool[] = [
    {
        type: "function",
        function: {
            name: "list_agents",
            description: "The current project's embedded agents (the ones businesses deploy to WhatsApp, their website and so on): name, whether published, template, model and where they're live.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "get_agent",
            description: "One agent's full setup: instructions, model, system tools, connected apps, knowledge documents, website chat, WhatsApp, owner alerts, draft vs published, and what's left to set up.",
            parameters: { type: "object", properties: { agent: agentRef }, required: ["agent"] },
        },
    },
];

const restaurantProps = {
    venue_type: { type: "string", enum: ["restaurant", "lounge", "bar", "cafe"] },
    address: { type: "string" },
    opening_hours: { type: "string", description: "e.g. 'Mon–Thu 12pm–11pm, Fri–Sun 12pm–2am'." },
    phone: { type: "string", description: "The number guests can call." },
    time_zone: { type: "string", description: "IANA time zone. Defaults to Africa/Lagos." },
    max_party_size: { type: "number" },
    table_minutes: { type: "number", description: "How long a table is held. Default 120." },
    bookings_at_once: { type: "number", description: "Bookings that may overlap. Default 5." },
    deposit_policy: { type: "string" },
    notes: { type: "string", description: "Parking, dress code, live music nights, kids, corkage…" },
} as const;

export const AGENT_ACTIONS: ChatCompletionFunctionTool[] = [
    {
        type: "function",
        function: {
            name: "create_agent",
            description: "Propose creating an embedded agent, in one confirmation: the agent, its instructions, an optional knowledge document (e.g. a menu or FAQ, as text) and optional owner alert emails. Use template 'restaurant' for restaurants, lounges, bars and cafés: pass the venue details and the instructions are written for you (answers from the menu, books tables on Google Calendar, requests callbacks). Otherwise write clear instructions yourself from what the user described.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "The agent's name, e.g. the business name." },
                    description: { type: "string", description: "One line on what it does." },
                    template: { type: "string", enum: ["restaurant"], description: "Omit for a custom agent." },
                    instructions: { type: "string", description: "For a custom agent: what it does, how it talks, what it never does. Ignored for templates." },
                    model: { type: "string", description: `Model id. Defaults to ${DEFAULT_AGENT_MODEL}.` },
                    knowledge_name: { type: "string", description: "Name of the knowledge document, e.g. 'Kapadoccia menu'." },
                    knowledge_text: { type: "string", description: "The document's full text (a menu, prices, FAQ), as given by the user or their attached file." },
                    alert_emails: { type: "array", items: { type: "string" }, description: "Who gets an email for each booking and callback request." },
                    ...restaurantProps,
                },
                required: ["name"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_agent_instructions",
            description: "Propose changing an agent's instructions: either replace them, or add a line or paragraph. The change goes into a draft; publish_agent makes it live.",
            parameters: {
                type: "object",
                properties: {
                    agent: agentRef,
                    append: { type: "string", description: "Text to add at the end, e.g. 'There's a live band every Friday from 9pm.'" },
                    instructions: { type: "string", description: "Full replacement instructions. Use append for small additions." },
                },
                required: ["agent"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "add_agent_knowledge",
            description: "Propose adding a knowledge document to an agent (a menu, price list, FAQ, policies), from text the user gave or attached. The agent answers from it.",
            parameters: {
                type: "object",
                properties: { agent: agentRef, name: { type: "string" }, text: { type: "string" } },
                required: ["agent", "name", "text"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_agent_system_tools",
            description: "Propose switching an agent's built-in actions on or off: end_conversation (closes the chat when the person is done) and request_callback (takes a name, number and reason and emails the owner to call back). Goes into a draft.",
            parameters: {
                type: "object",
                properties: { agent: agentRef, end_conversation: { type: "boolean" }, request_callback: { type: "boolean" } },
                required: ["agent"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_owner_alerts",
            description: "Propose setting who's emailed about an agent's bookings and callback requests, and the 8am morning summary.",
            parameters: {
                type: "object",
                properties: {
                    agent: agentRef,
                    emails: { type: "array", items: { type: "string" } },
                    bookings: { type: "boolean" },
                    callbacks: { type: "boolean" },
                    daily_summary: { type: "boolean" },
                    time_zone: { type: "string" },
                },
                required: ["agent", "emails"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "publish_agent",
            description: "Propose publishing an agent's draft: it runs a quick test, then makes the draft the live version that customers, the website chat and WhatsApp use.",
            parameters: { type: "object", properties: { agent: agentRef }, required: ["agent"] },
        },
    },
    {
        type: "function",
        function: {
            name: "open_agent_page",
            description: "Offer a button that opens the page where the user connects something themselves, because it needs their own sign-in: 'calendar' (connect Google Calendar and other apps), 'whatsapp' (Connect WhatsApp), 'website' (the website chat and its install snippet), 'preview' (try the agent). Use after creating an agent for the steps you can't do for them.",
            parameters: {
                type: "object",
                properties: { agent: agentRef, page: { type: "string", enum: ["calendar", "whatsapp", "website", "preview"] } },
                required: ["agent", "page"],
            },
        },
    },
];

export const AGENT_TOOL_STATUS: Record<string, string> = {
    list_agents: "Listing agents",
    get_agent: "Reading the agent",
    create_agent: "Preparing the agent",
    update_agent_instructions: "Preparing instruction changes",
    add_agent_knowledge: "Preparing the document",
    set_agent_system_tools: "Preparing tool changes",
    set_owner_alerts: "Preparing alerts",
    publish_agent: "Preparing to publish",
    open_agent_page: "Finding the page",
};

export const AGENT_READ_NAMES = new Set(AGENT_READ_TOOLS.map((t) => t.function.name));
export const AGENT_ACTION_NAMES = new Set(AGENT_ACTIONS.map((t) => t.function.name));

type Args = Record<string, unknown>;
type AgentRow = { id: string; name: string; description: string | null; is_active: boolean; stable_version_id: string | null; created_at: string };
type VersionRow = { id: string; version: string; status: string; config_json: Record<string, unknown> | null; last_test_passed: boolean | null; created_at: string };

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const LOCKED = new Set(["published", "deprecated", "retired"]);

async function findAgent(ctx: CopilotToolContext, ref: unknown): Promise<{ agent: AgentRow } | { error: string }> {
    if (typeof ref !== "string" || !ref.trim()) return { error: "Say which agent (id or name)." };
    const needle = ref.trim();
    const { data } = await ctx.admin.from("agents").select("id, name, description, is_active, stable_version_id, created_at").eq("project_id", ctx.project!.id);
    const agents = (data ?? []) as AgentRow[];
    const match = agents.find((a) => a.id === needle) ?? agents.filter((a) => a.name.toLowerCase() === needle.toLowerCase())[0];
    if (!match) {
        const close = agents.filter((a) => a.name.toLowerCase().includes(needle.toLowerCase()));
        return { error: close.length === 1 ? `No agent named "${ref}". Did you mean "${close[0].name}"?` : `No agent named "${ref}" in this project.` };
    }
    return { agent: match };
}

async function versionsOf(ctx: CopilotToolContext, agentId: string): Promise<VersionRow[]> {
    const { data } = await ctx.admin.from("agent_versions").select("id, version, status, config_json, last_test_passed, created_at").eq("project_id", ctx.project!.id).eq("agent_id", agentId).order("created_at", { ascending: false }).limit(20);
    return (data ?? []) as VersionRow[];
}

/** The version edits go to (an open draft), else the newest. */
const workingVersion = (versions: VersionRow[]) => versions.find((v) => !LOCKED.has(v.status)) ?? versions[0] ?? null;

async function channelState(ctx: CopilotToolContext, agentId: string) {
    const [{ data: widget }, { data: whatsapp }, alerts] = await Promise.all([
        ctx.admin.from("agent_widgets").select("enabled, allowed_origins").eq("project_id", ctx.project!.id).eq("agent_id", agentId).maybeSingle(),
        ctx.admin.from("tool_connections").select("metadata").eq("project_id", ctx.project!.id).eq("connector_slug", "whatsapp-channel").eq("metadata->>agent_id", agentId).maybeSingle(),
        getOwnerAlerts(ctx.admin, ctx.project!.id, agentId),
    ]);
    const wa = (whatsapp?.metadata ?? null) as { display_phone_number?: string; enabled?: boolean } | null;
    return {
        website_chat: widget ? { on: !!widget.enabled, sites: (widget.allowed_origins as string[] | null) ?? [] } : null,
        whatsapp: wa ? { number: wa.display_phone_number ?? null, replies_on: wa.enabled !== false } : null,
        owner_alerts: alerts ? { emails: alerts.settings.emails, bookings: alerts.settings.bookings, callbacks: alerts.settings.callbacks, morning_summary: alerts.settings.daily_summary } : null,
    };
}

export async function runAgentReadTool(name: string, args: Args, ctx: CopilotToolContext): Promise<unknown> {
    if (!ctx.project) return { error: "No project is selected, so agents aren't available." };
    if (name === "list_agents") {
        const { data } = await ctx.admin.from("agents").select("id, name, description, is_active, stable_version_id, created_at").eq("project_id", ctx.project.id).order("created_at", { ascending: false }).limit(50);
        const agents = (data ?? []) as AgentRow[];
        return {
            count: agents.length,
            agents: await Promise.all(agents.map(async (a) => {
                const working = workingVersion(await versionsOf(ctx, a.id));
                const config = working?.config_json ?? {};
                return { id: a.id, name: a.name, description: a.description, published: !!a.stable_version_id, template: config.template ?? null, model: config.model ?? null };
            })),
        };
    }
    if (name === "get_agent") {
        const found = await findAgent(ctx, args.agent);
        if ("error" in found) return found;
        const versions = await versionsOf(ctx, found.agent.id);
        const working = workingVersion(versions);
        const config = working?.config_json ?? {};
        const [{ data: kb }, channels] = await Promise.all([
            ctx.admin.from("knowledge_bases").select("id").eq("project_id", ctx.project.id).eq("agent_id", found.agent.id).is("tenant_id", null).maybeSingle(),
            channelState(ctx, found.agent.id),
        ]);
        const { data: sources } = kb
            ? await ctx.admin.from("knowledge_sources").select("name, status").eq("knowledge_base_id", (kb as { id: string }).id).order("created_at", { ascending: false }).limit(30)
            : { data: [] as Array<{ name: string; status: string }> };
        const apps = readAgentIntegrations(config).map((s) => ({ app: s.name, tools_on: s.enabled.length }));
        const instructions = String(config.instructions ?? config.system_prompt ?? "");
        const published = !!found.agent.stable_version_id;
        const hasDraftChanges = !!working && !LOCKED.has(working.status);
        const left = [
            !(sources ?? []).some((s) => s.status === "ready") && "add knowledge (e.g. a menu)",
            config.template === "restaurant" && !apps.some((a) => /calendar/i.test(a.app)) && "connect Google Calendar (user signs in: open_agent_page calendar)",
            !published && "publish",
            !channels.whatsapp && "connect WhatsApp (user signs in: open_agent_page whatsapp)",
            !channels.owner_alerts?.emails.length && "set owner alerts",
        ].filter(Boolean);
        return {
            id: found.agent.id,
            name: found.agent.name,
            description: found.agent.description,
            template: config.template ?? null,
            model: config.model ?? null,
            published,
            draft: hasDraftChanges ? { version: working!.version, tested: !!working!.last_test_passed, note: published ? "Has changes that aren't live yet." : "Not published yet." } : null,
            instructions: instructions.length > 3000 ? `${instructions.slice(0, 3000)}… (${instructions.length} characters)` : instructions,
            system_tools: Object.keys(readSystemTools(config)),
            connected_apps: apps,
            mcp_servers: readAgentMcpServers(config).map((s) => s.name),
            knowledge: (sources ?? []).map((s) => ({ name: s.name, status: s.status })),
            ...channels,
            still_to_do: left,
        };
    }
    return { error: `Unknown tool: ${name}` };
}

const STUDIO = (projectId: string) => `/api/projects/${projectId}/embedded-agents/studio`;
const AGENT_API = (projectId: string, agentId: string) => `/api/projects/${projectId}/embedded-agents/${agentId}`;

function emailsFrom(value: unknown): string[] | { error: string } {
    if (!Array.isArray(value)) return [];
    const emails = [...new Set(value.filter((e): e is string => typeof e === "string").map((e) => e.trim().toLowerCase()).filter(Boolean))];
    const bad = emails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (bad) return { error: `${bad} isn't an email address.` };
    return emails.slice(0, 5);
}

export async function prepareAgentAction(name: string, args: Args, ctx: CopilotToolContext): Promise<PrepareResult> {
    const project = ctx.project;
    if (!project) return { error: "Select a project first; agents belong to a project." };
    const id = crypto.randomUUID();
    const studio = STUDIO(project.id);

    if (name === "create_agent") {
        const agentName = text(args.name, 120);
        if (!agentName) return { error: "Give the agent a name." };
        const model = text(args.model, 200) || DEFAULT_AGENT_MODEL;
        const restaurant = args.template === "restaurant";
        let instructions = text(args.instructions, INSTRUCTIONS_MAX);
        const details: Array<{ label: string; value: string }> = [{ label: "Name", value: agentName }];
        if (restaurant) {
            const num = (value: unknown, fallback: number) => (typeof value === "number" && value > 0 ? Math.floor(value) : fallback);
            const venue: RestaurantDetails = {
                ...RESTAURANT_DEFAULTS,
                venueName: agentName,
                venueType: (["restaurant", "lounge", "bar", "cafe"] as const).find((t) => t === args.venue_type) ?? "restaurant",
                address: text(args.address, 200),
                hours: text(args.opening_hours, 200),
                phone: text(args.phone, 40),
                timeZone: text(args.time_zone, 60) || "Africa/Lagos",
                maxPartySize: num(args.max_party_size, RESTAURANT_DEFAULTS.maxPartySize),
                slotMinutes: num(args.table_minutes, RESTAURANT_DEFAULTS.slotMinutes),
                tablesPerSlot: num(args.bookings_at_once, RESTAURANT_DEFAULTS.tablesPerSlot),
                deposit: text(args.deposit_policy, 300),
                notes: text(args.notes, 2000),
            };
            instructions = restaurantInstructions(venue);
            details.push(
                { label: "Template", value: `Restaurant & lounge host (${venue.venueType})` },
                ...(venue.address ? [{ label: "Address", value: venue.address }] : []),
                ...(venue.hours ? [{ label: "Hours", value: venue.hours }] : []),
                ...(venue.phone ? [{ label: "Phone", value: venue.phone }] : []),
                { label: "Bookings", value: `Up to ${venue.maxPartySize} guests, ${venue.slotMinutes} min tables, ${venue.tablesPerSlot} at once` },
                ...(venue.deposit ? [{ label: "Deposit", value: venue.deposit }] : []),
            );
        } else {
            if (!instructions) return { error: "Write instructions for a custom agent: what it does, how it talks, what it never does." };
            details.push({ label: "Instructions", value: instructions.length > 140 ? `${instructions.slice(0, 140)}…` : instructions });
        }
        details.push({ label: "Model", value: model });
        const steps: Array<{ method: "POST" | "PUT"; path: string; body: Record<string, unknown> }> = [
            { method: "POST", path: studio, body: { action: "create_agent", name: agentName, description: text(args.description, 500), model, instructions, ...(restaurant ? { template: "restaurant" } : {}) } },
        ];
        const knowledgeText = text(args.knowledge_text, KNOWLEDGE_MAX);
        if (knowledgeText) {
            const docName = text(args.knowledge_name, 120) || `${agentName} knowledge`;
            steps.push({ method: "POST", path: `/api/projects/${project.id}/embedded-agents/{{agent_id}}/knowledge`, body: { name: docName, text: knowledgeText } });
            details.push({ label: "Knowledge", value: `${docName} (${knowledgeText.length.toLocaleString()} characters)` });
        }
        const emails = emailsFrom(args.alert_emails);
        if ("error" in emails) return emails;
        if (emails.length) {
            steps.push({ method: "PUT", path: `/api/projects/${project.id}/embedded-agents/{{agent_id}}/alerts`, body: { emails, ...(restaurant ? { time_zone: text(args.time_zone, 60) || "Africa/Lagos" } : {}) } });
            details.push({ label: "Alerts to", value: emails.join(", ") });
        }
        return {
            proposal: {
                id, kind: name, tier: "normal",
                title: `Create ${agentName}`,
                details,
                request: steps[0],
                steps,
                doneMessage: `Created the agent "${agentName}" as a draft${knowledgeText ? ", added its knowledge" : ""}${emails.length ? ", set up owner alerts" : ""}.`,
            },
        };
    }

    if (name === "open_agent_page") {
        const found = await findAgent(ctx, args.agent);
        if ("error" in found) return found;
        const pages: Record<string, { path: string; label: string; title: string }> = {
            calendar: { path: "tools?tab=integrations", label: "Open Integrations", title: "Connect Google Calendar" },
            whatsapp: { path: "settings#whatsapp", label: "Open WhatsApp settings", title: "Connect WhatsApp" },
            website: { path: "settings#website", label: "Open website chat", title: "Set up the website chat" },
            preview: { path: "", label: "Open the agent", title: "Try the agent" },
        };
        const page = pages[String(args.page)];
        if (!page) return { error: "page must be calendar, whatsapp, website or preview." };
        return {
            proposal: {
                id, kind: name, tier: "normal",
                title: page.title,
                details: [{ label: "Agent", value: found.agent.name }, { label: "Why", value: "This needs your own sign-in, so it opens the page for you." }],
                request: { method: "POST", path: "" },
                link: { href: `/agents/${encodeURIComponent(found.agent.id)}${page.path ? `/${page.path}` : ""}`, label: page.label },
                doneMessage: `Opened the page to ${page.title.toLowerCase()}.`,
            },
        };
    }

    const found = await findAgent(ctx, args.agent);
    if ("error" in found) return found;
    const agent = found.agent;
    const versions = await versionsOf(ctx, agent.id);
    const working = workingVersion(versions);
    const config = (working?.config_json ?? {}) as Record<string, unknown>;
    // Edits go to a draft: new_version returns the open draft, or makes one from the live version.
    const draftStep = { method: "POST" as const, path: studio, body: { action: "new_version", agent_id: agent.id } };

    if (name === "update_agent_instructions") {
        const current = String(config.instructions ?? config.system_prompt ?? "");
        const replacement = text(args.instructions, INSTRUCTIONS_MAX);
        const addition = text(args.append, 4000);
        if (!replacement && !addition) return { error: "Give the new instructions, or the text to add." };
        const next = replacement || `${current.trimEnd()}\n\n${addition}`.trim();
        if (next.length > INSTRUCTIONS_MAX) return { error: `Instructions can be at most ${INSTRUCTIONS_MAX.toLocaleString()} characters.` };
        return {
            proposal: {
                id, kind: name, tier: "normal",
                title: `Update ${agent.name}'s instructions`,
                details: [
                    { label: addition && !replacement ? "Adds" : "New instructions", value: (addition && !replacement ? addition : next).slice(0, 300) },
                    { label: "Goes live", value: "After you publish" },
                ],
                request: draftStep,
                steps: [
                    draftStep,
                    { method: "POST", path: studio, body: { action: "save_draft", agent_id: agent.id, version_id: "{{version_id}}", name: agent.name, description: agent.description ?? "", model: String(config.model ?? ""), instructions: next } },
                ],
                doneMessage: `Updated ${agent.name}'s instructions in its draft. Publish to make it live.`,
            },
        };
    }

    if (name === "add_agent_knowledge") {
        const docName = text(args.name, 120);
        const body = text(args.text, KNOWLEDGE_MAX);
        if (!docName || !body) return { error: "A document name and its text are required." };
        const request = { method: "POST" as const, path: `${AGENT_API(project.id, agent.id)}/knowledge`, body: { name: docName, text: body } };
        return {
            proposal: {
                id, kind: name, tier: "normal",
                title: `Add "${docName}" to ${agent.name}`,
                details: [{ label: "Document", value: docName }, { label: "Size", value: `${body.length.toLocaleString()} characters` }, { label: "Preview", value: body.slice(0, 160) }],
                request,
                doneMessage: `Added "${docName}" to ${agent.name}'s knowledge. It's used straight away, published or not.`,
            },
        };
    }

    if (name === "set_agent_system_tools") {
        const current = readSystemTools(config) as Record<string, unknown>;
        const next: Record<string, unknown> = { ...current };
        const details: Array<{ label: string; value: string }> = [];
        for (const key of ["end_conversation", "request_callback"] as const) {
            if (typeof args[key] !== "boolean") continue;
            next[key] = args[key] ? (current[key] ?? {}) : null;
            details.push({ label: key === "end_conversation" ? "End conversation" : "Request a callback", value: args[key] ? "On" : "Off" });
        }
        if (details.length === 0) return { error: "Say which tools to switch: end_conversation and/or request_callback." };
        return {
            proposal: {
                id, kind: name, tier: "normal",
                title: `Change ${agent.name}'s system tools`,
                details: [...details, { label: "Goes live", value: "After you publish" }],
                request: draftStep,
                steps: [draftStep, { method: "POST", path: studio, body: { action: "save_tools", agent_id: agent.id, version_id: "{{version_id}}", system_tools: next } }],
                doneMessage: `Updated ${agent.name}'s system tools in its draft. Publish to make it live.`,
            },
        };
    }

    if (name === "set_owner_alerts") {
        const emails = emailsFrom(args.emails);
        if ("error" in emails) return emails;
        if (emails.length === 0) return { error: "Give at least one email address." };
        const body: Record<string, unknown> = { emails };
        const details: Array<{ label: string; value: string }> = [{ label: "Agent", value: agent.name }, { label: "Emails", value: emails.join(", ") }];
        for (const [key, label] of [["bookings", "Bookings"], ["callbacks", "Callback requests"], ["daily_summary", "Morning summary"]] as const) {
            if (typeof args[key] === "boolean") {
                body[key] = args[key];
                details.push({ label, value: args[key] ? "On" : "Off" });
            }
        }
        if (text(args.time_zone, 60)) body.time_zone = text(args.time_zone, 60);
        return {
            proposal: {
                id, kind: name, tier: "normal",
                title: `Set ${agent.name}'s owner alerts`,
                details,
                request: { method: "PUT", path: `${AGENT_API(project.id, agent.id)}/alerts`, body },
                doneMessage: `Owner alerts for ${agent.name} now go to ${emails.join(", ")}.`,
            },
        };
    }

    if (name === "publish_agent") {
        const draft = versions.find((v) => !LOCKED.has(v.status));
        if (!draft) return { error: agent.stable_version_id ? `${agent.name} is already published and has no unpublished changes.` : `${agent.name} has no version to publish.` };
        if (!String((draft.config_json ?? {}).model ?? "")) return { error: `${agent.name} has no model yet. Set one in the console before publishing.` };
        return {
            proposal: {
                id, kind: name, tier: "normal",
                title: `Publish ${agent.name}`,
                details: [
                    { label: "Version", value: draft.version },
                    { label: "Effect", value: "Becomes the live version for customers, the website chat and WhatsApp." },
                    { label: "First", value: "Runs a quick test message" },
                ],
                request: { method: "POST", path: studio, body: { action: "test_version", agent_id: agent.id, version_id: draft.id, input: "Hello" } },
                steps: [
                    { method: "POST", path: studio, body: { action: "test_version", agent_id: agent.id, version_id: draft.id, input: "Hello" } },
                    { method: "POST", path: studio, body: { action: "publish_version", agent_id: agent.id, version_id: draft.id } },
                ],
                doneMessage: `Published ${agent.name} (version ${draft.version}). It's live.`,
            },
        };
    }

    return { error: `Unknown action: ${name}` };
}
