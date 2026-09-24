import type { CencoriConfig } from '../types';

export interface EmbeddedRequestOptions { signal?: AbortSignal }

export class CencoriEmbeddedApiError extends Error {
    readonly name = 'CencoriEmbeddedApiError';

    constructor(
        message: string,
        readonly status: number,
        readonly code: string | null,
        readonly requestId: string | null,
        readonly type: string | null,
        readonly param: string | null,
        readonly retryAfterSeconds: number | null = null,
    ) {
        super(`Cencori API error: ${message}`);
    }
}

const HTTP_DATE_PATTERNS = [
    // IMF-fixdate, e.g. Sun, 06 Nov 1994 08:49:37 GMT (what toUTCString emits)
    /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/,
    // RFC 850, e.g. Sunday, 06-Nov-94 08:49:37 GMT
    /^[A-Za-z]+, \d{2}-[A-Za-z]{3}-\d{2} \d{2}:\d{2}:\d{2} GMT$/,
    // asctime, e.g. Sun Nov  6 08:49:37 1994
    /^[A-Za-z]{3} [A-Za-z]{3} ( \d|\d{2}) \d{2}:\d{2}:\d{2} \d{4}$/,
];

export function parseRetryAfterSeconds(value: string | null | undefined, nowMs: number = Date.now()): number | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Strict delay-seconds per RFC 9110 §10.2.3: non-negative integer only.
    // parseInt would accept "60garbage" or "0x3C" — reject those explicitly.
    // Date.parse is also too lenient ("2.5" parses as a 2001 date), so
    // HTTP-dates are allow-listed by format before parsing.
    if (/^[0-9]+$/.test(trimmed)) {
        const seconds = Number.parseInt(trimmed, 10);
        return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
    }
    if (!HTTP_DATE_PATTERNS.some((pattern) => pattern.test(trimmed))) return null;
    const timestamp = Date.parse(trimmed);
    if (!Number.isFinite(timestamp)) return null;
    return Math.max(0, Math.ceil((timestamp - nowMs) / 1000));
}

