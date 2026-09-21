import { describe, expect, it, vi, beforeEach } from 'vitest';
import { safeOutboundFetch } from '@/lib/security/outbound-url';
import {
    MCP_MODERN_PROTOCOL_VERSION,
    applyAllowlist,
    callMcpTool,
    diffToolSnapshot,
    discoverMcpTools,
    mcpAuthHeaders,
} from '@/lib/embedded/mcp';
import { encryptApiKey } from '@/lib/encryption';

vi.mock('@/lib/security/outbound-url', () => ({
    safeOutboundFetch: vi.fn(),
    assertSafeOutboundUrl: vi.fn(async (u: string | URL) => new URL(u.toString())),
}));

const mockedFetch = vi.mocked(safeOutboundFetch);

function jsonResponse(payload: unknown, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json', ...headers },
    });
}

function lastCall() {
    const calls = mockedFetch.mock.calls;
    const last = calls[calls.length - 1];
    return { url: last[0] as string, init: last[1] as { headers: Record<string, string>; body: string } };
}

function callHeaders() {
    return (lastCall().init.headers ?? {}) as Record<string, string>;
}

function callBody() {
    return JSON.parse(lastCall().init.body as string) as { method: string; params: Record<string, unknown> };
}

beforeEach(() => {
    mockedFetch.mockReset();
});

describe('modern stateless transport (2026-07-28)', () => {
    it('discovers with header routing and no handshake', async () => {
        mockedFetch.mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'search_crm' }] } }));
        const { tools, transport } = await discoverMcpTools({ url: 'https://mcp.example.com/mcp' });

        expect(transport).toBe('modern');
        expect(tools).toEqual([{ name: 'search_crm' }]);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        const headers = callHeaders();
        expect(headers['MCP-Protocol-Version']).toBe(MCP_MODERN_PROTOCOL_VERSION);
        expect(headers['Mcp-Method']).toBe('tools/list');
        const body = callBody();
        expect(body.method).toBe('tools/list');
        expect(body.params._meta).toMatchObject({ 'io.modelcontextprotocol/clientInfo': { name: 'cencori-embedded' } });
    });

    it('calls tools with Mcp-Name and client _meta', async () => {
        mockedFetch.mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: { content: 'ok' } }));
        const result = await callMcpTool({ url: 'https://mcp.example.com/mcp', tool: 'search_crm', args: { q: 'acme' } });

        expect(result).toMatchObject({ content: 'ok' });
        expect(callHeaders()['Mcp-Name']).toBe('search_crm');
        expect(callBody().params).toMatchObject({ name: 'search_crm', arguments: { q: 'acme' } });
    });

    it('propagates caller auth headers untouched', async () => {
        mockedFetch.mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: { tools: [] } }));
        await discoverMcpTools({ url: 'https://mcp.example.com/mcp', headers: { Authorization: 'Bearer secret-123' } });

        expect(callHeaders()['Authorization']).toBe('Bearer secret-123');
        expect(callHeaders()['MCP-Protocol-Version']).toBe(MCP_MODERN_PROTOCOL_VERSION);
    });

    it('parses SSE frames from modern servers', async () => {
        mockedFetch.mockResolvedValueOnce(
            new Response('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"t"}]}}\n\n', {
                status: 200,
                headers: { 'content-type': 'text/event-stream' },
            }),
        );
        const { tools, transport } = await discoverMcpTools({ url: 'https://mcp.example.com/mcp' });
        expect(transport).toBe('modern');
        expect(tools).toEqual([{ name: 't' }]);
    });

    it('surfaces tool isError results as failures', async () => {
        mockedFetch.mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: { isError: true, content: 'boom' } }));
        await expect(callMcpTool({ url: 'https://mcp.example.com/mcp', tool: 't' })).rejects.toThrow(/MCP tool error/);
    });
});

