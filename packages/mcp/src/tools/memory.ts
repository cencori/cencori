import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PlatformClient } from '../client.js';
import type { McpCapabilities } from '../config.js';
import { jsonResult, READ_ONLY_ANNOTATIONS, WRITE_ANNOTATIONS, DESTRUCTIVE_ANNOTATIONS } from './shared.js';

/**
 * Memory tools. Reads are always registered; writes need CENCORI_MCP_WRITE and
 * deletes need CENCORI_MCP_DESTRUCTIVE.
 *
 * Memory is scoped to a session, user, workspace, or org. Scoped tools
 * therefore require `session_id` (session), `user_id` (user, the default),
 * `workspace_id` (workspace), or nothing/`org_id` (org — the server defaults
 * to the authenticated organization). A bare call defaults to user scope and
 * the API rejects it without a user_id.
 */

const scopeShape = {
    namespace: z.string().optional().describe('Memory namespace to scope to.'),
    scope: z.enum(['user', 'session', 'workspace', 'org']).optional().describe('Memory scope. Defaults to "user".'),
    user_id: z.string().optional().describe('End-user id. REQUIRED for user scope (the default).'),
    session_id: z.string().optional().describe('Session id. REQUIRED for session scope.'),
    workspace_id: z.string().optional().describe('Workspace id. REQUIRED for workspace scope.'),
    org_id: z.string().optional().describe('Org id for org scope. Optional — defaults to your organization.'),
};

type ScopeArgs = { scope?: 'user' | 'session' | 'workspace' | 'org'; user_id?: string; session_id?: string; workspace_id?: string; org_id?: string };

/** Returns a clear error message if the required scope key is missing, else null. */
function missingScopeKey({ scope, user_id, session_id, workspace_id }: ScopeArgs): string | null {
    const s = scope ?? 'user';
    if (s === 'session') {
        return session_id || user_id ? null : 'session_id (or user_id) is required for session scope.';
    }
    if (s === 'workspace') {
        return workspace_id ? null : 'workspace_id is required for workspace scope.';
    }
    if (s === 'org') return null;
    return user_id
        ? null
        : 'user_id is required for user scope (the default). Pass user_id, or use scope="session" with session_id.';
}

const scopeErr = (msg: string) => jsonResult({ error: 'missing_scope', message: msg });

