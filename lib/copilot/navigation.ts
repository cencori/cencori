import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import { buildScopedConsolePath, getConsoleRoute, isConsoleHostname } from "@/lib/console/routing";

/**
 * Where Copilot can take the user, in the same tab. Paths are the console's
 * flat public ones (console.cencori.com/logs); resolveCopilotHref turns them
 * into the /{org}/{project}/… form off the console host. A fixed list, so
 * Copilot can only ever open real pages, never an arbitrary URL.
 */
export const COPILOT_PAGES = {
    overview: { path: "/home", label: "Overview" },
    gateway: { path: "/ai-gateway", label: "AI Gateway" },
    gateway_logs: { path: "/ai-gateway/logs", label: "Gateway logs" },
    models: { path: "/ai-gateway/models", label: "Models" },
    byok: { path: "/ai-gateway/providers", label: "Your provider keys (BYOK)" },
    playground: { path: "/ai-gateway/playground", label: "Playground" },
    revenue: { path: "/revenue", label: "Revenue" },
    security: { path: "/security", label: "Security" },
    agents: { path: "/agents", label: "Agents" },
    new_agent: { path: "/agents/new", label: "New agent" },
    memory: { path: "/memory", label: "Memory" },
    memories: { path: "/memory/memories", label: "Memories" },
    memory_graph: { path: "/memory/graph", label: "Memory graph" },
    memory_controls: { path: "/memory/controls", label: "Memory controls" },
    deployments: { path: "/deployments", label: "Deployments" },
    copilot_usage: { path: "/copilot/usage", label: "Copilot usage" },
    project_settings: { path: "/settings", label: "Project settings" },
    budget: { path: "/settings?tab=budget", label: "Budget settings" },
    failover: { path: "/settings?tab=providers", label: "Provider and failover settings" },
    infrastructure: { path: "/settings?tab=infrastructure", label: "Infrastructure settings" },
    networking: { path: "/settings?tab=networking", label: "Networking settings" },
    integrations: { path: "/settings?tab=integrations", label: "Integrations" },
    api_keys: { path: "/settings?tab=api", label: "API keys" },
    webhooks: { path: "/settings?tab=webhooks", label: "Webhooks" },
    projects: { path: "/projects", label: "Projects" },
    organization_settings: { path: "/organization/settings", label: "Organization settings" },
    teams: { path: "/teams", label: "Team" },
    billing: { path: "/billing", label: "Billing" },
    usage: { path: "/usage", label: "Usage" },
    audit_log: { path: "/audit-log", label: "Audit log" },
    profile: { path: "/account/profile", label: "Your profile" },
    account_settings: { path: "/account/settings", label: "Account settings" },
    account_security: { path: "/account/security", label: "Account security" },
    connected_accounts: { path: "/account/connected-accounts", label: "Connected accounts" },
} as const satisfies Record<string, { path: string; label: string }>;

/** One agent's pages, under /agents/{id}. */
export const COPILOT_AGENT_PAGES = {
    overview: { path: "", label: "" },
    configure: { path: "/configure", label: "instructions and model" },
    knowledge: { path: "/knowledge", label: "knowledge" },
    tools: { path: "/tools", label: "tools" },
    integrations: { path: "/tools?tab=integrations", label: "connected apps" },
    mcp: { path: "/tools?tab=mcp", label: "MCP servers" },
    runs: { path: "/runs", label: "conversations" },
    customers: { path: "/customers", label: "customers" },
    settings: { path: "/settings", label: "settings" },
    website: { path: "/settings#website", label: "website chat" },
    whatsapp: { path: "/settings#whatsapp", label: "WhatsApp" },
    alerts: { path: "/settings#alerts", label: "owner alerts" },
} as const satisfies Record<string, { path: string; label: string }>;

export type CopilotPage = keyof typeof COPILOT_PAGES;
export type CopilotAgentPage = keyof typeof COPILOT_AGENT_PAGES;

/**
 * Parts of a page Copilot can point at: it opens the page and outlines the
 * spot. Each is marked in the page with data-copilot-spot="<id>" (or found by
 * `selector`). Agent spots open on that agent's page.
 */
