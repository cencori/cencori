import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PlatformClient } from '../client.js';
import { jsonResult, READ_ONLY_ANNOTATIONS } from './shared.js';

/**
 * Embedded Agents inspection tools. Read-only: safe to enable wherever a
 * project key is present. Writes, publishing, credential management, and
 * approvals stay dashboard-guided per the platform contract.
 */
export function registerEmbeddedTools(server: McpServer, client: PlatformClient): void {
    server.registerTool(
        'list_tenants',
        {
            title: 'List embedded tenants',
            description: 'List downstream tenant companies in the project.',
            inputSchema: {
                limit: z.number().int().positive().max(100).optional(),
                status: z.string().optional().describe('Filter by tenant status.'),
            },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ limit, status }) =>
            jsonResult(await client.get('/v1/tenants', { limit: limit?.toString(), status })),
    );

    server.registerTool(
        'get_tenant',
        {
            title: 'Get an embedded tenant',
            description: 'Fetch one tenant by id or external id.',
            inputSchema: { tenant_id: z.string().min(1).describe('The tenant id.') },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ tenant_id }) => jsonResult(await client.get(`/v1/tenants/${tenant_id}`)),
    );

    server.registerTool(
        'list_agent_versions',
        {
            title: 'List agent versions',
            description: 'List versions of an agent, optionally filtered by lifecycle status.',
            inputSchema: {
                agent_id: z.string().min(1).describe('The agent id.'),
                status: z.string().optional().describe('Filter by version status.'),
            },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ agent_id, status }) => jsonResult(await client.get(`/v1/agents/${agent_id}/versions`, { status })),
    );

    server.registerTool(
        'list_installations',
        {
            title: 'List agent installations',
            description: 'List tenant-scoped agent installations, optionally for one tenant.',
            inputSchema: { tenant_id: z.string().optional().describe('Filter by tenant id.') },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ tenant_id }) => jsonResult(await client.get('/v1/agent-installations', { tenant_id })),
    );

    server.registerTool(
        'get_run',
        {
            title: 'Get a background run',
            description: 'Fetch a run with its status and structured output.',
            inputSchema: { run_id: z.string().min(1).describe('The run id.') },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ run_id }) => jsonResult(await client.get(`/v1/runs/${run_id}`)),
    );

    server.registerTool(
        'get_run_events',
        {
            title: 'Get run events',
            description: 'List the durable event log for a run.',
            inputSchema: {
                run_id: z.string().min(1).describe('The run id.'),
                limit: z.number().int().positive().max(100).optional(),
            },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ run_id, limit }) => jsonResult(await client.get(`/v1/runs/${run_id}/events`, { limit: limit?.toString() })),
    );

    server.registerTool(
        'get_action',
        {
            title: 'Get an approval action',
            description: 'Fetch an action with sanitized arguments (secrets never stored).',
            inputSchema: { action_id: z.string().min(1).describe('The action id.') },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ action_id }) => jsonResult(await client.get(`/v1/actions/${action_id}`)),
    );

    server.registerTool(
        'list_knowledge_bases',
        {
            title: 'List knowledge bases',
            description: 'List knowledge bases, optionally for one tenant.',
            inputSchema: { tenant_id: z.string().optional().describe('Filter by tenant id.') },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ tenant_id }) => jsonResult(await client.get('/v1/knowledge-bases', { tenant_id })),
    );

    server.registerTool(
        'search_knowledge_base',
        {
            title: 'Search a knowledge base',
            description: 'Grant-filtered vector search returning chunk citations.',
            inputSchema: {
                knowledge_base_id: z.string().min(1).describe('The knowledge base id.'),
                query: z.string().min(1).describe('The search query.'),
                top_k: z.number().int().positive().max(20).optional(),
            },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ knowledge_base_id, query, top_k }) =>
            jsonResult(await client.post(`/v1/knowledge-bases/${knowledge_base_id}/search`, { query, top_k })),
    );

    server.registerTool(
        'list_skills',
        {
            title: 'List skills',
            description: 'List organization skill definitions.',
            inputSchema: { visibility: z.string().optional().describe('Filter by visibility.') },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ visibility }) => jsonResult(await client.get('/v1/skills', { visibility })),
    );

    server.registerTool(
        'list_provider_connections',
        {
            title: 'List provider connections',
            description: 'List inference provider connections (key hints only, never secrets).',
            inputSchema: {},
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async () => jsonResult(await client.get('/v1/provider-connections')),
    );

    server.registerTool(
        'get_usage',
        {
            title: 'Get attributed usage',
            description: 'Usage summary grouped by tenant, agent, and installation.',
            inputSchema: {
                days: z.number().int().positive().max(90).optional(),
                tenant_id: z.string().optional().describe('Filter by tenant id.'),
                agent_id: z.string().optional().describe('Filter by agent id.'),
            },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ days, tenant_id, agent_id }) =>
            jsonResult(
                await client.get('/v1/usage', {
                    days: days?.toString(),
                    tenant_id,
                    agent_id,
                }),
            ),
    );

    server.registerTool(
        'list_webhooks',
        {
            title: 'List webhook subscriptions',
            description: 'List event subscriptions with delivery health.',
            inputSchema: {},
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async () => jsonResult(await client.get('/v1/webhooks')),
    );

    server.registerTool(
        'list_webhook_deliveries',
        {
            title: 'List webhook deliveries',
            description: 'Inspect the delivery log for debugging and replay.',
            inputSchema: {},
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async () => jsonResult(await client.get('/v1/webhook-deliveries')),
    );

    server.registerTool(
        'list_mcp_servers',
        {
            title: 'List remote MCP servers',
            description: 'List registered remote MCP servers with discovery snapshots.',
            inputSchema: { tenant_id: z.string().optional().describe('Filter by tenant id.') },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ tenant_id }) => jsonResult(await client.get('/v1/mcp/servers', { tenant_id })),
    );

    server.registerTool(
        'list_mcp_server_tools',
        {
            title: 'List MCP server tools',
            description: 'Read the stored tool snapshot for a remote MCP server.',
            inputSchema: { server_id: z.string().min(1).describe('The MCP server id.') },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ server_id }) => jsonResult(await client.get(`/v1/mcp/servers/${server_id}/tools`)),
    );
}