export function registerMemoryTools(server: McpServer, client: PlatformClient, caps: McpCapabilities): void {
    server.registerTool(
        'list_memories',
        {
            title: 'List memories',
            description: 'List stored memories for a user or session. Requires user_id (or session_id for session scope).',
            inputSchema: {
                ...scopeShape,
                limit: z.number().int().positive().max(100).optional(),
                cursor: z.string().optional().describe('Pagination cursor from a previous response.'),
            },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ namespace, scope, user_id, session_id, workspace_id, org_id, limit, cursor }) => {
            const err = missingScopeKey({ scope, user_id, session_id, workspace_id });
            if (err) return scopeErr(err);
            return jsonResult(
                await client.get('/v1/memory/list', {
                    namespace,
                    scope,
                    userId: user_id,
                    sessionId: session_id,
                    workspaceId: workspace_id,
                    orgId: org_id,
                    limit: limit?.toString(),
                    cursor,
                }),
            );
        },
    );

    server.registerTool(
        'search_memory',
        {
            title: 'Search memory (semantic)',
            description: 'Semantically search a user’s or session’s memories. Requires user_id (or session_id for session scope).',
            inputSchema: {
                query: z.string().min(1).describe('Natural-language search query.'),
                ...scopeShape,
                top_k: z.number().int().positive().max(100).optional().describe('Max results.'),
                threshold: z.number().min(0).max(1).optional().describe('Similarity threshold.'),
            },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ query, namespace, scope, user_id, session_id, workspace_id, org_id, top_k, threshold }) => {
            const err = missingScopeKey({ scope, user_id, session_id, workspace_id });
            if (err) return scopeErr(err);
            return jsonResult(
                await client.post('/v1/memory/search', {
                    query,
                    namespace,
                    scope,
                    userId: user_id,
                    sessionId: session_id,
                    workspaceId: workspace_id,
                    orgId: org_id,
                    topK: top_k,
                    threshold,
                }),
            );
        },
    );

    server.registerTool(
        'get_memory',
        {
            title: 'Get a memory',
            description: 'Fetch a single memory by id.',
            inputSchema: { memory_id: z.string().min(1).describe('The memory id.') },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ memory_id }) => jsonResult(await client.get(`/v1/memory/${memory_id}`)),
    );

    server.registerTool(
        'list_memory_entities',
        {
            title: 'List memory entities',
            description: 'List entities resolved from a user’s or session’s memory graph. Requires user_id (or session_id).',
            inputSchema: scopeShape,
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ namespace, scope, user_id, session_id, workspace_id, org_id }) => {
            const err = missingScopeKey({ scope, user_id, session_id, workspace_id });
            if (err) return scopeErr(err);
            return jsonResult(
                await client.get('/v1/memory/entities', { namespace, scope, userId: user_id, sessionId: session_id, workspaceId: workspace_id, orgId: org_id }),
            );
        },
    );

    server.registerTool(
        'get_memory_graph',
        {
            title: 'Get memory entity graph',
            description: 'Traverse a user’s or session’s memory entity graph. Requires user_id (or session_id).',
            inputSchema: {
                ...scopeShape,
                entity: z.string().optional().describe('Entity to start traversal from.'),
                hops: z.number().int().positive().max(5).optional().describe('Traversal depth.'),
            },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ namespace, scope, user_id, session_id, workspace_id, org_id, entity, hops }) => {
            const err = missingScopeKey({ scope, user_id, session_id, workspace_id });
            if (err) return scopeErr(err);
            return jsonResult(
                await client.get('/v1/memory/graph', {
                    namespace,
                    scope,
                    userId: user_id,
                    sessionId: session_id,
                    workspaceId: workspace_id,
                    orgId: org_id,
                    entity,
                    hops: hops?.toString(),
                }),
            );
        },
    );

    server.registerTool(
        'get_forget_suggestions',
        {
            title: 'Get forget suggestions',
            description: 'List memories the system suggests forgetting for a user or session. Requires user_id (or session_id).',
            inputSchema: scopeShape,
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ namespace, scope, user_id, session_id, workspace_id, org_id }) => {
            const err = missingScopeKey({ scope, user_id, session_id, workspace_id });
            if (err) return scopeErr(err);
            return jsonResult(
                await client.get('/v1/memory/forget-suggestions', {
                    namespace,
                    scope,
                    userId: user_id,
                    sessionId: session_id,
                    workspaceId: workspace_id,
                    orgId: org_id,
                }),
            );
        },
    );

    server.registerTool(
        'export_memories',
        {
            title: 'Export memories',
            description: 'Export a portable dump of everything stored about a scope key (GDPR export). Workspace scope needs workspace_id; org scope defaults to your organization.',
            inputSchema: {
                ...scopeShape,
                limit: z.number().int().positive().max(1000).optional(),
                cursor: z.string().optional().describe('Pagination cursor (created_at) from a previous response.'),
            },
            annotations: READ_ONLY_ANNOTATIONS,
        },
        async ({ namespace, scope, user_id, session_id, workspace_id, org_id, limit, cursor }) => {
            const err = missingScopeKey({ scope, user_id, session_id, workspace_id });
            if (err) return scopeErr(err);
            return jsonResult(
                await client.post('/v1/memory/export', {
                    namespace,
                    scope,
                    userId: user_id,
                    sessionId: session_id,
                    workspaceId: workspace_id,
                    orgId: org_id,
                    limit,
                    cursor,
                }),
            );
        },
    );

    if (caps.write) {
        server.registerTool(
            'remember_memory',
            {
                title: 'Remember a conversation turn',
                description:
                    'Store a user/assistant exchange as memory. Requires user_id (or session_id for session scope).',
                inputSchema: {
                    user: z.string().min(1).describe('The user message.'),
                    assistant: z.string().min(1).describe('The assistant response.'),
                    ...scopeShape,
                },
                annotations: WRITE_ANNOTATIONS,
            },
            async ({ user, assistant, namespace, scope, user_id, session_id, workspace_id, org_id }) => {
                const err = missingScopeKey({ scope, user_id, session_id, workspace_id });
                if (err) return scopeErr(err);
                return jsonResult(
                    await client.post('/v1/memory/remember', {
                        user,
                        assistant,
                        namespace,
                        scope,
                        userId: user_id,
                        sessionId: session_id,
                        workspaceId: workspace_id,
                        orgId: org_id,
                    }),
                );
            },
        );

        server.registerTool(
            'write_memory',
            {
                title: 'Write a memory',
                description: 'Store a single memory (a fact/note). Requires user_id (or session_id for session scope).',
                inputSchema: {
                    content: z.string().min(1).describe('The memory content to store.'),
                    importance: z.number().min(0).max(1).optional().describe('Importance weight 0–1.'),
                    ...scopeShape,
                },
                annotations: WRITE_ANNOTATIONS,
            },
            async ({ content, importance, namespace, scope, user_id, session_id, workspace_id, org_id }) => {
                const err = missingScopeKey({ scope, user_id, session_id, workspace_id });
                if (err) return scopeErr(err);
                return jsonResult(
                    await client.post('/v1/memory/write', {
                        content,
                        importance,
                        namespace,
                        scope,
                        userId: user_id,
                        sessionId: session_id,
                        workspaceId: workspace_id,
                        orgId: org_id,
                    }),
                );
            },
        );

        server.registerTool(
            'create_namespace',
            {
                title: 'Create a memory namespace',
                description: 'Create a new memory namespace.',
                inputSchema: {
                    name: z.string().min(1).describe('Namespace name.'),
                    description: z.string().optional(),
                    embedding_model: z.string().optional().describe('Embedding model for this namespace.'),
                    dimensions: z.number().int().positive().optional(),
                },
                annotations: WRITE_ANNOTATIONS,
            },
            async ({ name, description, embedding_model, dimensions }) =>
                jsonResult(
                    await client.post('/memory/namespaces', {
                        name,
                        description,
                        embeddingModel: embedding_model,
                        dimensions,
                    }),
                ),
        );
    }

    if (caps.destructive) {
        server.registerTool(
            'delete_memory',
            {
                title: 'Delete a memory',
                description: 'Permanently delete a memory by id. This cannot be undone.',
                inputSchema: { memory_id: z.string().min(1).describe('The memory id to delete.') },
                annotations: DESTRUCTIVE_ANNOTATIONS,
            },
            async ({ memory_id }) => jsonResult(await client.del(`/v1/memory/${memory_id}`)),
        );

        server.registerTool(
            'forget_memories',
            {
                title: 'Forget memories by filter',
                description:
                    'Permanently delete memories by filter (namespace / before / ids) within a scope. This cannot be undone. At most 1000 rows per call.',
                inputSchema: {
                    ...scopeShape,
                    before: z.string().optional().describe('Forget memories created before this ISO-8601 instant.'),
                    memory_ids: z.array(z.string()).max(1000).optional().describe('Forget only these memory ids.'),
                },
                annotations: DESTRUCTIVE_ANNOTATIONS,
            },
            async ({ namespace, scope, user_id, session_id, workspace_id, org_id, before, memory_ids }) => {
                const err = missingScopeKey({ scope, user_id, session_id, workspace_id });
                if (err) return scopeErr(err);
                return jsonResult(
                    await client.post('/v1/memory/forget', {
                        namespace,
                        scope,
                        userId: user_id,
                        sessionId: session_id,
                        workspaceId: workspace_id,
                        orgId: org_id,
                        before,
                        ids: memory_ids,
                    }),
                );
            },
        );
    }
}