async function request<T>(config: Required<CencoriConfig>, method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>, options?: EmbeddedRequestOptions): Promise<T> {
    const response = await fetch(`${config.baseUrl}${path}`, {
        method,
        signal: options?.signal,
        headers: {
            'CENCORI_API_KEY': config.apiKey,
            'Content-Type': 'application/json',
            ...config.headers,
            ...extraHeaders,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as {
            error?: { message?: string; code?: string; request_id?: string; type?: string; param?: string; retry_after_ms?: unknown; retry_after?: unknown; retry_after_seconds?: unknown } | string;
            code?: unknown; message?: unknown;
            request_id?: unknown; requestId?: unknown;
            type?: unknown; param?: unknown;
            retry_after_ms?: unknown; retry_after?: unknown; retry_after_seconds?: unknown;
        };
        const message =
            typeof errorData.error === 'string'
                ? errorData.error
                : errorData.error?.message
                    ?? (typeof errorData.message === 'string' ? errorData.message : null)
                    ?? response.statusText;
        const details = typeof errorData.error === 'object' ? errorData.error : null;
        const topCode = typeof errorData.code === 'string' ? errorData.code : null;
        const topRequestId =
            typeof errorData.request_id === 'string'
                ? errorData.request_id
                : typeof errorData.requestId === 'string'
                    ? errorData.requestId
                    : null;
        const topType = typeof errorData.type === 'string' ? errorData.type : null;
        const topParam = typeof errorData.param === 'string' ? errorData.param : null;
        // Prefer the standards-compliant Retry-After response header; fall back
        // to versioned body hints (retry_after_ms / retry_after_seconds) so
        // callers can back off precisely without parsing raw responses.
        let retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('Retry-After') ?? response.headers.get('retry-after'));
        if (retryAfterSeconds == null) {
            // Body hints are unit-explicit: *_seconds / retry_after are seconds,
            // *_ms is milliseconds. Never guess by magnitude (e.g. 3600s).
            const secHint =
                details?.retry_after_seconds ??
                (errorData as { retry_after_seconds?: unknown }).retry_after_seconds ??
                details?.retry_after ??
                (errorData as { retry_after?: unknown }).retry_after;
            if (typeof secHint === 'number' && Number.isFinite(secHint) && secHint >= 0) {
                retryAfterSeconds = Math.ceil(secHint);
            } else {
                const msHint = details?.retry_after_ms ?? (errorData as { retry_after_ms?: unknown }).retry_after_ms;
                if (typeof msHint === 'number' && Number.isFinite(msHint) && msHint >= 0) {
                    retryAfterSeconds = Math.ceil(msHint / 1000);
                }
            }
        }
        throw new CencoriEmbeddedApiError(message, response.status, details?.code ?? topCode, details?.request_id ?? topRequestId ?? response.headers.get('X-Request-Id'), details?.type ?? topType, details?.param ?? topParam, retryAfterSeconds);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ── Tenants ──────────────────────────────────────────────

export interface Tenant {
    id: string;
    external_id: string;
    name: string;
    status: string;
    region: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export class TenantsNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    create(params: { external_id: string; name: string; region?: string; metadata?: Record<string, unknown> }, idempotencyKey?: string): Promise<Tenant> {
        return request<Tenant>(this.config, 'POST', '/v1/tenants', params, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined);
    }
    list(params?: { limit?: number; cursor?: string; status?: string }): Promise<{ data: Tenant[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/tenants${qs({ limit: params?.limit, cursor: params?.cursor, status: params?.status })}`);
    }
    get(tenantId: string, options?: EmbeddedRequestOptions): Promise<Tenant> {
        return request(this.config, 'GET', `/v1/tenants/${tenantId}`, undefined, undefined, options);
    }
    update(tenantId: string, params: { name?: string; metadata?: Record<string, unknown>; region?: string | null }): Promise<Tenant> {
        return request(this.config, 'PATCH', `/v1/tenants/${tenantId}`, params);
    }
    remove(tenantId: string): Promise<{ id: string; status: string; deleted?: Record<string, number> }> {
        return request(this.config, 'DELETE', `/v1/tenants/${tenantId}`);
    }
    exportData(tenantId: string): Promise<{ tenant: Tenant; users: unknown[]; exported_at: string }> {
        return request(this.config, 'POST', `/v1/tenants/${tenantId}/export`, {});
    }
    upsertUser(tenantId: string, externalUserId: string, params?: { display_name?: string; roles?: string[]; groups?: string[]; metadata?: Record<string, unknown> }): Promise<unknown> {
        return request(this.config, 'PUT', `/v1/tenants/${tenantId}/users/${externalUserId}`, params ?? {});
    }
    getUser(tenantId: string, externalUserId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/tenants/${tenantId}/users/${externalUserId}`);
    }
    patchUser(tenantId: string, externalUserId: string, params: Record<string, unknown>): Promise<unknown> {
        return request(this.config, 'PATCH', `/v1/tenants/${tenantId}/users/${externalUserId}`, params);
    }
    listUsers(tenantId: string): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/tenants/${tenantId}/users`);
    }
    deleteUser(tenantId: string, externalUserId: string, hard = false): Promise<{ deleted: boolean }> {
        return request(this.config, 'DELETE', `/v1/tenants/${tenantId}/users/${externalUserId}${hard ? '?hard=true' : ''}`);
    }
}

// ── Client tokens ────────────────────────────────────────

export class ClientTokensNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    mint(params: { tenant_id: string; external_user_id: string; installation_ids?: string[]; permissions?: string[]; expires_in?: number; session_id?: string }): Promise<{ token: string; expires_at: string }> {
        return request(this.config, 'POST', '/v1/client-tokens', params);
    }
}

// ── Models (unified registry) ────────────────────────────

export interface UnifiedModel {
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
    name: string;
    type: string;
    types: string[];
    context_window: number;
    provider: string;
    source: 'cencori' | 'byok' | 'custom';
    connection_id: string | null;
    status: string;
    available: boolean;
    unavailable_reason: string | null;
}

export class ModelsNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    list(params?: { provider?: string; type?: string; available?: boolean; source?: string; connection_id?: string }): Promise<{ object: string; data: UnifiedModel[]; providers: unknown[] }> {
        return request(this.config, 'GET', `/v1/models${qs({ provider: params?.provider, type: params?.type, available: params?.available, source: params?.source, connection_id: params?.connection_id })}`);
    }
}

// ── Provider connections ─────────────────────────────────

export class ProviderConnectionsNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    create(params: { name: string; provider: string; api_format?: string; base_url?: string; api_key?: string }, idempotencyKey?: string): Promise<unknown> {
        return request(this.config, 'POST', '/v1/provider-connections', params, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined);
    }
    list(): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', '/v1/provider-connections');
    }
    get(connectionId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/provider-connections/${connectionId}`);
    }
    update(connectionId: string, params: { name?: string; api_key?: string; status?: string; base_url?: string }): Promise<unknown> {
        return request(this.config, 'PATCH', `/v1/provider-connections/${connectionId}`, params);
    }
    remove(connectionId: string): Promise<{ deleted: boolean }> {
        return request(this.config, 'DELETE', `/v1/provider-connections/${connectionId}`);
    }
    validate(params: { provider: string; base_url?: string; api_key?: string; api_format?: string }): Promise<{ valid: boolean }> {
        return request(this.config, 'POST', '/v1/provider-connections/validate', params);
    }
    test(connectionId: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/provider-connections/${connectionId}/test`, {});
    }
    previewSync(connectionId: string): Promise<{ id: string; status: string; counts: Record<string, number> }> {
        return request(this.config, 'POST', `/v1/provider-connections/${connectionId}/model-syncs`, {});
    }
    getSync(connectionId: string, syncId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/provider-connections/${connectionId}/model-syncs/${syncId}`);
    }
    applySync(connectionId: string, syncId: string, idempotencyKey?: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/provider-connections/${connectionId}/model-syncs/${syncId}/apply`, {}, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined);
    }
}

// ── Agent versions + installations ───────────────────────

export class AgentVersionsNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    create(agentId: string, params: { version: string; config?: Record<string, unknown>; requirements?: Record<string, unknown>; visibility?: string }): Promise<unknown> {
        return request(this.config, 'POST', `/v1/agents/${agentId}/versions`, params);
    }
    list(agentId: string, status?: string): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/agents/${agentId}/versions${qs({ status })}`);
    }
    get(agentId: string, version: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/agents/${agentId}/versions/${version}`);
    }
    validate(agentId: string, version: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/agents/${agentId}/versions/${version}/validate`, {});
    }
    submit(agentId: string, version: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/agents/${agentId}/versions/${version}/submit`, {});
    }
    review(agentId: string, version: string, params: { decision: 'approve' | 'reject'; reviewed_by?: string; reason?: string; visibility?: string }): Promise<unknown> {
        return request(this.config, 'POST', `/v1/agents/${agentId}/versions/${version}/review`, params);
    }
    publish(agentId: string, version: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/agents/${agentId}/versions/${version}/publish`, {});
    }
    test(agentId: string, version: string, params?: { input?: string; test_connection_ids?: string[] }, options?: EmbeddedRequestOptions): Promise<unknown> {
        return request(this.config, 'POST', `/v1/agents/${agentId}/versions/${version}/test`, params ?? {}, undefined, options);
    }
    deprecate(agentId: string, version: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/agents/${agentId}/versions/${version}/deprecate`, {});
    }
    retire(agentId: string, version: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/agents/${agentId}/versions/${version}/retire`, {});
    }
    catalog(params?: { visibility?: string; agent_id?: string }): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/agent-catalog${qs({ visibility: params?.visibility, agent_id: params?.agent_id })}`);
    }
}

export class InstallationsNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    create(params: { tenant_id: string; agent_id: string; version?: string; update_channel?: string; knowledge_base_ids?: string[]; connection_ids?: string[]; approval_policy?: Record<string, unknown> }): Promise<unknown> {
        return request(this.config, 'POST', '/v1/agent-installations', params);
    }
    list(tenantId?: string): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/agent-installations${qs({ tenant_id: tenantId })}`);
    }
    get(installationId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/agent-installations/${installationId}`);
    }
    update(installationId: string, params: Record<string, unknown>): Promise<unknown> {
        return request(this.config, 'PATCH', `/v1/agent-installations/${installationId}`, params);
    }
    remove(installationId: string): Promise<unknown> {
        return request(this.config, 'DELETE', `/v1/agent-installations/${installationId}`);
    }
    upgrade(installationId: string, params?: { version?: string }): Promise<unknown> {
        return request(this.config, 'POST', `/v1/agent-installations/${installationId}/upgrade`, params ?? {});
    }
    rollback(installationId: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/agent-installations/${installationId}/rollback`, {});
    }
}