describe('legacy session fallback', () => {
    function legacySequence(sessionHeader: Record<string, string> = { 'mcp-session-id': 'sess-1' }) {
        mockedFetch
            // Modern attempt rejected by a pre-2026 server.
            .mockResolvedValueOnce(new Response('unknown method', { status: 400 }))
            // initialize → session ID in the response header.
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05' } }, sessionHeader))
            // notifications/initialized acknowledgement.
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 2, result: {} }))
            // tools/list.
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 3, result: { tools: [{ name: 'legacy_tool' }] } }));
    }

    it('captures Mcp-Session-Id from the initialize response header', async () => {
        legacySequence();
        const { tools, transport } = await discoverMcpTools({ url: 'https://legacy.example.com/mcp' });

        expect(transport).toBe('legacy');
        expect(tools).toEqual([{ name: 'legacy_tool' }]);
        // tools/list (4th call) must carry the session header.
        const listHeaders = (mockedFetch.mock.calls[3][1] as { headers: Record<string, string> }).headers;
        expect(listHeaders['mcp-session-id']).toBe('sess-1');
        // Legacy handshake carries no modern routing headers.
        expect(listHeaders['Mcp-Method']).toBeUndefined();
    });

    it('falls back to a sessionId in the initialize result body', async () => {
        legacySequence({});
        mockedFetch.mockReset();
        mockedFetch
            .mockResolvedValueOnce(new Response('not found', { status: 404 }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: { sessionId: 'body-sess' } }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 2, result: {} }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 3, result: { tools: [] } }));
        const { transport } = await discoverMcpTools({ url: 'https://legacy.example.com/mcp' });
        expect(transport).toBe('legacy');
        const listHeaders = (mockedFetch.mock.calls[3][1] as { headers: Record<string, string> }).headers;
        expect(listHeaders['mcp-session-id']).toBe('body-sess');
    });

    it('rethrows non-protocol modern failures without legacy fallback', async () => {
        mockedFetch.mockResolvedValueOnce(new Response('server exploded', { status: 500 }));
        await expect(discoverMcpTools({ url: 'https://mcp.example.com/mcp' })).rejects.toThrow(/500/);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
    });

    it('sse-declared servers skip the modern attempt', async () => {
        mockedFetch
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }, { 'mcp-session-id': 's' }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 2, result: {} }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 3, result: { tools: [{ name: 't' }] } }));
        const { transport } = await discoverMcpTools({ url: 'https://sse.example.com/events', transport: 'sse' });
        expect(transport).toBe('legacy');
        // First call is the legacy initialize handshake, not a modern header-routed call.
        const firstBody = JSON.parse((mockedFetch.mock.calls[0][1] as { body: string }).body) as { method: string };
        expect(firstBody.method).toBe('initialize');
        expect(mockedFetch).toHaveBeenCalledTimes(3);
    });
});

describe('credential injection for bound connections', () => {
    it('decrypts the project-scoped connection into a Bearer header', async () => {
        const orgId = 'org_test';
        process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'test-secret-for-mcp-auth';
        const encrypted = encryptApiKey('mcp-bearer-token', orgId);
        const supabase = {
            from: () => ({
                select: () => ({
                    eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { encrypted_access_ref: encrypted } }) }) }),
                }),
            }),
        };
        const headers = await mcpAuthHeaders(supabase as never, 'proj_1', orgId, 'conn_1');
        expect(headers).toEqual({ Authorization: 'Bearer mcp-bearer-token' });
    });

    it('returns no headers without a bound connection', async () => {
        const supabase = { from: () => { throw new Error('must not query'); } };
        await expect(mcpAuthHeaders(supabase as never, 'p', 'o', null)).resolves.toEqual({});
    });
});

describe('snapshot helpers', () => {
    it('diffs and allowlists as before', () => {
        expect(diffToolSnapshot([{ name: 'a' }], [{ name: 'a' }, { name: 'b' }])).toEqual({ added: ['b'], removed: [], unchanged: ['a'] });
        expect(applyAllowlist(['a', 'b'], ['b'])).toEqual(['b']);
    });
});
