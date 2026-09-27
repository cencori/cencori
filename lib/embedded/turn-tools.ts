import type { ResponsesTool } from '@/lib/gateway/v1-responses-execute';
import type { CapabilityManifest } from './manifest';
import type { NetworkPolicy } from './net-policy';
import { dePrefixId } from './http';
import { classifyTool } from './tool-risk';
import type { DiscoveredTool } from './mcp';

/**
 * Deterministic hosted name for a manifest MCP tool grant. The model only
 * ever sees this name; the server id prefix routes execution back to the
 * granting server (see actions approve dispatch). Sanitized to provider
 * function-name limits.
 */
export function mcpHostedToolName(serverId: string, tool: string): string {
    const short = dePrefixId(serverId).replace(/-/g, '').slice(0, 8);
    const clean = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'tool';
    return `mcp__${clean(short)}__${clean(tool)}`.slice(0, 64);
}

/** Parse a hosted name back to its server discriminator + tool. */
export function parseMcpHostedToolName(name: string): { serverShort: string; tool: string } | null {
    const m = /^mcp__([A-Za-z0-9_-]{1,40})__([A-Za-z0-9_-]{1,40})$/.exec(name);
    if (!m) return null;
    return { serverShort: m[1], tool: m[2] };
}

export interface McpToolRef {
    server_id: string;
    tool: string;
}

/**
 * Manifest MCP grants → namespaced function tools from discovery snapshots.
 * Grants without snapshot data stay invisible rather than hallucinating
 * schemas. Shared by installed turns and direct runs.
 */
export function mcpManifestTools(
    refs: McpToolRef[],
    snapshots: Map<string, DiscoveredTool[]> | null | undefined,
): ResponsesTool[] {
    const tools: ResponsesTool[] = [];
    if (!snapshots) return tools;
    const seen = new Set<string>();
    for (const ref of refs ?? []) {
        const snapshot = snapshots.get(dePrefixId(ref.server_id).toLowerCase())
            ?? snapshots.get(dePrefixId(ref.server_id));
        const discovered = snapshot?.find((t) => t.name === ref.tool);
        if (!discovered) continue;
        const name = mcpHostedToolName(ref.server_id, ref.tool);
        if (seen.has(name)) continue;
        const parameters = discovered.inputSchema && typeof discovered.inputSchema === 'object' && !Array.isArray(discovered.inputSchema)
            ? (discovered.inputSchema as Record<string, unknown>)
            : { type: 'object', properties: {} };
        const approval = classifyTool(ref.tool, {
            readOnlyHint: discovered.annotations?.readOnlyHint,
            destructiveHint: discovered.annotations?.destructiveHint,
            idempotentHint: discovered.annotations?.idempotentHint,
            openWorldHint: discovered.annotations?.openWorldHint,
        }).approval;
        tools.push({
            type: 'function',
            function: {
                name,
                description: typeof discovered.description === 'string' && discovered.description
                    ? discovered.description.slice(0, 500)
                    : `MCP tool ${ref.tool}`,
                parameters,
            },
            ...(approval !== 'auto' ? { needsApproval: true } : {}),
        } as ResponsesTool);
        seen.add(name);
    }
    return tools;
}

/**
 * Only published declarations become executable tools on installed turns.
 * Browser-gated builtins require both the manifest grant and an effective
 * network allowlist; function tools require an object-shaped parameters
 * schema (matching manifest validation — truthy non-objects are dropped).
 * Manifest MCP grants become namespaced function tools from their discovery
 * snapshots (approval per tool-risk classification).
 */
export function installedTurnTools(
    manifest: CapabilityManifest,
    network: NetworkPolicy,
    browserEnabled?: boolean,
    mcpSnapshots?: Map<string, DiscoveredTool[]> | null,
): ResponsesTool[] {
    const tools: ResponsesTool[] = [];
    const seen = new Set<string>();
    const browser = browserEnabled ?? manifest.policy.browser.enabled;
    for (const declaration of manifest.tools) {
        if (declaration.type === 'builtin' && ['web_search', 'web_search_preview'].includes(declaration.name)) {
            if (!browser || network.mode !== 'allowlist' || network.allowed_hosts.length === 0) continue;
            if (!seen.has('web_search_preview')) {
                tools.push({ type: 'web_search_preview' });
                seen.add('web_search_preview');
            }
        } else if (declaration.type === 'function' && !seen.has(`function:${declaration.name}`)) {
            const parameters: unknown = declaration.parameters;
            if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) continue;
            tools.push({
                type: 'function',
                function: {
                    name: declaration.name,
                    description: typeof declaration.description === 'string' ? declaration.description : '',
                    parameters: parameters as Record<string, unknown>,
                },
            });
            seen.add(`function:${declaration.name}`);
        }
    }
    // Manifest MCP grants: visible if the granting server has a snapshot
    // (loaded by the caller — converters stay pure). Grants without snapshot
    // data stay invisible rather than hallucinating schemas.
    for (const tool of mcpManifestTools(manifest.mcp_tools ?? [], mcpSnapshots)) {
        const name = (tool as { function: { name: string } }).function.name;
        if (seen.has(`function:${name}`)) continue;
        tools.push(tool);
        seen.add(`function:${name}`);
    }
    return tools;
}
