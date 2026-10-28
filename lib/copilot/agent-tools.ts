import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import type { CopilotToolContext } from "@/lib/copilot/tools";
import type { PrepareResult } from "@/lib/copilot/actions";
import { readSystemTools } from "@/lib/embedded/agent-tools";
import { readAgentIntegrations, readAgentMcpServers } from "@/lib/embedded/agent-mcp";
import { RESTAURANT_DEFAULTS, restaurantInstructions, type RestaurantDetails } from "@/lib/embedded/templates";
import { getOwnerAlerts } from "@/lib/embedded/owner-alerts";
import { getCatalog } from "@/lib/embedded/catalog";
import { cleanProducts, PRODUCTS_MAX } from "@/lib/embedded/catalog-format";

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
            name: "list_events",
            description: "The business's events (parties, shows, dinners it sells tickets for in Studio): name, when, venue, ticket types with prices, tickets sold of how many, money in, how many checked in, whether still selling, and the public ticket link.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "list_agents",
            description: "The current project's embedded agents (the ones businesses deploy to WhatsApp, their website and so on): name, whether published, template, model, and how busy each is (runs in the last 7 days, last run). Sorted busiest first.",
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
            name: "update_event",
            description: "Propose changing an event (list_events first to find it): its name, date and time, end, venue, description or ticket types, or stop and restart its ticket sales. Send only what changes. Ticket holders are emailed when the date, time or venue changes. Ticket types with tickets sold can't be removed or cut below what's sold; new prices are for new sales only. The ticket link doesn't change.",
            parameters: {
                type: "object",
                properties: {
                    event: { type: "string", description: "The event's id or name." },
                    name: { type: "string" },
                    starts_at: { type: "string", description: "ISO 8601 with offset; Lagos time (+01:00) unless they say otherwise." },
                    ends_at: { type: "string" },
                    venue: { type: "string" },
                    description: { type: "string" },
                    tiers: {
                        type: "array",
                        description: "The full list of ticket types after the change: existing ones under the same name (so they keep their sales), plus new ones; one left out is removed.",
                        items: {
                            type: "object",
                            properties: { name: { type: "string" }, price: { type: "number" }, capacity: { type: "integer" } },
                            required: ["name", "price"],
                        },
                    },
                    selling: { type: "boolean", description: "false stops ticket sales, true starts them again." },
                },
                required: ["event"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "create_event",
            description: "Propose an event the business sells tickets for (a party, show, dinner, class) from what the owner said, e.g. \"party Dec 20, 8pm, ₦10k regular, ₦50k VIP, 300 people\". Makes a public ticket page (studio.cencori.com/e/…) where guests pay by the business's payment link or by transfer and get QR tickets; the owner checks them in from Studio. Ask only for what's missing: the name, the date and start time, and at least one ticket type with its price.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    starts_at: { type: "string", description: "ISO 8601 with offset. Times the owner gives are Lagos time unless they say otherwise: 8pm on 20 Dec is 2026-12-20T20:00:00+01:00. Use now_utc to work out the year and relative dates (\"next Saturday\")." },
                    ends_at: { type: "string", description: "ISO 8601 with offset, if they said when it ends." },
                    venue: { type: "string" },
                    description: { type: "string", description: "One or two lines about it, in the owner's words; empty if they gave none." },
                    tiers: {
                        type: "array",
                        description: "Ticket types. A total headcount with one type goes on that type.",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string", description: "Regular, VIP, Table for 6…" },
                                price: { type: "number", description: "In naira (main unit): ₦10k is 10000. 0 for free." },
                                capacity: { type: "integer", description: "How many of this type; omit for no limit." },
                            },
                            required: ["name", "price"],
                        },
                    },
                },
                required: ["name", "starts_at", "tiers"],
            },
        },
    },
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
            description: "Propose switching an agent's built-in actions on or off: end_conversation (closes the chat when the person is done), request_callback (takes a name, number and reason and emails the owner to call back) take_payments (sends payment links for deposits, tables and orders; needs a payment provider (Paystack, Flutterwave or Stripe) connected under the agent's Integrations) and sell_products (answers about the business's products, prices and stock, and takes orders; needs products added with add_products). Goes into a draft.",
            parameters: {
                type: "object",
                properties: { agent: agentRef, end_conversation: { type: "boolean" }, request_callback: { type: "boolean" }, take_payments: { type: "boolean" }, sell_products: { type: "boolean" } },
                required: ["agent"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "add_products",
            description: "Propose adding products to the project's catalog (shared by its agents), from a price list the user gave or attached. Products with the same name are updated. Agents sell from it once sell_products is on.",
            parameters: {
                type: "object",
                properties: {
                    products: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                price: { type: "number", description: "In the main unit, e.g. 25000 for ₦25,000." },
                                options: { type: "string", description: "Sizes, colours…, e.g. \"S, M, L\"." },
                                stock: { type: "integer", description: "Units in stock; omit when they don't track stock." },
                                description: { type: "string" },
                            },
                            required: ["name", "price"],
                        },
                    },
                    currency: { type: "string", description: "Three-letter code; only when it isn't the catalog's current one (NGN by default)." },
                },
                required: ["products"],
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
            description: "Offer a button that opens the page where the user connects something themselves, because it needs their own sign-in: 'calendar' (connect Google Calendar and other apps), 'whatsapp' (Connect WhatsApp), 'website' (the website chat and its install snippet), 'payments' (connect Paystack, Flutterwave or Stripe with their secret key, under Integrations), 'products' (the product list, to import a spreadsheet), 'preview' (try the agent). Use after creating an agent for the steps you can't do for them.",
            parameters: {
                type: "object",
                properties: { agent: agentRef, page: { type: "string", enum: ["calendar", "whatsapp", "website", "payments", "products", "preview"] } },
                required: ["agent", "page"],
            },
        },
    },
];

