import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent, MCPServerStdio, MCPServerStreamableHttp, run } from './index';

const tools = [
    { name: 'search_issues', description: 'Search issues', inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] } },
    { name: 'delete_issue', description: 'Delete an issue', inputSchema: { type: 'object', properties: { id: { type: 'string' } } }, annotations: { destructiveHint: true } },
    { name: 'team.list', description: 'List teams' },
];

/** A fake MCP server over HTTP. `legacy`: rejects stateless requests and wants the handshake. */
function fakeMcp({ legacy = false, sse = false } = {}) {
    const calls: Array<{ method: string; headers: Record<string, string>; params: any }> = [];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init!.body));
        const headers = Object.fromEntries(Object.entries(init!.headers as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
        calls.push({ method: body.method, headers, params: body.params });
        if (legacy && headers['mcp-protocol-version'] === '2026-07-28') return new Response('unsupported', { status: 400 });
        if (legacy && body.method !== 'initialize' && body.method !== 'notifications/initialized' && headers['mcp-session-id'] !== 'sess_1') {
            return new Response('no session', { status: 400 });
        }
        if (!('id' in body)) return new Response(null, { status: 202 });
        let result: unknown;
        if (body.method === 'initialize') result = { protocolVersion: '2025-11-25', capabilities: {} };
        else if (body.method === 'tools/list') result = { tools };
        else if (body.method === 'tools/call') result = { content: [{ type: 'text', text: `${body.params.name}:${JSON.stringify(body.params.arguments)}` }] };
        const message = { jsonrpc: '2.0', id: body.id, result };
        const resHeaders: Record<string, string> = body.method === 'initialize' ? { 'mcp-session-id': 'sess_1' } : {};
        if (sse) {
            return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress', params: {} })}\n\nevent: message\ndata: ${JSON.stringify(message)}\n\n`, { headers: { 'Content-Type': 'text/event-stream', ...resHeaders } });
        }
        return new Response(JSON.stringify(message), { headers: { 'Content-Type': 'application/json', ...resHeaders } });
    }) as unknown as typeof fetch;
    return { fetch: fetchImpl, calls };
}

describe('MCPServerStreamableHttp', () => {
    it('lists and calls tools statelessly', async () => {
        const mcp = fakeMcp();
        const server = new MCPServerStreamableHttp({ url: 'https://mcp.linear.app/mcp', headers: { Authorization: 'Bearer t' }, fetch: mcp.fetch });
        expect((await server.listTools()).map((t) => t.name)).toEqual(['search_issues', 'delete_issue', 'team.list']);
        const result = await server.callTool('search_issues', { q: 'bug' });
        expect(result.content?.[0].text).toBe('search_issues:{"q":"bug"}');
        expect(mcp.calls.map((c) => c.method)).toEqual(['tools/list', 'tools/call']);
        expect(mcp.calls[1].headers).toMatchObject({ authorization: 'Bearer t', 'mcp-method': 'tools/call', 'mcp-name': 'search_issues' });
        expect(server.name).toBe('linear');
    });

    it('falls back to the session handshake, and reads event-stream replies', async () => {
        const mcp = fakeMcp({ legacy: true, sse: true });
        const server = new MCPServerStreamableHttp({ url: 'https://old.example/mcp', fetch: mcp.fetch });
        await server.listTools();
        await server.callTool('search_issues', { q: 'x' });
        expect(mcp.calls.map((c) => c.method)).toEqual(['tools/list', 'initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
        expect(mcp.calls.at(-1)!.headers['mcp-session-id']).toBe('sess_1');
    });
});

describe('agent with MCP servers', () => {
    it('turns MCP tools into agent tools: names, allow-list, approvals', async () => {
        const mcp = fakeMcp();
        const server = new MCPServerStreamableHttp({ url: 'https://mcp.linear.app/mcp', fetch: mcp.fetch, allowedTools: ['search_issues', 'delete_issue', 'team.list'] });
        const own = { type: 'function', name: 'search_issues' } as never;
        const agent = new Agent({ name: 'Ops', mcpServers: [server] });
        const resolved = await agent.resolveTools();
        expect(resolved.map((t) => t.name)).toEqual(['search_issues', 'delete_issue', 'team_list']);
        expect(resolved.find((t) => t.name === 'delete_issue')!.needsApproval).toBe(true);
        expect(resolved.find((t) => t.name === 'search_issues')!.needsApproval).toBe(false);
        // A clash with the agent's own tool gets the server's name.
        const clash = new Agent({ name: 'Ops', tools: [{ ...(await agent.resolveTools())[0], name: 'search_issues' }], mcpServers: [new MCPServerStreamableHttp({ url: 'https://mcp.linear.app/mcp', fetch: mcp.fetch, allowedTools: ['search_issues'] })] });
        expect((await clash.resolveTools()).map((t) => t.name)).toEqual(['search_issues', 'linear_search_issues']);
        void own;
    });

    it('runs an MCP tool in a real run and sends its text back', async () => {
        const mcp = fakeMcp();
        const server = new MCPServerStreamableHttp({ url: 'https://mcp.linear.app/mcp', fetch: mcp.fetch, allowedTools: ['search_issues'] });
        const agent = new Agent({ name: 'Ops', model: 'gpt-4o', mcpServers: [server] });
        const sse = (events: Array<[string, Record<string, unknown>]>) => new Response(events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream', 'X-Cencori-Session-Id': 'ses_1' } });
        const requests: any[] = [];
        const cencori = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
            requests.push(JSON.parse(String(init!.body)));
            return requests.length === 1
                ? sse([['turn.paused', { reason: 'tool_results_required', action_id: 'c1', actions: [{ action_id: 'c1', tool: 'search_issues', arguments: '{"q":"login"}' }] }]])
                : sse([['output_text.delta', { delta: 'Found it.' }], ['turn.completed', { output: {}, usage: {} }]]);
        }) as unknown as typeof fetch;
        const result = await run(agent, 'Any login bugs?', { apiKey: 'csk_t', baseUrl: 'https://cencori.test', fetch: cencori });
        expect(result.finalOutput).toBe('Found it.');
        expect(requests[0].turn.tools.map((t: any) => t.function.name)).toEqual(['search_issues']);
        expect(requests[1].tool_results).toEqual([{ action_id: 'c1', output: 'search_issues:{"q":"login"}' }]);
    });
});

describe('MCPServerStdio', () => {
    it('starts a local server, lists and calls its tools', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'mcp-'));
        const script = join(dir, 'server.mjs');
        writeFileSync(script, `
import { createInterface } from 'node:readline';
const send = (m) => process.stdout.write(JSON.stringify(m) + '\\n');
createInterface({ input: process.stdin }).on('line', (line) => {
  const m = JSON.parse(line);
  if (!('id' in m)) return;
  if (m.method === 'initialize') send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: '2025-11-25', capabilities: {} } });
  else if (m.method === 'tools/list') send({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'echo', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } }] } });
  else if (m.method === 'tools/call') send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'echo: ' + m.params.arguments.text }] } });
});
`);
        const server = new MCPServerStdio({ command: process.execPath, args: [script], name: 'echo' });
        try {
            expect((await server.listTools()).map((t) => t.name)).toEqual(['echo']);
            expect((await server.callTool('echo', { text: 'hi' })).content?.[0].text).toBe('echo: hi');
        } finally {
            await server.close();
        }
    });
});
