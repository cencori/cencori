import { beforeEach, describe, expect, it, vi } from 'vitest';

const mcp = vi.hoisted(() => ({ discover: vi.fn(), call: vi.fn() }));
vi.mock('@/lib/embedded/mcp', () => ({ discoverMcpTools: mcp.discover, callMcpTool: mcp.call }));
vi.mock('@/lib/security/outbound-url', () => ({ assertSafeOutboundUrl: async (url: string) => new URL(url) }));
vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/embedded/mcp-icon', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/embedded/mcp-icon')>()), fetchMcpServerIcon: async () => 'data:image/png;base64,AAAA' }));
const tokens = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/embedded/mcp-oauth', () => ({ mcpAccessToken: tokens.get }));
const nangoSession = vi.hoisted(() => vi.fn());
vi.mock('@/lib/integrations/nango', () => ({ agentToolSession: nangoSession }));

import { agentMcpBindings, buildAgentMcpServers, connectAgentMcpServer, defaultServerName, mcpResultText, readAgentMcpServers, runAgentMcpTool } from '@/lib/embedded/agent-mcp';
import { agentToolset } from '@/lib/embedded/agent-tools';

const ORG = 'org_1';
const tools = [
    { name: 'search_issues', description: 'Search issues', inputSchema: { type: 'object', properties: { q: { type: 'string' } } }, annotations: { readOnlyHint: true } },
    { name: 'delete_issue', description: 'Delete an issue', inputSchema: { type: 'object' }, annotations: { destructiveHint: true } },
];
const authError = (status: number) => Object.assign(new Error(`MCP tools/list failed (${status})`), { httpStatus: status });