// ── Runs + actions ───────────────────────────────────────

export class RunsNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    create(agentId: string, params: { installation_id?: string; tenant_id?: string; external_user_id?: string; mode?: string; input?: unknown; response_format?: unknown; session_id?: string }, idempotencyKey?: string, options?: EmbeddedRequestOptions): Promise<unknown> {
        return request(this.config, 'POST', `/v1/agents/${agentId}/runs`, params, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined, options);
    }
    get(runId: string, options?: EmbeddedRequestOptions): Promise<unknown> {
        return request(this.config, 'GET', `/v1/runs/${runId}`, undefined, undefined, options);
    }
    events(runId: string, params?: { after?: string; limit?: number }): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/runs/${runId}/events${qs({ after: params?.after, limit: params?.limit })}`);
    }
    cancel(runId: string, options?: EmbeddedRequestOptions): Promise<unknown> {
        return request(this.config, 'POST', `/v1/runs/${runId}/cancel`, {}, undefined, options);
    }
    delegate(runId: string, params: { agent_version_id: string; input?: unknown; installation_id?: string }, idempotencyKey?: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/runs/${runId}/delegate`, params, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined);
    }
}

export class ActionsNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    create(params: { tool: string; arguments?: Record<string, unknown>; run_id?: string; session_id?: string; tenant_id?: string; approval_policy?: Record<string, unknown> }, idempotencyKey?: string): Promise<unknown> {
        return request(this.config, 'POST', '/v1/actions', params, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined);
    }
    get(actionId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/actions/${actionId}`);
    }
    approve(actionId: string, params?: { approved_by?: string }): Promise<unknown> {
        return request(this.config, 'POST', `/v1/actions/${actionId}/approve`, params ?? {});
    }
    reject(actionId: string, params?: { rejected_by?: string; reason?: string }): Promise<unknown> {
        return request(this.config, 'POST', `/v1/actions/${actionId}/reject`, params ?? {});
    }
}

// ── Knowledge ────────────────────────────────────────────

export class KnowledgeNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    createBase(params: { name: string; tenant_id?: string; scope_type?: string; region?: string }): Promise<unknown> {
        return request(this.config, 'POST', '/v1/knowledge-bases', params);
    }
    listBases(tenantId?: string): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/knowledge-bases${qs({ tenant_id: tenantId })}`);
    }
    getBase(kbId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/knowledge-bases/${kbId}`);
    }
    updateBase(kbId: string, params: { name?: string; status?: string; retention_policy?: Record<string, unknown> }): Promise<unknown> {
        return request(this.config, 'PATCH', `/v1/knowledge-bases/${kbId}`, params);
    }
    removeBase(kbId: string): Promise<{ deleted: boolean }> {
        return request(this.config, 'DELETE', `/v1/knowledge-bases/${kbId}`);
    }
    addInlineSource(kbId: string, text: string, metadata?: Record<string, unknown>): Promise<unknown> {
        return request(this.config, 'POST', `/v1/knowledge-bases/${kbId}/sources`, { text, metadata });
    }
    listSources(kbId: string): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/knowledge-bases/${kbId}/sources`);
    }
    getSource(kbId: string, sourceId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/knowledge-bases/${kbId}/sources/${sourceId}`);
    }
    removeSource(kbId: string, sourceId: string): Promise<{ deleted: boolean }> {
        return request(this.config, 'DELETE', `/v1/knowledge-bases/${kbId}/sources/${sourceId}`);
    }
    syncSource(kbId: string, sourceId: string, text?: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/knowledge-bases/${kbId}/sources/${sourceId}/sync`, text ? { text } : {});
    }
    listGrants(kbId: string): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/knowledge-bases/${kbId}/grants`);
    }
    revokeGrant(kbId: string, grantId: string): Promise<{ deleted: boolean }> {
        return request(this.config, 'DELETE', `/v1/knowledge-bases/${kbId}/grants/${grantId}`);
    }
    grant(kbId: string, params: { subject_type: string; subject_id: string; permissions?: string[] }): Promise<unknown> {
        return request(this.config, 'POST', `/v1/knowledge-bases/${kbId}/grants`, params);
    }
    search(kbId: string, params: { query: string; top_k?: number; installation_id?: string }): Promise<{ data: unknown[] }> {
        return request(this.config, 'POST', `/v1/knowledge-bases/${kbId}/search`, params);
    }
}

// ── Skills ───────────────────────────────────────────────

export class SkillsNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    create(params: { name: string; slug?: string; description?: string; visibility?: string; tenant_id?: string }): Promise<unknown> {
        return request(this.config, 'POST', '/v1/skills', params);
    }
    list(params?: { visibility?: string; tenant_id?: string }): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/skills${qs({ visibility: params?.visibility, tenant_id: params?.tenant_id })}`);
    }
    get(skillId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/skills/${skillId}`);
    }
    update(skillId: string, params: { name?: string; description?: string; visibility?: string; status?: string }): Promise<unknown> {
        return request(this.config, 'PATCH', `/v1/skills/${skillId}`, params);
    }
    createVersion(skillId: string, params: { version: string; content?: string; files?: Array<{ path?: string; content?: string }> }): Promise<unknown> {
        return request(this.config, 'POST', `/v1/skills/${skillId}/versions`, params);
    }
    listVersions(skillId: string): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/skills/${skillId}/versions`);
    }
    getVersion(skillId: string, version: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/skills/${skillId}/versions/${version}`);
    }
    publishVersion(skillId: string, version: string, params?: { reviewed_by?: string }): Promise<unknown> {
        return request(this.config, 'POST', `/v1/skills/${skillId}/versions/${version}/publish`, params ?? {});
    }
    deprecateVersion(skillId: string, version: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/skills/${skillId}/versions/${version}/deprecate`, {});
    }
}

