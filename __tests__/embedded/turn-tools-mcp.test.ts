import { describe, expect, it } from 'vitest';
import {
    installedTurnTools,
    mcpHostedToolName,
    mcpManifestTools,
    parseMcpHostedToolName,
} from '@/lib/embedded/turn-tools';
import type { CapabilityManifest } from '@/lib/embedded/manifest';
import type { DiscoveredTool } from '@/lib/embedded/mcp';

const baseManifest = (overrides: Partial<CapabilityManifest> = {}): CapabilityManifest => ({
    model: 'gpt-4o',
    skills: [],
    tools: [],
    connection_requirements: [],
    mcp_tools: [],
    subagents: [],
    policy: { browser: { enabled: false }, network: { mode: 'none', allowed_hosts: [] }, max_delegation_depth: 0, require_approval: [] },
    ...overrides,
});

const snapshot = new Map<string, DiscoveredTool[]>([
    [
        'srv-1',
        [
            { name: 'search', description: 'Search docs', inputSchema: { type: 'object', properties: { q: { type: 'string' } } }, annotations: { readOnlyHint: true } },
            { name: 'deleteIndex', description: 'Drop it', inputSchema: { type: 'object' }, annotations: { destructiveHint: true } },
        ],
    ],
]);

describe('mcp hosted tool names', () => {
    it('namespaces deterministically within provider limits', () => {
        const name = mcpHostedToolName('mcp_6c8b4af4-dcf3-4bd3-8629-179b4a0bf824', 'search_docs!');
        expect(name).toMatch(/^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/);
        expect(name.length).toBeLessThanOrEqual(64);
        expect(parseMcpHostedToolName(name)).toEqual({ serverShort: '6c8b4af4', tool: 'search_docs_' });
    });

    it('rejects non-hosted names', () => {
        expect(parseMcpHostedToolName('search')).toBeNull();
        expect(parseMcpHostedToolName('mcp.search')).toBeNull();
    });
});

describe('mcpManifestTools', () => {
    it('converts snapshot grants to function tools with approval flags', () => {
        const tools = mcpManifestTools(
            [
                { server_id: 'mcp_srv-1', tool: 'search' },
                { server_id: 'srv-1', tool: 'deleteIndex' },
                { server_id: 'srv-1', tool: 'ghost' },
                { server_id: 'mcp_missing', tool: 'search' },
            ],
            snapshot,
        );
        expect(tools.map((t) => (t as { function: { name: string } }).function.name).sort()).toEqual(
            ['mcp__srv1__deleteIndex', 'mcp__srv1__search'].sort(),
        );
        const byName = Object.fromEntries(tools.map((t) => [(t as { function: { name: string } }).function.name, t]));
        expect((byName['mcp__srv1__search'] as { needsApproval?: boolean }).needsApproval).toBeUndefined();
        expect((byName['mcp__srv1__deleteIndex'] as { needsApproval?: boolean }).needsApproval).toBe(true);
        const search = byName['mcp__srv1__search'] as { function: { parameters: unknown } };
        expect(search.function.parameters).toEqual({ type: 'object', properties: { q: { type: 'string' } } });
    });

    it('falls back to an empty schema when snapshots lack one', () => {
        const tools = mcpManifestTools([{ server_id: 'srv-1', tool: 'search' }], new Map([['srv-1', [{ name: 'search' }]]]));
        expect((tools[0] as { function: { parameters: unknown } }).function.parameters).toEqual({ type: 'object', properties: {} });
    });
});

describe('installedTurnTools with MCP', () => {
    it('keeps declared tools and adds snapshot MCP grants', () => {
        const tools = installedTurnTools(
            baseManifest({
                tools: [{ type: 'function', name: 'local', parameters: { type: 'object' } }],
                mcp_tools: [{ server_id: 'srv-1', tool: 'search' }],
            }),
            { mode: 'none', allowed_hosts: [] },
            false,
            snapshot,
        );
        const names = tools.filter((t) => t.type === 'function').map((t) => (t as { function: { name: string } }).function.name);
        expect(names).toContain('local');
        expect(names).toContain('mcp__srv1__search');
    });
});