export const COPILOT_SPOTS = {
    monthly_budget: { page: "budget", label: "Monthly budget" },
    spend_cap: { page: "budget", label: "Spend cap" },
    budget_alerts: { page: "budget", label: "Budget alerts" },
    failover: { page: "failover", label: "Fallback configuration" },
    request_handling: { page: "project_settings", label: "Response caching and PII protection" },
    secret_keys: { page: "api_keys", label: "Secret keys" },
    publishable_keys: { page: "api_keys", label: "Publishable keys" },
    webhooks: { page: "webhooks", label: "Webhooks" },
    logs_filters: { page: "gateway_logs", label: "Filters" },
    logs_export: { page: "gateway_logs", label: "Export" },
    plan: { page: "billing", label: "Your plan" },
    business_plan: { page: "billing", label: "Your plan" },
    credits: { page: "billing", label: "Credits" },
    payment_methods: { page: "billing", label: "Payment methods" },
    invoices: { page: "billing", label: "Invoices" },
    invite_member: { page: "teams", label: "Invite member" },
    agent_instructions: { agentPage: "configure", label: "Instructions" },
    agent_model: { agentPage: "configure", label: "Model" },
    agent_add_knowledge: { agentPage: "knowledge", label: "Add document" },
    agent_system_tools: { agentPage: "tools", label: "System tools" },
    agent_whatsapp: { agentPage: "whatsapp", label: "WhatsApp", selector: "#whatsapp" },
    agent_website: { agentPage: "website", label: "Website chat", selector: "#website" },
    agent_alerts: { agentPage: "alerts", label: "Owner alerts", selector: "#alerts" },
} as const satisfies Record<string, { label: string; selector?: string } & ({ page: CopilotPage } | { agentPage: CopilotAgentPage })>;

export type CopilotSpot = keyof typeof COPILOT_SPOTS;

/** Where on the page a spot is. */
export function spotSelector(spot: string): string | null {
    const found = COPILOT_SPOTS[spot as CopilotSpot] as { selector?: string } | undefined;
    if (!found) return null;
    return found.selector ?? `[data-copilot-spot="${spot}"]`;
}

/**
 * Sent to the panel when Copilot takes the user somewhere and what to point
 * at there: a marked spot, or any heading, label or button by its visible
 * text. A null path points at something on the page they're already on.
 */
export type CopilotNavigation = { path: string | null; label: string; spot?: CopilotSpot; text?: string };

