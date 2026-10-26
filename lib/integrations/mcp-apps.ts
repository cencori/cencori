/**
 * Apps whose own MCP server the business signs in to (MCP OAuth, see
 * lib/embedded/mcp-oauth), offered in the integrations catalog next to the
 * Nango apps: one click, the app's sign-in page, connected. Each server's
 * address comes from the environment, so an app shows as coming soon until
 * it's set (Bumpa's MCP is in early access).
 */

export interface McpApp {
    id: string;
    name: string;
    /** For the logo. */
    domain: string;
    /** The catalog group it shows in (see APP_GROUPS in the console). */
    category: 'commerce';
    url: string | null;
}

const MCP_APPS: Array<Omit<McpApp, 'url'> & { env: string }> = [
    { id: 'bumpa', name: 'Bumpa', domain: 'getbumpa.com', category: 'commerce', env: 'BUMPA_MCP_URL' },
];

export function listMcpApps(): McpApp[] {
    return MCP_APPS.map(({ env, ...app }) => ({ ...app, url: process.env[env]?.trim() || null }));
}

export function mcpAppUrl(id: unknown): string | null {
    return listMcpApps().find((app) => app.id === id)?.url ?? null;
}
