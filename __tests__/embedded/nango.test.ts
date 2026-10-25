import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/security/outbound-url', () => ({ safeOutboundFetch: fetchMock }));

import { agentToolSession, createConnectLink, listProjectConnections } from '@/lib/integrations/nango';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const bodyOf = (call: number) => JSON.parse(String((fetchMock.mock.calls[call][1] as RequestInit).body));

describe('Nango integrations', () => {
    beforeEach(() => {
        process.env.NANGO_SECRET_KEY = 'test-key';
        fetchMock.mockReset();
    });

    it('tags connections with the project, and only shows the project its own', async () => {
        fetchMock.mockResolvedValueOnce(json({ data: { token: 't', connect_link: 'https://connect.nango.dev/?session_token=t', expires_at: 'x' } }));
        expect((await createConnectLink('proj_1', 'google-calendar')).url).toBe('https://connect.nango.dev/?session_token=t');
        expect(bodyOf(0)).toEqual({ tags: { cencori_project: 'proj_1' }, allowed_integrations: ['google-calendar'] });

        fetchMock.mockResolvedValueOnce(json({ connections: [
            { connection_id: 'c1', provider_config_key: 'google-calendar', provider: 'google-calendar', created: '2026-10-25', tags: { cencori_project: 'proj_1' } },
            { connection_id: 'c2', provider_config_key: 'instagram', provider: 'instagram', created: '2026-10-25', tags: { cencori_project: 'other' }, errors: [] },
            { connection_id: 'c3', provider_config_key: 'whatsapp-business', provider: 'whatsapp-business', created: '2026-10-25', tags: { cencori_project: 'proj_1' }, errors: [{ type: 'auth' }] },
        ] }));
        const connections = await listProjectConnections('proj_1');
        expect(String(fetchMock.mock.calls[1][0])).toContain('tags%5Bcencori_project%5D=proj_1');
        expect(connections).toEqual([
            { connectionId: 'c1', integration: 'google-calendar', provider: 'google-calendar', createdAt: '2026-10-25', broken: false },
            { connectionId: 'c3', integration: 'whatsapp-business', provider: 'whatsapp-business', createdAt: '2026-10-25', broken: true },
        ]);
    });

    it('opens one scoped session per toolset, pinning the switched-on tools, and reuses it', async () => {
        fetchMock.mockImplementation(async () => json({ data: { session_token: 'nango_agent_session_1', mcp_url: 'https://api.nango.dev/session/s1/mcp' } }));
        const toolset = { 'google-calendar': ['google-calendar__list-events', 'google-calendar__create-event'] };
        const session = await agentToolSession('proj_reuse', toolset);
        expect(session).toMatchObject({ mcpUrl: 'https://api.nango.dev/session/s1/mcp', token: 'nango_agent_session_1' });
        expect(bodyOf(0)).toEqual({
            tenant: { connections: { any: [{ tags: { cencori_project: 'proj_reuse' } }] } },
            toolset: { 'google-calendar': { allow: { tools: ['list-events', 'create-event'] } } },
            pinned_tools: { 'google-calendar': ['list-events', 'create-event'] },
            meta_tools: { nango_tool_search: false, nango_execute: false, nango_proxy: false },
            expires_in: '1h',
        });
        await agentToolSession('proj_reuse', { 'google-calendar': ['google-calendar__create-event', 'google-calendar__list-events'] });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await agentToolSession('proj_reuse', toolset, { force: true });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('explains a missing key instead of calling out', async () => {
        delete process.env.NANGO_SECRET_KEY;
        await expect(createConnectLink('p', 'x')).rejects.toThrow(/NANGO_SECRET_KEY/);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