describe('agent MCP servers', () => {
    beforeEach(() => {
        process.env.ENCRYPTION_SECRET ??= 'test-encryption-secret-at-least-32-chars-long';
        mcp.discover.mockReset();
        mcp.call.mockReset();
    });

    it('connects from just a URL, with destructive tools off', async () => {
        mcp.discover.mockResolvedValue({ tools, transport: 'modern' });
        const result = await connectAgentMcpServer({ url: 'mcp.linear.app/mcp', organizationId: ORG });
        if (!result.ok) throw new Error(result.message);
        expect(result.server).toMatchObject({ name: 'linear', url: 'https://mcp.linear.app/mcp', enabled: ['search_issues'] });
        expect(result.server.tools.map((t) => [t.name, t.readOnly, t.destructive])).toEqual([['search_issues', true, false], ['delete_issue', false, true]]);
    });

    it('asks for a key on 401, and sends it encrypted at rest', async () => {
        mcp.discover.mockRejectedValueOnce(authError(401));
        const first = await connectAgentMcpServer({ url: 'https://mcp.example.com/mcp', organizationId: ORG });
        expect(first).toMatchObject({ ok: false, needsAuth: true });

        mcp.discover.mockResolvedValueOnce({ tools, transport: 'modern' });
        const second = await connectAgentMcpServer({ url: 'https://mcp.example.com/mcp', headers: [{ name: 'Authorization', value: 'Bearer sk_live_1' }], organizationId: ORG });
        if (!second.ok) throw new Error(second.message);
        expect(mcp.discover.mock.calls[1][0].headers).toEqual({ Authorization: 'Bearer sk_live_1' });
        expect(second.server.headers[0].value_encrypted).not.toContain('sk_live_1');
    });

    it('explains a wrong path and refuses plain http', async () => {
        mcp.discover.mockRejectedValueOnce(authError(404));
        expect(await connectAgentMcpServer({ url: 'https://example.com', organizationId: ORG })).toMatchObject({ ok: false, needsAuth: false, message: expect.stringContaining('/mcp') });
        expect(await connectAgentMcpServer({ url: 'http://example.com/mcp', organizationId: ORG })).toMatchObject({ ok: false, needsAuth: false });
    });

    it('keeps choices and the key on refresh, turning on new safe tools', async () => {
        mcp.discover.mockResolvedValueOnce({ tools, transport: 'modern' });
        const first = await connectAgentMcpServer({ url: 'https://mcp.example.com/mcp', headers: [{ name: 'Authorization', value: 'Bearer k' }], organizationId: ORG });
        if (!first.ok) throw new Error(first.message);
        const previous = { ...first.server, enabled: [] as string[] };
        mcp.discover.mockResolvedValueOnce({ tools: [...tools, { name: 'list_projects', inputSchema: { type: 'object' } }], transport: 'modern' });
        const refreshed = await connectAgentMcpServer({ url: previous.url, organizationId: ORG, previous });
        if (!refreshed.ok) throw new Error(refreshed.message);
        expect(refreshed.server.id).toBe(previous.id);
        expect(refreshed.server.enabled).toEqual(['list_projects']);
        expect(refreshed.server.headers[0].value_encrypted).toBe(previous.headers[0].value_encrypted);
        expect(mcp.discover.mock.calls[1][0].headers).toEqual({ Authorization: 'Bearer k' });
    });

    it('saves only stored servers, only their own tools', async () => {
        mcp.discover.mockResolvedValueOnce({ tools, transport: 'modern' });
        const connected = await connectAgentMcpServer({ url: 'https://mcp.example.com/mcp', organizationId: ORG });
        if (!connected.ok) throw new Error(connected.message);
        const built = buildAgentMcpServers([{ id: connected.server.id, enabled: ['delete_issue', 'made_up'] }], [connected.server], []);
        expect(built).toMatchObject({ ok: true, servers: [{ enabled: ['delete_issue'] }] });
        expect(buildAgentMcpServers([{ id: 'mcp_unknown' }], [connected.server], []).ok).toBe(false);
    });

    it('offers switched-on tools under readable names and runs them on their server', async () => {
        mcp.discover.mockResolvedValueOnce({ tools, transport: 'modern' });
        const connected = await connectAgentMcpServer({ url: 'https://mcp.linear.app/mcp', organizationId: ORG });
        if (!connected.ok) throw new Error(connected.message);
        const config = { mcp_servers: [connected.server] };
        expect(readAgentMcpServers(config)).toHaveLength(1);
        const toolset = agentToolset(config);
        expect(toolset.definitions.map((d) => d.function.name)).toEqual(['linear__search_issues']);

        mcp.call.mockResolvedValue({ content: [{ type: 'text', text: '2 issues found' }] });
        const outcome = await toolset.run({ id: 'c1', name: 'linear__search_issues', args: '{"q":"bug"}' }, { organizationId: ORG, agentId: 'a1', surface: 'preview' });
        expect(outcome).toEqual({ ok: true, output: '2 issues found' });
        expect(mcp.call).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://mcp.linear.app/mcp', tool: 'search_issues', args: { q: 'bug' } }));

        mcp.call.mockRejectedValueOnce(authError(401));
        const [binding] = agentMcpBindings(readAgentMcpServers(config), new Set());
        expect((await runAgentMcpTool(binding, '{}', ORG)).output).toContain('key');
    });

    it('stores the server logo found on connect, and keeps only safe image data', async () => {
        mcp.discover.mockResolvedValue({ tools, transport: 'modern' });
        const result = await connectAgentMcpServer({ url: 'https://mcp.linear.app/mcp', organizationId: ORG });
        if (!result.ok) throw new Error(result.message);
        expect(result.server.icon).toBe('data:image/png;base64,AAAA');
        expect(readAgentMcpServers({ mcp_servers: [{ ...result.server, icon: 'javascript:alert(1)' }] })[0].icon).toBeUndefined();
        expect(readAgentMcpServers({ mcp_servers: [{ ...result.server, icon: 'data:text/html;base64,PHNjcmlwdD4=' }] })[0].icon).toBeUndefined();
    });

    it('turns results into text and names servers sensibly', () => {
        expect(mcpResultText({ content: [{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }] })).toBe('a\n[image]\nb');
        expect(mcpResultText({ structuredContent: { n: 1 } })).toBe('{"n":1}');
        expect(defaultServerName('https://mcp.notion.com/mcp')).toBe('notion');
        expect(defaultServerName('https://api.githubcopilot.com/mcp/')).toBe('githubcopilot');
    });

    it('uses the sign-in token, refreshing once when the server rejects it', async () => {
        const server = {
            id: 'mcp_1', name: 'linear', url: 'https://mcp.linear.app/mcp', headers: [], discovered_at: '',
            tools: [{ name: 'search', description: '', inputSchema: { type: 'object' }, readOnly: true, destructive: false }],
            enabled: ['search'], oauth: { connection_id: 'conn1', issuer: 'linear.app' },
        };
        tokens.get.mockImplementation(async (_db: unknown, _id: string, _org: string, opts: { force?: boolean } = {}) => (opts.force ? 'fresh' : 'stale'));
        mcp.call.mockRejectedValueOnce(authError(401)).mockResolvedValueOnce({ content: [{ type: 'text', text: 'ok' }] });
        const [binding] = agentMcpBindings(readAgentMcpServers({ mcp_servers: [server] }), new Set());
        expect(await runAgentMcpTool(binding, '{}', ORG)).toEqual({ ok: true, output: 'ok' });
        expect(mcp.call.mock.calls.map((c) => c[0].headers.Authorization)).toEqual(['Bearer stale', 'Bearer fresh']);

        // Signed out for good: the agent is told the server is unavailable.
        tokens.get.mockRejectedValue(new Error('signed_out'));
        expect((await runAgentMcpTool(binding, '{}', ORG)).output).toContain("isn't connected");
    });

    it('runs a connected app\'s tools through the project\'s integration session', async () => {
        const app = {
            id: 'int_google-calendar', name: 'Google Calendar', url: 'nango:google-calendar', headers: [], discovered_at: '',
            tools: [
                { name: 'google-calendar__list-events', description: 'List events', inputSchema: { type: 'object' }, readOnly: true, destructive: false },
                { name: 'google-calendar__delete-event', description: 'Delete', inputSchema: { type: 'object' }, readOnly: false, destructive: true },
            ],
            enabled: ['google-calendar__list-events'], nango: { integration: 'google-calendar' },
        };
        const config = { integrations: [app] };
        const toolset = agentToolset(config);
        // The app's own names, no server prefix; only switched-on tools.
        expect(toolset.definitions.map((d) => d.function.name)).toEqual(['google-calendar__list-events']);
        nangoSession.mockResolvedValue({ mcpUrl: 'https://api.nango.dev/session/s1/mcp', token: 'nango_agent_session_1' });
        mcp.call.mockResolvedValueOnce({ content: [{ type: 'text', text: '3 events' }] });
        const outcome = await toolset.run({ id: 'c1', name: 'google-calendar__list-events', args: '{"calendarId":"primary"}' }, { organizationId: ORG, projectId: 'proj_1', agentId: 'a1', surface: 'preview' });
        expect(outcome).toEqual({ ok: true, output: '3 events' });
        expect(nangoSession).toHaveBeenCalledWith('proj_1', { 'google-calendar': ['google-calendar__list-events'] }, { force: false });
        expect(mcp.call).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://api.nango.dev/session/s1/mcp', headers: { Authorization: 'Bearer nango_agent_session_1' }, tool: 'google-calendar__list-events', args: { calendarId: 'primary' } }));
        // Pasted MCP servers and connected apps are kept apart.
        expect(readAgentMcpServers(config)).toEqual([]);
    });
});
