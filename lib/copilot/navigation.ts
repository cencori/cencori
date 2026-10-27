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

/** Sent to the panel when Copilot takes the user somewhere. */
export type CopilotNavigation = { path: string; label: string };

/** Pages that only make sense inside a project. */
const PROJECT_ONLY = (path: string) => getConsoleRoute(path.split(/[?#]/)[0])?.scope === "project";

export const NAVIGATE_TOOL: ChatCompletionFunctionTool = {
    type: "function",
    function: {
        name: "navigate",
        description: "Take the user to a page of the dashboard, in the same tab; Copilot stays open beside it. Use when they ask to go somewhere, be shown something or have something opened ('take me to…', 'show me…', 'open…'), or when a page shows the answer better than words (a chart, the full log). For an agent, page='agent' with agent (id or name from list_agents) and optionally agent_page. Don't use it for plain questions you can answer in the chat, or to open pages they never asked to see.",
        parameters: {
            type: "object",
            properties: {
                page: { type: "string", enum: [...Object.keys(COPILOT_PAGES), "agent"] },
                agent: { type: "string", description: "With page='agent': the agent's id or exact name." },
                agent_page: { type: "string", enum: Object.keys(COPILOT_AGENT_PAGES), description: "With page='agent'. Defaults to overview." },
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
    const page = String(args.page ?? "");
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