export class SkillImportsNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    stage(params: { url?: string; repository?: string; text?: string; files?: Array<{ path?: string; content?: string }>; tenant_id?: string }): Promise<unknown> {
        return request(this.config, 'POST', '/v1/skill-imports', params);
    }
    get(importId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/skill-imports/${importId}`);
    }
    publish(importId: string, params: { name?: string; skill_id?: string; visibility?: string; version?: string; reviewed_by?: string }): Promise<unknown> {
        return request(this.config, 'POST', `/v1/skill-imports/${importId}/publish`, params);
    }
}

// ── Connections + MCP ────────────────────────────────────

export class ConnectionsNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    listConnectors(): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', '/v1/connectors');
    }
    getConnector(connectorId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/connectors/${connectorId}`);
    }
    create(params: { connector?: string; owner_type?: string; tenant_id?: string; external_user_id?: string; api_key?: string; scopes?: string[] }): Promise<unknown> {
        return request(this.config, 'POST', '/v1/connections', params);
    }
    list(tenantId?: string): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/connections${qs({ tenant_id: tenantId })}`);
    }
    get(connectionId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/connections/${connectionId}`);
    }
    update(connectionId: string, params: { scopes?: string[]; metadata?: Record<string, unknown> }): Promise<unknown> {
        return request(this.config, 'PATCH', `/v1/connections/${connectionId}`, params);
    }
    remove(connectionId: string): Promise<unknown> {
        return request(this.config, 'DELETE', `/v1/connections/${connectionId}`);
    }
    authorize(connectionId: string, params: { redirect_uri?: string; scopes?: string[] }): Promise<{ authorize_url: string; state: string }> {
        return request(this.config, 'POST', `/v1/connections/${connectionId}/authorize`, params);
    }
    test(connectionId: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/connections/${connectionId}/test`, {});
    }
    refresh(connectionId: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/connections/${connectionId}/refresh`, {});
    }
    registerMcpServer(params: { name: string; url: string; transport?: string; tenant_id?: string }): Promise<unknown> {
        return request(this.config, 'POST', '/v1/mcp/servers', params);
    }
    mcpTools(serverId: string): Promise<{ tools: unknown[] }> {
        return request(this.config, 'GET', `/v1/mcp/servers/${serverId}/tools`);
    }
    refreshMcpTools(serverId: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/mcp/servers/${serverId}/refresh-tools`, {});
    }
}

export class McpServersNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    list(tenantId?: string): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/mcp/servers${qs({ tenant_id: tenantId })}`);
    }
    get(serverId: string): Promise<unknown> {
        return request(this.config, 'GET', `/v1/mcp/servers/${serverId}`);
    }
    register(params: { name: string; url: string; transport?: string; tenant_id?: string; auth_connection_id?: string }): Promise<unknown> {
        return request(this.config, 'POST', '/v1/mcp/servers', params);
    }
    update(serverId: string, params: { name?: string; url?: string; status?: string; auth_connection_id?: string | null }): Promise<unknown> {
        return request(this.config, 'PATCH', `/v1/mcp/servers/${serverId}`, params);
    }
    remove(serverId: string): Promise<{ id: string; status: string }> {
        return request(this.config, 'DELETE', `/v1/mcp/servers/${serverId}`);
    }
    test(serverId: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/mcp/servers/${serverId}/test`, {});
    }
    tools(serverId: string): Promise<{ tools: unknown[] }> {
        return request(this.config, 'GET', `/v1/mcp/servers/${serverId}/tools`);
    }
    refreshTools(serverId: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/mcp/servers/${serverId}/refresh-tools`, {});
    }
}