/** Pages that only make sense inside a project. */
const PROJECT_ONLY = (path: string) => getConsoleRoute(path.split(/[?#]/)[0])?.scope === "project";

export const NAVIGATE_TOOL: ChatCompletionFunctionTool = {
    type: "function",
    function: {
        name: "navigate",
        description: "Take the user to a page of the dashboard, in the same tab; Copilot stays open beside it. Use when they ask to go somewhere, be shown something or have something opened ('take me to…', 'show me…', 'open…'), or when a page shows the answer better than words (a chart, the full log). For an agent, page='agent' with agent (id or name from list_agents) and optionally agent_page. To point at one part of a page ('where do I set…', 'where is…'), pass highlight: it opens that part's page (page is then ignored; agent spots still need agent) and outlines it on screen. For anything else on a page, pass highlight_text: the exact visible text of a heading, setting name, tab or button there (e.g. 'Connect', 'CostGraph', 'Rate limiting'), and it's outlined once the page shows it. page='current' points at something on the page they're on without moving. Don't use it for plain questions you can answer in the chat, or to open pages they never asked to see.",
        parameters: {
            type: "object",
            properties: {
                page: { type: "string", enum: [...Object.keys(COPILOT_PAGES), "agent", "current"] },
                agent: { type: "string", description: "With page='agent': the agent's id or exact name." },
                agent_page: { type: "string", enum: Object.keys(COPILOT_AGENT_PAGES), description: "With page='agent'. Defaults to overview." },
                highlight: { type: "string", enum: Object.keys(COPILOT_SPOTS), description: "Outline this part of the page. Spots starting agent_ are on an agent's pages." },
                highlight_text: { type: "string", description: "Outline the heading, setting, tab or button with this exact visible text on the page." },
            },
            required: ["page"],
        },
    },
};

/**
 * The page to open for a navigate call, or why not. `findAgent` resolves an
 * agent reference within the project (the caller already has it).
 */
export async function prepareNavigation(
    args: Record<string, unknown>,
    scope: { hasProject: boolean },
    findAgent: (ref: unknown) => Promise<{ agent: { id: string; name: string } } | { error: string }>,
): Promise<{ navigation: CopilotNavigation } | { error: string }> {
    if (args.highlight !== undefined && args.highlight !== null && args.highlight !== "") {
        const spot = COPILOT_SPOTS[args.highlight as CopilotSpot] as { label: string; page?: CopilotPage; agentPage?: CopilotAgentPage } | undefined;
        if (!spot) return { error: `Unknown highlight "${args.highlight}".` };
        const prepared = await prepareNavigation(
            spot.agentPage ? { page: "agent", agent: args.agent, agent_page: spot.agentPage } : { page: spot.page },
            scope,
            findAgent,
        );
        if ("error" in prepared) return prepared;
        const { label } = prepared.navigation;
        // "Arcie · WhatsApp", not "Arcie · WhatsApp · WhatsApp".
        const named = label.toLowerCase().endsWith(spot.label.toLowerCase()) ? label : `${label} · ${spot.label}`;
        return { navigation: { ...prepared.navigation, label: named, spot: args.highlight as CopilotSpot } };
    }
    const text = typeof args.highlight_text === "string" ? args.highlight_text.trim().slice(0, 80) : "";
    if (text) {
        const rest = { ...args, highlight_text: undefined };
        const prepared = String(args.page ?? "current") === "current"
            ? { navigation: { path: null, label: "this page" } }
            : await prepareNavigation(rest, scope, findAgent);
        if ("error" in prepared) return prepared;
        return { navigation: { ...prepared.navigation, label: prepared.navigation.path === null ? text : `${prepared.navigation.label} · ${text}`, text } };
    }
    const page = String(args.page ?? "");
    if (page === "current") return { error: "page='current' needs highlight_text: what to point at." };
    if (page === "agent") {
        if (!scope.hasProject) return { error: "No project is selected, so there are no agents to open." };
        const found = await findAgent(args.agent);
        if ("error" in found) return found;
        const sub = COPILOT_AGENT_PAGES[(args.agent_page as CopilotAgentPage) ?? "overview"] ?? COPILOT_AGENT_PAGES.overview;
        return {
            navigation: {
                path: `/agents/${encodeURIComponent(found.agent.id)}${sub.path}`,
                label: sub.label ? `${found.agent.name} · ${sub.label}` : found.agent.name,
            },
        };
    }
    const target = COPILOT_PAGES[page as CopilotPage];
    if (!target) return { error: `Unknown page "${page}".` };
    if (!scope.hasProject && PROJECT_ONLY(target.path)) return { error: "That page belongs to a project, and none is selected." };
    return { navigation: { path: target.path, label: target.label } };
}

/**
 * The href for a Copilot path from where the user is now: the flat console
 * path on the console host, else the same page under /{org}/{project} or
 * /{org}/~. Account pages are the same everywhere.
 */
export function resolveCopilotHref(
    path: string,
    where: { hostname: string; pathname: string; organizationSlug: string | null; projectSlug: string | null },
): string | null {
    if (path.startsWith("/account/")) return path;
    if (isConsoleHostname(where.hostname) || getConsoleRoute(where.pathname)) return path;
    const { organizationSlug, projectSlug } = where;
    const match = /^([^?#]*)(.*)$/.exec(path)!;
    const route = getConsoleRoute(match[1]);
    if (!route || !organizationSlug) return null;
    const scoped = buildScopedConsolePath(route, organizationSlug, projectSlug);
    return scoped ? `${scoped}${match[2]}` : null;
}

/** Menus Copilot can open on screen for the user. */
export const COPILOT_MENUS = {
    command_palette: "the command palette",
    account_menu: "your account menu",
    switch_organization: "the organization switcher",
} as const;

export type CopilotMenu = keyof typeof COPILOT_MENUS;

export const OPEN_MENU_TOOL: ChatCompletionFunctionTool = {
    type: "function",
    function: {
        name: "open_menu",
        description: "Open a menu on screen for the user: 'command_palette' (search and jump anywhere), 'account_menu' (profile, account settings, sign out, plan) or 'switch_organization' (their organizations and projects). Only when they ask for it, or ask how to switch organization or project.",
        parameters: {
            type: "object",
            properties: { menu: { type: "string", enum: Object.keys(COPILOT_MENUS) } },
            required: ["menu"],
        },
    },
};