export const AGENT_TOOL_STATUS: Record<string, string> = {
    list_agents: "Listing agents",
    list_events: "Reading your events",
    create_event: "Preparing the event",
    update_event: "Preparing the change",
    get_agent: "Reading the agent",
    create_agent: "Preparing the agent",
    update_agent_instructions: "Preparing instruction changes",
    add_agent_knowledge: "Preparing the document",
    set_agent_system_tools: "Preparing tool changes",
    add_products: "Preparing the products",
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

export async function findAgent(ctx: CopilotToolContext, ref: unknown): Promise<{ agent: AgentRow } | { error: string }> {
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
    if (name === "list_events") {
        const { eventSummaries } = await import("@/lib/studio/events");
        const events = await eventSummaries(ctx.admin as never, ctx.project.id);
        return {
            events: events.map((item) => ({
                id: item.event.id,
                name: item.event.name,
                starts_at: item.event.starts_at,
                venue: item.event.venue,
                selling: item.event.status === "live",
                link: `https://studio.cencori.com/e/${item.event.slug}`,
                sold: item.sold,
                of: item.capacity,
                earned: item.earned,
                currency: item.event.currency,
                checked_in: item.checked_in,
                tickets: item.by_tier.map((tier) => ({ name: tier.name, price: tier.price, sold: tier.sold, of: tier.capacity })),
            })),
        };
    }

    if (name === "list_agents") {
        const { data } = await ctx.admin.from("agents").select("id, name, description, is_active, stable_version_id, created_at").eq("project_id", ctx.project.id).order("created_at", { ascending: false }).limit(50);
        const agents = (data ?? []) as AgentRow[];
        const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
        const listed = await Promise.all(agents.map(async (a) => {
            const runs = () => ctx.admin.from("embedded_runs").select("created_at", { count: "exact" }).eq("project_id", ctx.project!.id).eq("agent_id", a.id);
            const [versions, recent, last] = await Promise.all([
                versionsOf(ctx, a.id),
                runs().gte("created_at", since).limit(0),
                runs().order("created_at", { ascending: false }).limit(1),
            ]);
            const config = workingVersion(versions)?.config_json ?? {};
            return {
                id: a.id, name: a.name, description: a.description, published: !!a.stable_version_id, template: config.template ?? null, model: config.model ?? null,
                runs_last_7_days: recent.count ?? 0,
                last_run_at: (last.data?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
            };
        }));
        listed.sort((x, y) => y.runs_last_7_days - x.runs_last_7_days || (y.last_run_at ?? "").localeCompare(x.last_run_at ?? ""));
        return { count: listed.length, agents: listed };
    }
    if (name === "get_agent") {
        const found = await findAgent(ctx, args.agent);
        if ("error" in found) return found;
        const versions = await versionsOf(ctx, found.agent.id);
        const working = workingVersion(versions);
        const config = working?.config_json ?? {};
        const { data: paystack } = await ctx.admin.from("tool_connections").select("metadata").eq("project_id", ctx.project.id).eq("connector_slug", "payments").eq("status", "active").limit(1).maybeSingle();
        const catalog = await getCatalog(ctx.admin, ctx.project.id);
        const [{ data: kb }, channels] = await Promise.all([
            ctx.admin.from("knowledge_bases").select("id").eq("project_id", ctx.project.id).eq("agent_id", found.agent.id).is("tenant_id", null).maybeSingle(),
            channelState(ctx, found.agent.id),
        ]);
        const { data: sources } = kb
            ? await ctx.admin.from("knowledge_sources").select("id, name, status").eq("knowledge_base_id", (kb as { id: string }).id).order("created_at", { ascending: false }).limit(30)
            : { data: [] as Array<{ id: string; name: string; status: string }> };
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
            readSystemTools(config).take_payments && !paystack && "connect a payment provider (Paystack, Flutterwave or Stripe) so it can take payments (user pastes their key: open_agent_page payments)",
            readSystemTools(config).sell_products && !catalog?.metadata.products.length && "add products (add_products from a price list they give, or they import a spreadsheet: open_agent_page products)",
            readSystemTools(config).sell_products && !paystack && "optional: connect payments so orders are paid by link (open_agent_page payments)",
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
            payments: paystack ? { provider: (paystack.metadata as { provider?: string } | null)?.provider ?? null, mode: (paystack.metadata as { mode?: string } | null)?.mode ?? null, currency: (paystack.metadata as { currency?: string } | null)?.currency ?? null } : null,
            products: catalog ? { count: catalog.metadata.products.length, currency: catalog.metadata.currency, orders_to_fulfil: catalog.metadata.orders.filter((o) => o.status === "paid" || o.status === "new").length } : null,
            mcp_servers: readAgentMcpServers(config).map((s) => s.name),
            knowledge: (sources ?? []).map((s) => ({ id: s.id, name: s.name, status: s.status })),
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

    if (name === "update_event") {
        const { cleanEvent, eventSummaries } = await import("@/lib/studio/events");
        const ref = text(args.event, 120).toLowerCase();
        const events = await eventSummaries(ctx.admin as never, project.id);
        const found = events.find((item) => item.event.id === ref) ?? events.find((item) => item.event.name.toLowerCase() === ref) ?? events.find((item) => item.event.name.toLowerCase().includes(ref));
        if (!ref || !found) return { error: "Say which event (list_events shows them)." };
        const current = found.event;
        const fields = Object.fromEntries((["name", "starts_at", "ends_at", "venue", "description", "tiers"] as const).filter((key) => args[key] !== undefined).map((key) => [key, args[key]]));
        if (!Object.keys(fields).length && typeof args.selling !== "boolean") return { error: "Say what to change." };
        const merged = cleanEvent({ ...current, ...fields });
        if (!merged.ok) return { error: merged.message };
        const sold = Object.fromEntries(found.by_tier.map((tier) => [tier.name.toLowerCase(), tier.sold]));
        if (fields.tiers) {
            for (const tier of found.by_tier) {
                const kept = merged.event.tiers.find((item) => item.name.toLowerCase() === tier.name.toLowerCase());
                if (!kept && tier.sold > 0) return { error: `${tier.name} has ${tier.sold} sold, so it can't be removed.` };
                if (kept && kept.capacity !== null && kept.capacity < tier.sold) return { error: `${tier.name} has ${tier.sold} sold already, so it needs at least ${tier.sold}.` };
            }
        }
        const price = (amount: number) => (amount === 0 ? "Free" : `₦${amount.toLocaleString("en-NG")}`);
        const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
        const moved = (fields.starts_at !== undefined && merged.event.starts_at !== current.starts_at) || (fields.venue !== undefined && merged.event.venue !== current.venue);
        const details = [
            ...(fields.name !== undefined && merged.event.name !== current.name ? [{ label: "Name", value: merged.event.name }] : []),
            ...(fields.starts_at !== undefined && merged.event.starts_at !== current.starts_at ? [{ label: "When", value: `${when(current.starts_at)} → ${when(merged.event.starts_at)}` }] : []),
            ...(fields.venue !== undefined && merged.event.venue !== current.venue ? [{ label: "Where", value: merged.event.venue || "No venue" }] : []),
            ...(fields.description !== undefined ? [{ label: "About", value: merged.event.description || "None" }] : []),
            ...(fields.tiers ? [{ label: "Tickets", value: merged.event.tiers.map((tier) => `${tier.name} ${price(tier.price)}${tier.capacity ? ` × ${tier.capacity}` : ""}${sold[tier.name.toLowerCase()] ? ` (${sold[tier.name.toLowerCase()]} sold)` : ""}`).join(", ") }] : []),
            ...(typeof args.selling === "boolean" ? [{ label: "Selling", value: args.selling ? "Start again" : "Stop" }] : []),
            ...(moved && found.sold > 0 ? [{ label: "Ticket holders", value: `${found.sold} emailed about the change` }] : []),
        ];
        return {
            proposal: {
                id, kind: name, tier: "normal",
                title: `Change "${current.name}"`,
                details,
                request: { method: "POST", path: "/api/studio/events", body: { project_id: project.id, action: "update", event_id: current.id, ...fields, ...(typeof args.selling === "boolean" ? { status: args.selling ? "live" : "closed" } : {}) } },
                doneMessage: `Updated "${merged.event.name}".${moved && found.sold > 0 ? " Ticket holders have been emailed." : ""}`,
            },
        };
    }

    if (name === "create_event") {
        const { cleanEvent } = await import("@/lib/studio/events");
        const cleaned = cleanEvent(args);
        if (!cleaned.ok) return { error: cleaned.message };
        const event = cleaned.event;
        const price = (amount: number) => (amount === 0 ? "Free" : `₦${amount.toLocaleString("en-NG")}`);
        const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(event.starts_at));
        return {
            proposal: {
                id, kind: name, tier: "normal",
                title: `Make "${event.name}"`,
                details: [
                    { label: "When", value: when },
                    ...(event.venue ? [{ label: "Where", value: event.venue }] : []),
                    { label: "Tickets", value: event.tiers.map((tier) => `${tier.name} ${price(tier.price)}${tier.capacity ? ` × ${tier.capacity}` : ""}`).join(", ") },
                ],
                request: { method: "POST", path: "/api/studio/events", body: { project_id: project.id, action: "create", ...event } },
                doneMessage: `Made "${event.name}". It's in Sales → Events, with its ticket link to share.`,
            },
        };
    }

    if (name === "add_products") {
        const catalog = await getCatalog(ctx.admin, project.id);
        const currency = text(args.currency, 3).toUpperCase();
        if (currency && !/^[A-Z]{3}$/.test(currency)) return { error: "currency is a three-letter code, like NGN." };
        const incoming = cleanProducts(args.products);
        if (!incoming.ok) return { error: incoming.message };
        if (incoming.products.length === 0) return { error: "Give at least one product." };
        // Same name updates the product (keeping its id, so past orders still point at it).
        const byName = new Map((catalog?.metadata.products ?? []).map((p) => [p.name.toLowerCase(), p]));
        let updated = 0;
        for (const product of incoming.products) {
            const existing = byName.get(product.name.toLowerCase());
            if (existing) updated++;
            byName.set(product.name.toLowerCase(), existing ? { ...product, id: existing.id, available: existing.available } : product);
        }
        if (byName.size > PRODUCTS_MAX) return { error: `A catalog holds up to ${PRODUCTS_MAX} products.` };
        const shownCurrency = currency || catalog?.metadata.currency || "NGN";
        const sample = incoming.products.slice(0, 4).map((p) => `${p.name} (${shownCurrency} ${p.price.toLocaleString("en-NG")})`).join(", ");
        return {
            proposal: {
                id, kind: name, tier: "normal",
                title: `Add ${incoming.products.length} product${incoming.products.length === 1 ? "" : "s"}`,
                details: [
                    { label: "New", value: String(incoming.products.length - updated) },
                    ...(updated ? [{ label: "Updated", value: String(updated) }] : []),
                    { label: "Products", value: `${sample}${incoming.products.length > 4 ? `, and ${incoming.products.length - 4} more` : ""}` },
                    ...(currency && currency !== catalog?.metadata.currency ? [{ label: "Currency", value: currency }] : []),
                ],
                request: { method: "PUT", path: `/api/projects/${encodeURIComponent(project.id)}/catalog`, body: { products: [...byName.values()], ...(currency ? { currency } : {}) } },
                doneMessage: `Added ${incoming.products.length} product${incoming.products.length === 1 ? "" : "s"} to the catalog (${byName.size} in total). Agents with sell_products on sell from it straight away.`,
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
            payments: { path: "tools?tab=integrations", label: "Open Integrations", title: "Connect payments" },
            products: { path: "tools?tab=integrations", label: "Open Integrations", title: "Add products" },
            preview: { path: "", label: "Open the agent", title: "Try the agent" },
        };
        const page = pages[String(args.page)];
        if (!page) return { error: "page must be calendar, whatsapp, website, payments, products or preview." };
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
        const labels = { end_conversation: "End conversation", request_callback: "Request a callback", take_payments: "Take payments", sell_products: "Sell products" } as const;
        for (const key of ["end_conversation", "request_callback", "take_payments", "sell_products"] as const) {
            if (typeof args[key] !== "boolean") continue;
            next[key] = args[key] ? (current[key] ?? {}) : null;
            details.push({ label: labels[key], value: args[key] ? "On" : "Off" });
        }
        if (details.length === 0) return { error: "Say which tools to switch: end_conversation, request_callback, take_payments and/or sell_products." };
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