// ── Webhooks + usage + billing admin ───────────────────────

export class WebhooksNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    create(params: { name: string; url: string; events?: string[] }): Promise<unknown> {
        return request(this.config, 'POST', '/v1/webhooks', params);
    }
    update(webhookId: string, params: { name?: string; url?: string; events?: string[]; is_active?: boolean }): Promise<unknown> {
        return request(this.config, 'PATCH', `/v1/webhooks/${webhookId}`, params);
    }
    list(): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', '/v1/webhooks');
    }
    remove(webhookId: string): Promise<{ deleted: boolean }> {
        return request(this.config, 'DELETE', `/v1/webhooks/${webhookId}`);
    }
    deliveries(): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', '/v1/webhook-deliveries');
    }
    replay(deliveryId: string): Promise<unknown> {
        return request(this.config, 'POST', `/v1/webhook-deliveries/${deliveryId}/replay`, {});
    }
}

export class UsageNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    summary(params?: { days?: number; tenant_id?: string; agent_id?: string }): Promise<{ totals: unknown; groups: unknown[] }> {
        return request(this.config, 'GET', `/v1/usage${qs({ days: params?.days, tenant_id: params?.tenant_id, agent_id: params?.agent_id })}`);
    }
    events(params?: { days?: number; tenant_id?: string; agent_id?: string; limit?: number; cursor?: string }): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/usage/events${qs({ days: params?.days, tenant_id: params?.tenant_id, agent_id: params?.agent_id, limit: params?.limit, cursor: params?.cursor })}`);
    }
    async exportCsv(params?: { days?: number; tenant_id?: string; agent_id?: string }): Promise<string> {
        // CSV is text, not JSON — fetch directly instead of the JSON helper.
        const search = new URLSearchParams({ format: 'csv' });
        if (params?.days !== undefined) search.set('days', String(params.days));
        if (params?.tenant_id) search.set('tenant_id', params.tenant_id);
        if (params?.agent_id) search.set('agent_id', params.agent_id);
        const response = await fetch(`${this.config.baseUrl}/v1/usage/export?${search.toString()}`, {
            headers: { 'CENCORI_API_KEY': this.config.apiKey, ...this.config.headers },
        });
        if (!response.ok) {
            throw new Error(`Cencori API error: ${response.statusText}`);
        }
        return response.text();
    }
}

export class EndUsersNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    list(limit?: number): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', `/v1/end-users${qs({ limit })}`);
    }
    upsert(params: { external_id: string; display_name?: string; email?: string; rate_plan_id?: string | null; is_blocked?: boolean; metadata?: Record<string, unknown> }): Promise<unknown> {
        return request(this.config, 'POST', '/v1/end-users', params);
    }
}

export class RatePlansNamespace {
    constructor(private config: Required<CencoriConfig>) {}
    list(): Promise<{ data: unknown[]; next_cursor: string | null }> {
        return request(this.config, 'GET', '/v1/rate-plans');
    }
    create(params: { name: string; slug?: string; markup_percentage?: number; flat_rate?: number; currency?: string }): Promise<unknown> {
        return request(this.config, 'POST', '/v1/rate-plans', params);
    }
}
