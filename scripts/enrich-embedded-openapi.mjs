import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'openapi/embedded-agents.json');
const spec = JSON.parse(readFileSync(file, 'utf8'));

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const string = (extra = {}) => ({ type: 'string', ...extra });
const nullableString = (extra = {}) => ({ type: 'string', nullable: true, ...extra });
const integer = (extra = {}) => ({ type: 'integer', ...extra });
const number = (extra = {}) => ({ type: 'number', ...extra });
const boolean = (extra = {}) => ({ type: 'boolean', ...extra });
const array = (items, extra = {}) => ({ type: 'array', items, ...extra });
const object = (properties = {}, required = [], extra = {}) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  ...extra,
});
const record = (extra = {}) => object({}, [], { additionalProperties: true, ...extra });
const cursorList = (item) => object({
  data: array(item),
  next_cursor: nullableString(),
}, ['data', 'next_cursor']);

spec.info.version = '1.1.0';
spec.info.description = 'The typed public contract for Cencori Embedded Agents: models, providers, tenants, versioned agents, installations, sessions, runs, knowledge, tools, approvals, webhooks, and attributed usage.';
spec.info.license = {
  name: 'Apache 2.0',
  url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
};
spec.externalDocs = {
  description: 'Embedded Agents documentation',
  url: 'https://cencori.com/docs/embedded-agents/overview',
};

const tagDescriptions = {
  Actions: 'Approval-gated external side effects.',
  Agents: 'Agent identities and the published catalog.',
  'Agent versions': 'Immutable manifests and their validate, test, review, and publish lifecycle.',
  Installations: 'Tenant-scoped runtime bindings for published agents.',
  Models: 'The unified Cencori and BYOK model registry.',
  Providers: 'Project-owned model-provider connections and catalog synchronization.',
  Tenants: 'Customer tenants, users, and short-lived browser tokens.',
  Sessions: 'Durable, scoped interactive agent sessions.',
  Runs: 'Observable background execution and bounded delegation.',
  Knowledge: 'Tenant-aware knowledge bases, sources, grants, and retrieval.',
  Skills: 'Versioned passive instruction packages and reviewed imports.',
  Connections: 'OAuth and API-backed tool connections.',
  MCP: 'Authenticated MCP servers and discovered tool snapshots.',
  Webhooks: 'Signed subscriptions, delivery history, and replay.',
  Usage: 'Attributed usage summaries, events, and invoice exports.',
  Billing: 'End users and rate-plan administration.',
};
spec.tags = Object.entries(tagDescriptions).map(([name, description]) => ({ name, description }));

spec.components.parameters = {
  IdempotencyKey: {
    name: 'Idempotency-Key',
    in: 'header',
    required: false,
    description: 'Caller-generated key used to safely retry this write within the authenticated project.',
    schema: string({ maxLength: 255 }),
  },
  AgentId: { name: 'agentId', in: 'path', required: true, schema: string() },
  Version: { name: 'version', in: 'path', required: true, schema: string() },
  InstallationId: { name: 'installationId', in: 'path', required: true, schema: string() },
  RunId: { name: 'runId', in: 'path', required: true, schema: string() },
  ActionId: { name: 'actionId', in: 'path', required: true, schema: string() },
  ConnectionId: { name: 'connectionId', in: 'path', required: true, schema: string() },
  ConnectorId: { name: 'connectorId', in: 'path', required: true, schema: string() },
  KnowledgeBaseId: { name: 'knowledgeBaseId', in: 'path', required: true, schema: string() },
  SourceId: { name: 'sourceId', in: 'path', required: true, schema: string() },
  GrantId: { name: 'grantId', in: 'path', required: true, schema: string() },
  ServerId: { name: 'serverId', in: 'path', required: true, schema: string() },
  SyncId: { name: 'syncId', in: 'path', required: true, schema: string() },
  SessionId: { name: 'sessionId', in: 'path', required: true, schema: string() },
  SkillId: { name: 'skillId', in: 'path', required: true, schema: string() },
  ImportId: { name: 'importId', in: 'path', required: true, schema: string() },
  TenantId: { name: 'tenantId', in: 'path', required: true, schema: string() },
  ExternalUserId: { name: 'externalUserId', in: 'path', required: true, schema: string() },
  DeliveryId: { name: 'deliveryId', in: 'path', required: true, schema: string() },
  WebhookId: { name: 'webhookId', in: 'path', required: true, schema: string() },
};

spec.components.responses = {
  Error: {
    description: 'The request failed. Inspect error.code for a stable machine-readable reason.',
    content: { 'application/json': { schema: ref('Error') } },
  },
};

spec.components.schemas = {
  Error: object({
    error: object({
      type: string({ example: 'invalid_request_error' }),
      code: string({ example: 'invalid_request' }),
      message: string(),
      request_id: nullableString(),
      param: nullableString(),
    }, ['type', 'code', 'message']),
    status: string({ enum: ['failed'] }),
  }, ['error']),
  DeletedResponse: object({ id: string(), deleted: boolean(), status: string() }),

  Tenant: object({
    id: string({ example: 'ten_abc' }), external_id: string(), name: string(),
    status: string({ enum: ['active', 'suspended', 'deleting', 'deleted'] }),
    region: nullableString(), metadata: record(), created_at: string({ format: 'date-time' }),
    updated_at: string({ format: 'date-time' }),
  }, ['id', 'external_id', 'name', 'status', 'metadata', 'created_at', 'updated_at']),
  TenantList: cursorList(ref('Tenant')),
  TenantUser: object({
    id: string(), tenant_id: string(), external_id: string(), display_name: nullableString(),
    status: string(), roles: array(string()), groups: array(string()), metadata: record(),
    created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }),
  }, ['id', 'tenant_id', 'external_id', 'status', 'roles', 'groups', 'metadata']),
  TenantUserList: cursorList(ref('TenantUser')),
  TenantExport: object({ tenant: ref('Tenant'), users: array(ref('TenantUser')), exported_at: string({ format: 'date-time' }) }, ['tenant', 'users', 'exported_at']),
  ClientToken: object({ token: string({ example: 'ect_...' }), expires_at: string({ format: 'date-time' }) }, ['token', 'expires_at']),

  UnifiedModel: object({
    id: string(), object: string({ enum: ['model'] }), created: integer(), owned_by: string(),
    name: string(), type: string(), types: array(string()), context_window: integer(), provider: string(),
    source: string({ enum: ['cencori', 'byok', 'custom'] }), connection_id: nullableString(),
    status: string(), available: boolean(), unavailable_reason: nullableString(), pricing_status: string(),
  }, ['id', 'object', 'name', 'provider', 'source', 'status', 'available']),
  ModelList: object({ object: string({ enum: ['list'] }), data: array(ref('UnifiedModel')), providers: array(record()) }, ['object', 'data', 'providers']),
  ProviderConnection: object({
    id: string(), name: string(), provider: string(), api_format: string(), base_url: nullableString(),
    status: string(), last_tested_at: nullableString({ format: 'date-time' }), created_at: string({ format: 'date-time' }),
    updated_at: string({ format: 'date-time' }),
  }, ['id', 'name', 'provider', 'status']),
  ProviderConnectionList: cursorList(ref('ProviderConnection')),
  ProviderValidation: object({ valid: boolean(), provider: string(), api_format: string(), message: string(), models_discovered: integer() }, ['valid']),
  ModelSync: object({ id: string(), connection_id: string(), status: string(), counts: record(), changes: array(record()), created_at: string({ format: 'date-time' }) }, ['id', 'connection_id', 'status']),

  AgentConfig: object({ model: nullableString(), system_prompt: nullableString(), tools: array(string()), temperature: number({ nullable: true }) }),
  Agent: object({
    id: string({ example: 'agt_abc' }), name: string(), description: nullableString(), is_active: boolean(),
    shadow_mode: boolean(), config: ref('AgentConfig'), created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }),
  }, ['id', 'name', 'is_active', 'shadow_mode', 'config', 'created_at']),
  AgentList: object({ data: array(ref('Agent')) }, ['data']),
  AgentKey: object({
    id: string(), name: string(), key_prefix: string(), full_key: string({ description: 'Returned only once when the key is created.' }),
    environment: string(), key_type: string(), agent_id: string(), created_at: string({ format: 'date-time' }),
  }, ['id', 'name', 'key_prefix', 'environment', 'key_type', 'agent_id', 'created_at']),
  AgentVersion: object({
    id: string(), agent_id: string(), version: string(), status: string({ enum: ['draft', 'ready_for_review', 'published', 'deprecated', 'retired'] }),
    config: record(), requirements: record(), visibility: string(), validation: record(), test_result: record(),
    created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }), published_at: nullableString({ format: 'date-time' }),
  }, ['id', 'agent_id', 'version', 'status', 'config']),
  AgentVersionList: cursorList(ref('AgentVersion')),
  AgentVersionValidation: object({ valid: boolean(), status: string(), errors: array(record()), warnings: array(record()), version: ref('AgentVersion') }, ['valid', 'status']),
  AgentVersionTest: object({ passed: boolean(), status: string(), output: record(), readiness: record(), version: ref('AgentVersion') }, ['passed', 'status']),

  Installation: object({
    id: string({ example: 'ins_abc' }), tenant_id: string(), agent_id: string(), agent_version_id: string(), version: string(),
    status: string(), update_channel: string(), knowledge_base_ids: array(string()), connection_ids: array(string()),
    approval_policy: record(), overlay_config: record(), created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }),
  }, ['id', 'tenant_id', 'agent_id', 'status']),
  InstallationList: cursorList(ref('Installation')),
  Run: object({
    id: string({ example: 'run_abc' }), agent_id: string(), agent_version_id: nullableString(), installation_id: nullableString(),
    tenant_id: nullableString(), external_user_id: nullableString(), session_id: nullableString(), parent_run_id: nullableString(),
    status: string({ enum: ['queued', 'running', 'requires_action', 'completed', 'failed', 'cancelled', 'expired'] }),
    input: record(), output: record({ nullable: true }), error: nullableString(), citations: array(record()),
    created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }),
  }, ['id', 'agent_id', 'status']),
  RunEvent: object({ id: string(), run_id: string(), sequence: integer(), event_type: string(), payload: record(), created_at: string({ format: 'date-time' }) }, ['id', 'run_id', 'sequence', 'event_type', 'payload', 'created_at']),
  RunEventList: cursorList(ref('RunEvent')),
  Action: object({
    id: string({ example: 'act_abc' }), project_id: string(), tenant_id: nullableString(), run_id: nullableString(), session_id: nullableString(),
    tool: string(), arguments: record(), status: string({ enum: ['pending', 'approved', 'rejected', 'executing', 'completed', 'failed', 'expired'] }),
    result: record({ nullable: true }), expires_at: nullableString({ format: 'date-time' }), created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }),
  }, ['id', 'tool', 'arguments', 'status', 'created_at']),

  Connector: object({ id: string(), name: string(), auth_type: string(), scopes: array(string()), capabilities: array(string()), metadata: record() }, ['id', 'name', 'auth_type']),
  ConnectorList: cursorList(ref('Connector')),
  Connection: object({
    id: string(), connector: string(), owner_type: string(), tenant_id: nullableString(), external_user_id: nullableString(),
    scopes: array(string()), status: string(), metadata: record(), expires_at: nullableString({ format: 'date-time' }),
    created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }),
  }, ['id', 'connector', 'owner_type', 'status']),
  ConnectionList: cursorList(ref('Connection')),
  OAuthAuthorization: object({ authorize_url: string({ format: 'uri' }), state: string() }, ['authorize_url', 'state']),
  ConnectionTest: object({ success: boolean(), has_credential: boolean(), expired: boolean(), expires_at: nullableString({ format: 'date-time' }) }, ['success', 'has_credential', 'expired']),

  KnowledgeBase: object({
    id: string(), name: string(), tenant_id: nullableString(), scope_type: string(), region: nullableString(), status: string(),
    retention_policy: record(), source_count: integer(), created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }),
  }, ['id', 'name', 'scope_type', 'status']),
  KnowledgeBaseList: cursorList(ref('KnowledgeBase')),
  KnowledgeSource: object({
    id: string(), knowledge_base_id: string(), source_type: string(), status: string(), metadata: record(), checksum: nullableString(),
    error: nullableString(), created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }),
  }, ['id', 'knowledge_base_id', 'source_type', 'status']),
  KnowledgeSourceList: cursorList(ref('KnowledgeSource')),
  KnowledgeGrant: object({ id: string(), knowledge_base_id: string(), subject_type: string(), subject_id: string(), permissions: array(string()), created_at: string({ format: 'date-time' }) }, ['id', 'knowledge_base_id', 'subject_type', 'subject_id', 'permissions']),
  KnowledgeGrantList: cursorList(ref('KnowledgeGrant')),
  KnowledgeSearchResult: object({ chunk_id: string(), source_id: string(), text: string(), score: number(), metadata: record() }, ['chunk_id', 'source_id', 'text', 'score']),
  KnowledgeSearchResponse: object({ data: array(ref('KnowledgeSearchResult')) }, ['data']),

  Skill: object({ id: string(), name: string(), slug: string(), description: nullableString(), visibility: string(), tenant_id: nullableString(), status: string(), created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }) }, ['id', 'name', 'slug', 'visibility', 'status']),
  SkillList: cursorList(ref('Skill')),
  SkillVersion: object({ id: string(), skill_id: string(), version: string(), status: string(), content: string(), files: array(record()), scan: record(), created_at: string({ format: 'date-time' }), published_at: nullableString({ format: 'date-time' }) }, ['id', 'skill_id', 'version', 'status']),
  SkillVersionList: cursorList(ref('SkillVersion')),
  SkillImport: object({ id: string(), status: string(), source_type: string(), source: record(), files: array(record()), findings: array(record()), created_at: string({ format: 'date-time' }) }, ['id', 'status', 'source_type', 'findings']),

  McpServer: object({ id: string(), name: string(), url: string({ format: 'uri' }), transport: string(), tenant_id: nullableString(), auth_connection_id: nullableString(), status: string(), created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }) }, ['id', 'name', 'url', 'transport', 'status']),
  McpServerList: cursorList(ref('McpServer')),
  McpTool: object({ name: string(), description: nullableString(), input_schema: record(), annotations: record() }, ['name', 'input_schema']),
  McpToolList: object({ tools: array(ref('McpTool')) }, ['tools']),
  McpDiscoveryResult: object({ server: ref('McpServer'), tools: array(ref('McpTool')), added: array(string()), removed: array(string()), changed: array(string()) }, ['server', 'tools']),
  McpTest: object({ id: string(), success: boolean(), transport: string(), tool_count: integer(), latency_ms: number(), error: nullableString() }, ['id', 'success', 'latency_ms']),
  ProviderTest: object({ success: boolean(), reachable: boolean({ nullable: true }), authenticated: boolean(), latency_ms: number(), discovery_supported: boolean(), model_count: integer({ nullable: true }), status: integer(), error: nullableString() }, ['success', 'authenticated', 'latency_ms']),

  EndUser: object({ id: string(), external_id: string(), display_name: nullableString(), email: nullableString(), rate_plan_id: nullableString(), is_blocked: boolean(), metadata: record(), created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }) }, ['id', 'external_id', 'is_blocked', 'metadata']),
  EndUserList: cursorList(ref('EndUser')),
  RatePlan: object({ id: string(), name: string(), slug: string(), markup_percentage: number(), flat_rate: number(), currency: string(), created_at: string({ format: 'date-time' }) }, ['id', 'name', 'slug', 'currency']),
  RatePlanList: cursorList(ref('RatePlan')),

  Session: object({
    id: string(), status: string({ enum: ['active', 'paused', 'completed', 'failed'] }), turn_count: integer(),
    created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }), agent_id: nullableString(),
    tenant_id: nullableString(), external_user_id: nullableString(), installation_id: nullableString(), metadata: record(), total_cost: number(),
  }, ['id', 'status', 'turn_count', 'created_at', 'updated_at', 'agent_id', 'tenant_id', 'external_user_id', 'installation_id', 'metadata', 'total_cost']),
  SessionList: object({ data: array(ref('Session')), pagination: object({ page: integer(), limit: integer(), total: integer(), total_pages: integer() }, ['page', 'limit', 'total', 'total_pages']) }, ['data', 'pagination']),
  SessionEvent: object({ id: string(), session_id: string(), turn_number: integer(), sequence: integer(), event_type: string(), payload: record(), created_at: string({ format: 'date-time' }) }, ['id', 'session_id', 'turn_number', 'sequence', 'event_type', 'payload', 'created_at']),
  SessionEventList: object({ data: array(ref('SessionEvent')), pagination: object({ page: integer(), limit: integer(), total: integer(), total_pages: integer() }, ['page', 'limit', 'total', 'total_pages']) }, ['data', 'pagination']),
  SessionResolution: object({ id: string(), action_id: string(), resolution: string(), status: string() }, ['id', 'action_id', 'resolution', 'status']),

  UsageSummary: object({ totals: record(), groups: array(record()) }, ['totals', 'groups']),
  UsageEvent: object({ id: string(), project_id: string(), tenant_id: nullableString(), external_user_id: nullableString(), agent_id: nullableString(), installation_id: nullableString(), session_id: nullableString(), run_id: nullableString(), model: nullableString(), provider: nullableString(), input_tokens: integer(), output_tokens: integer(), cost_usd: number(), created_at: string({ format: 'date-time' }) }, ['id', 'project_id', 'created_at']),
  UsageEventList: cursorList(ref('UsageEvent')),
  UsageExport: object({ generated_at: string({ format: 'date-time' }), totals: record(), rows: array(ref('UsageEvent')) }, ['generated_at', 'rows']),
  Webhook: object({ id: string(), name: string(), url: string({ format: 'uri' }), events: array(string()), is_active: boolean(), created_at: string({ format: 'date-time' }), updated_at: string({ format: 'date-time' }) }, ['id', 'name', 'url', 'events', 'is_active']),
  WebhookList: cursorList(ref('Webhook')),
  WebhookDelivery: object({ id: string(), webhook_id: string(), event: string(), status: string(), response_status: integer(), attempts: integer(), next_attempt_at: nullableString({ format: 'date-time' }), created_at: string({ format: 'date-time' }) }, ['id', 'webhook_id', 'event', 'status', 'attempts']),
  WebhookDeliveryList: cursorList(ref('WebhookDelivery')),

  CreateTenantRequest: object({ external_id: string(), name: string(), region: string(), metadata: record() }, ['external_id', 'name'], { additionalProperties: false }),
  UpdateTenantRequest: object({ name: string(), region: nullableString(), metadata: record(), status: string() }, [], { additionalProperties: false }),
  UpsertTenantUserRequest: object({ display_name: string(), roles: array(string()), groups: array(string()), metadata: record() }, [], { additionalProperties: false }),
  PatchTenantUserRequest: object({ display_name: string(), roles: array(string()), groups: array(string()), metadata: record(), status: string() }, [], { additionalProperties: false }),
  MintClientTokenRequest: object({ tenant_id: string(), external_user_id: string(), installation_ids: array(string()), permissions: array(string()), expires_in: integer({ minimum: 1, maximum: 900 }), session_id: string() }, ['tenant_id', 'external_user_id'], { additionalProperties: false }),
  CreateProviderConnectionRequest: object({ name: string(), provider: string(), api_format: string(), base_url: string({ format: 'uri' }), api_key: string({ format: 'password', writeOnly: true }) }, ['name', 'provider'], { additionalProperties: false }),
  UpdateProviderConnectionRequest: object({ name: string(), api_key: string({ format: 'password', writeOnly: true }), status: string(), base_url: string({ format: 'uri' }) }, [], { additionalProperties: false }),
  ValidateProviderConnectionRequest: object({ provider: string(), base_url: string({ format: 'uri' }), api_key: string({ format: 'password', writeOnly: true }), api_format: string() }, ['provider'], { additionalProperties: false }),
  CreateAgentRequest: object({ name: string(), description: string(), config: ref('AgentConfig') }, ['name'], { additionalProperties: false }),
  UpdateAgentRequest: object({ name: string(), description: string(), is_active: boolean(), shadow_mode: boolean(), config: ref('AgentConfig') }, [], { additionalProperties: false }),
  CreateAgentKeyRequest: object({ name: string(), environment: string({ enum: ['production', 'test'] }), key_type: string({ enum: ['secret', 'publishable'] }), allowed_domains: array(string()) }, [], { additionalProperties: false }),
  CreateAgentVersionRequest: object({ version: string(), config: record(), requirements: record(), visibility: string() }, ['version'], { additionalProperties: false }),
  ReviewAgentVersionRequest: object({ decision: string({ enum: ['approve', 'reject'] }), reviewed_by: string(), reason: string(), visibility: string() }, ['decision'], { additionalProperties: false }),
  TestAgentVersionRequest: object({ input: string({ maxLength: 2000 }), test_connection_ids: array(string()) }, [], { additionalProperties: false }),
  CreateInstallationRequest: object({ tenant_id: string(), agent_id: string(), version: string(), update_channel: string(), knowledge_base_ids: array(string()), connection_ids: array(string()), approval_policy: record() }, ['tenant_id', 'agent_id'], { additionalProperties: false }),
  UpdateInstallationRequest: object({ version: string(), update_channel: string(), knowledge_base_ids: array(string()), connection_ids: array(string()), approval_policy: record(), overlay_config: record(), status: string() }, [], { additionalProperties: false }),
  UpgradeInstallationRequest: object({ version: string() }, [], { additionalProperties: false }),
  CreateRunRequest: object({ installation_id: string(), tenant_id: string(), external_user_id: string(), mode: string({ enum: ['background', 'sync'] }), input: {}, response_format: record(), session_id: string() }, [], { additionalProperties: false }),
  DelegateRunRequest: object({ agent_version_id: string(), input: {}, installation_id: string() }, ['agent_version_id'], { additionalProperties: false }),
  CreateActionRequest: object({ tool: string(), arguments: record(), run_id: string(), session_id: string(), tenant_id: string(), approval_policy: record() }, ['tool'], { additionalProperties: false }),
  ApproveActionRequest: object({ approved_by: string() }, [], { additionalProperties: false }),
  RejectActionRequest: object({ rejected_by: string(), reason: string() }, [], { additionalProperties: false }),
  CreateKnowledgeBaseRequest: object({ name: string(), tenant_id: string(), scope_type: string(), region: string() }, ['name'], { additionalProperties: false }),
  UpdateKnowledgeBaseRequest: object({ name: string(), status: string(), retention_policy: record() }, [], { additionalProperties: false }),
  CreateKnowledgeSourceRequest: object({ text: string(), metadata: record(), file_url: string({ format: 'uri' }), source_type: string() }, [], { additionalProperties: false }),
  SyncKnowledgeSourceRequest: object({ text: string(), metadata: record() }, [], { additionalProperties: false }),
  CreateKnowledgeGrantRequest: object({ subject_type: string(), subject_id: string(), permissions: array(string()) }, ['subject_type', 'subject_id'], { additionalProperties: false }),
  SearchKnowledgeRequest: object({ query: string(), top_k: integer({ minimum: 1, maximum: 100 }), installation_id: string() }, ['query'], { additionalProperties: false }),
  CreateSkillRequest: object({ name: string(), slug: string(), description: string(), visibility: string(), tenant_id: string() }, ['name'], { additionalProperties: false }),
  UpdateSkillRequest: object({ name: string(), description: string(), visibility: string(), status: string() }, [], { additionalProperties: false }),
  CreateSkillVersionRequest: object({ version: string(), content: string(), files: array(object({ path: string(), content: string() })) }, ['version'], { additionalProperties: false }),
  PublishSkillVersionRequest: object({ reviewed_by: string() }, [], { additionalProperties: false }),
  CreateSkillImportRequest: object({ url: string({ format: 'uri' }), repository: string(), text: string(), files: array(object({ path: string(), content: string() })), tenant_id: string() }, [], { additionalProperties: false, minProperties: 1 }),
  PublishSkillImportRequest: object({ name: string(), skill_id: string(), visibility: string(), version: string(), reviewed_by: string() }, [], { additionalProperties: false }),
  CreateConnectionRequest: object({ connector: string(), owner_type: string(), tenant_id: string(), external_user_id: string(), api_key: string({ format: 'password', writeOnly: true }), scopes: array(string()) }, ['connector'], { additionalProperties: false }),
  UpdateConnectionRequest: object({ scopes: array(string()), metadata: record() }, [], { additionalProperties: false }),
  AuthorizeConnectionRequest: object({ redirect_uri: string({ format: 'uri' }), scopes: array(string()) }, [], { additionalProperties: false }),
  CreateMcpServerRequest: object({ name: string(), url: string({ format: 'uri' }), transport: string(), tenant_id: string(), auth_connection_id: string() }, ['name', 'url'], { additionalProperties: false }),
  UpdateMcpServerRequest: object({ name: string(), url: string({ format: 'uri' }), status: string(), auth_connection_id: nullableString() }, [], { additionalProperties: false }),
  UpsertEndUserRequest: object({ external_id: string(), display_name: string(), email: string({ format: 'email' }), rate_plan_id: nullableString(), is_blocked: boolean(), metadata: record() }, ['external_id'], { additionalProperties: false }),
  CreateRatePlanRequest: object({ name: string(), slug: string(), markup_percentage: number(), flat_rate: number(), currency: string() }, ['name'], { additionalProperties: false }),
  CreateSessionRequest: object({ agent_id: string(), tenant_id: string(), external_user_id: string(), installation_id: string(), metadata: record() }, [], { additionalProperties: false }),
  SessionTurnRequest: object({ input: {}, tools: array(record()), instructions: string(), agent_id: string(), model: string(), temperature: number(), max_output_tokens: integer(), top_p: number(), tool_choice: {}, response_format: record(), store: boolean(), metadata: record(), user: string(), stream: boolean(), parallel_tool_calls: boolean(), truncation: string({ enum: ['auto', 'disabled'] }), pause_on_tool_calls: boolean(), memory: record() }, ['input'], { additionalProperties: false }),
  SessionResolutionRequest: object({ action_id: string(), tool_results: array(object({ action_id: string(), output: string() }, ['action_id', 'output'])) }, ['action_id'], { additionalProperties: false }),
  CreateWebhookRequest: object({ name: string(), url: string({ format: 'uri' }), events: array(string()) }, ['name', 'url'], { additionalProperties: false }),
  UpdateWebhookRequest: object({ name: string(), url: string({ format: 'uri' }), events: array(string()), is_active: boolean() }, [], { additionalProperties: false }),
};

const requestSchemas = {
  'POST /v1/actions': 'CreateActionRequest',
  'POST /v1/actions/{actionId}/approve': 'ApproveActionRequest',
  'POST /v1/actions/{actionId}/reject': 'RejectActionRequest',
  'POST /v1/agent-installations': 'CreateInstallationRequest',
  'PATCH /v1/agent-installations/{installationId}': 'UpdateInstallationRequest',
  'POST /v1/agent-installations/{installationId}/upgrade': 'UpgradeInstallationRequest',
  'POST /v1/agents': 'CreateAgentRequest',
  'PATCH /v1/agents/{agentId}': 'UpdateAgentRequest',
  'POST /v1/agents/{agentId}/keys': 'CreateAgentKeyRequest',
  'POST /v1/agents/{agentId}/runs': 'CreateRunRequest',
  'POST /v1/agents/{agentId}/versions': 'CreateAgentVersionRequest',
  'POST /v1/agents/{agentId}/versions/{version}/review': 'ReviewAgentVersionRequest',
  'POST /v1/agents/{agentId}/versions/{version}/test': 'TestAgentVersionRequest',
  'POST /v1/client-tokens': 'MintClientTokenRequest',
  'POST /v1/connections': 'CreateConnectionRequest',
  'PATCH /v1/connections/{connectionId}': 'UpdateConnectionRequest',
  'POST /v1/connections/{connectionId}/authorize': 'AuthorizeConnectionRequest',
  'POST /v1/end-users': 'UpsertEndUserRequest',
  'POST /v1/knowledge-bases': 'CreateKnowledgeBaseRequest',
  'PATCH /v1/knowledge-bases/{knowledgeBaseId}': 'UpdateKnowledgeBaseRequest',
  'POST /v1/knowledge-bases/{knowledgeBaseId}/grants': 'CreateKnowledgeGrantRequest',
  'POST /v1/knowledge-bases/{knowledgeBaseId}/search': 'SearchKnowledgeRequest',
  'POST /v1/knowledge-bases/{knowledgeBaseId}/sources': 'CreateKnowledgeSourceRequest',
  'POST /v1/knowledge-bases/{knowledgeBaseId}/sources/{sourceId}/sync': 'SyncKnowledgeSourceRequest',
  'POST /v1/mcp/servers': 'CreateMcpServerRequest',
  'PATCH /v1/mcp/servers/{serverId}': 'UpdateMcpServerRequest',
  'POST /v1/provider-connections': 'CreateProviderConnectionRequest',
  'POST /v1/provider-connections/validate': 'ValidateProviderConnectionRequest',
  'PATCH /v1/provider-connections/{connectionId}': 'UpdateProviderConnectionRequest',
  'POST /v1/rate-plans': 'CreateRatePlanRequest',
  'POST /v1/runs/{runId}/delegate': 'DelegateRunRequest',
  'POST /v1/sessions': 'CreateSessionRequest',
  'POST /v1/sessions/{sessionId}/approve': 'SessionResolutionRequest',
  'POST /v1/sessions/{sessionId}/reject': 'SessionResolutionRequest',
  'POST /v1/sessions/{sessionId}/turns': 'SessionTurnRequest',
  'POST /v1/skill-imports': 'CreateSkillImportRequest',
  'POST /v1/skill-imports/{importId}/publish': 'PublishSkillImportRequest',
  'POST /v1/skills': 'CreateSkillRequest',
  'PATCH /v1/skills/{skillId}': 'UpdateSkillRequest',
  'POST /v1/skills/{skillId}/versions': 'CreateSkillVersionRequest',
  'POST /v1/skills/{skillId}/versions/{version}/publish': 'PublishSkillVersionRequest',
  'POST /v1/tenants': 'CreateTenantRequest',
  'PATCH /v1/tenants/{tenantId}': 'UpdateTenantRequest',
  'PUT /v1/tenants/{tenantId}/users/{externalUserId}': 'UpsertTenantUserRequest',
  'PATCH /v1/tenants/{tenantId}/users/{externalUserId}': 'PatchTenantUserRequest',
  'POST /v1/webhooks': 'CreateWebhookRequest',
  'PATCH /v1/webhooks/{webhookId}': 'UpdateWebhookRequest',
};

const emptyBodyOperations = new Set([
  'POST /v1/agent-installations/{installationId}/rollback',
  'POST /v1/agents/{agentId}/versions/{version}/deprecate',
  'POST /v1/agents/{agentId}/versions/{version}/publish',
  'POST /v1/agents/{agentId}/versions/{version}/retire',
  'POST /v1/agents/{agentId}/versions/{version}/submit',
  'POST /v1/agents/{agentId}/versions/{version}/validate',
  'POST /v1/connections/{connectionId}/refresh',
  'POST /v1/connections/{connectionId}/test',
  'POST /v1/mcp/servers/{serverId}/refresh-tools',
  'POST /v1/mcp/servers/{serverId}/test',
  'POST /v1/provider-connections/{connectionId}/model-syncs',
  'POST /v1/provider-connections/{connectionId}/model-syncs/{syncId}/apply',
  'POST /v1/provider-connections/{connectionId}/test',
  'POST /v1/runs/{runId}/cancel',
  'POST /v1/skills/{skillId}/versions/{version}/deprecate',
  'POST /v1/tenants/{tenantId}/export',
  'POST /v1/webhook-deliveries/{deliveryId}/replay',
]);

const idempotentOperations = new Set([
  'POST /v1/actions', 'POST /v1/agents/{agentId}/runs', 'POST /v1/provider-connections',
  'POST /v1/provider-connections/{connectionId}/model-syncs/{syncId}/apply',
  'POST /v1/runs/{runId}/delegate', 'POST /v1/tenants',
]);

const responseSchema = (method, path) => {
  if (path.startsWith('/v1/actions')) return 'Action';
  if (path === '/v1/agent-catalog') return 'AgentVersionList';
  if (path.startsWith('/v1/agent-installations')) return method === 'GET' && path === '/v1/agent-installations' ? 'InstallationList' : method === 'DELETE' ? 'DeletedResponse' : 'Installation';
  if (path.startsWith('/v1/agents')) {
    if (path.endsWith('/keys')) return 'AgentKey';
    if (path.endsWith('/runs')) return 'Run';
    if (path.includes('/versions')) {
      if (path.endsWith('/test')) return 'AgentVersionTest';
      if (path.endsWith('/validate')) return 'AgentVersionValidation';
      if (method === 'GET' && path.endsWith('/versions')) return 'AgentVersionList';
      return 'AgentVersion';
    }
    if (method === 'GET' && path === '/v1/agents') return 'AgentList';
    if (method === 'DELETE') return 'DeletedResponse';
    return 'Agent';
  }
  if (path === '/v1/client-tokens') return 'ClientToken';
  if (path.startsWith('/v1/connections')) {
    if (path.endsWith('/authorize')) return 'OAuthAuthorization';
    if (path.endsWith('/test')) return 'ConnectionTest';
    if (path.endsWith('/refresh')) return 'Connection';
    if (method === 'GET' && path === '/v1/connections') return 'ConnectionList';
    if (method === 'DELETE') return 'DeletedResponse';
    return 'Connection';
  }
  if (path.startsWith('/v1/connectors')) return method === 'GET' && path === '/v1/connectors' ? 'ConnectorList' : 'Connector';
  if (path.startsWith('/v1/end-users')) return method === 'GET' ? 'EndUserList' : 'EndUser';
  if (path.startsWith('/v1/knowledge-bases')) {
    if (path.includes('/grants')) return method === 'GET' ? 'KnowledgeGrantList' : method === 'DELETE' ? 'DeletedResponse' : 'KnowledgeGrant';
    if (path.endsWith('/search')) return 'KnowledgeSearchResponse';
    if (path.includes('/sources')) return method === 'GET' && path.endsWith('/sources') ? 'KnowledgeSourceList' : method === 'DELETE' ? 'DeletedResponse' : 'KnowledgeSource';
    if (method === 'GET' && path === '/v1/knowledge-bases') return 'KnowledgeBaseList';
    if (method === 'DELETE') return 'DeletedResponse';
    return 'KnowledgeBase';
  }
  if (path.startsWith('/v1/mcp/servers')) {
    if (path.endsWith('/tools')) return 'McpToolList';
    if (path.endsWith('/refresh-tools')) return 'McpDiscoveryResult';
    if (path.endsWith('/test')) return 'McpTest';
    if (method === 'GET' && path === '/v1/mcp/servers') return 'McpServerList';
    if (method === 'DELETE') return 'McpServer';
    return path === '/v1/mcp/servers' && method === 'POST' ? 'McpDiscoveryResult' : 'McpServer';
  }
  if (path === '/v1/models') return 'ModelList';
  if (path.startsWith('/v1/provider-connections')) {
    if (path.endsWith('/validate')) return 'ProviderValidation';
    if (path.includes('/model-syncs')) return 'ModelSync';
    if (path.endsWith('/test')) return 'ProviderTest';
    if (method === 'GET' && path === '/v1/provider-connections') return 'ProviderConnectionList';
    if (method === 'DELETE') return 'DeletedResponse';
    return 'ProviderConnection';
  }
  if (path.startsWith('/v1/rate-plans')) return method === 'GET' ? 'RatePlanList' : 'RatePlan';
  if (path.startsWith('/v1/runs')) return path.endsWith('/events') ? 'RunEventList' : 'Run';
  if (path.startsWith('/v1/sessions')) {
    if (path.endsWith('/events')) return 'SessionEventList';
    if (path.endsWith('/approve') || path.endsWith('/reject')) return 'SessionResolution';
    if (path.endsWith('/turns')) return null;
    if (method === 'GET' && path === '/v1/sessions') return 'SessionList';
    if (method === 'DELETE') return 'DeletedResponse';
    return 'Session';
  }
  if (path.startsWith('/v1/skill-imports')) return 'SkillImport';
  if (path.startsWith('/v1/skills')) {
    if (path.includes('/versions')) return method === 'GET' && path.endsWith('/versions') ? 'SkillVersionList' : 'SkillVersion';
    if (method === 'GET' && path === '/v1/skills') return 'SkillList';
    return 'Skill';
  }
  if (path.startsWith('/v1/tenants')) {
    if (path.endsWith('/export')) return 'TenantExport';
    if (path.includes('/users')) return method === 'GET' && path.endsWith('/users') ? 'TenantUserList' : method === 'DELETE' ? 'DeletedResponse' : 'TenantUser';
    if (method === 'GET' && path === '/v1/tenants') return 'TenantList';
    if (method === 'DELETE') return 'DeletedResponse';
    return 'Tenant';
  }
  if (path === '/v1/usage') return 'UsageSummary';
  if (path === '/v1/usage/events') return 'UsageEventList';
  if (path === '/v1/usage/export') return 'UsageExport';
  if (path === '/v1/webhook-deliveries') return 'WebhookDeliveryList';
  if (path.includes('/webhook-deliveries/')) return 'WebhookDelivery';
  if (path.startsWith('/v1/webhooks')) return method === 'GET' ? 'WebhookList' : method === 'DELETE' ? 'DeletedResponse' : 'Webhook';
  return null;
};

const tagForPath = (path) => {
  if (path.startsWith('/v1/actions')) return 'Actions';
  if (path.startsWith('/v1/agent-installations')) return 'Installations';
  if (path.includes('/versions')) return path.startsWith('/v1/skills') ? 'Skills' : 'Agent versions';
  if (path.startsWith('/v1/agents') || path === '/v1/agent-catalog') return 'Agents';
  if (path.startsWith('/v1/models')) return 'Models';
  if (path.startsWith('/v1/provider-connections')) return 'Providers';
  if (path.startsWith('/v1/tenants') || path.startsWith('/v1/client-tokens')) return 'Tenants';
  if (path.startsWith('/v1/sessions')) return 'Sessions';
  if (path.startsWith('/v1/runs')) return 'Runs';
  if (path.startsWith('/v1/knowledge')) return 'Knowledge';
  if (path.startsWith('/v1/skills') || path.startsWith('/v1/skill-imports')) return 'Skills';
  if (path.startsWith('/v1/connections') || path.startsWith('/v1/connectors')) return 'Connections';
  if (path.startsWith('/v1/mcp')) return 'MCP';
  if (path.startsWith('/v1/webhook')) return 'Webhooks';
  if (path.startsWith('/v1/usage')) return 'Usage';
  return 'Billing';
};

const parameterRefByName = {
  agentId: 'AgentId', version: 'Version', installationId: 'InstallationId', runId: 'RunId',
  actionId: 'ActionId', connectionId: 'ConnectionId', connectorId: 'ConnectorId',
  knowledgeBaseId: 'KnowledgeBaseId', sourceId: 'SourceId', grantId: 'GrantId',
  serverId: 'ServerId', syncId: 'SyncId', sessionId: 'SessionId', skillId: 'SkillId',
  importId: 'ImportId', tenantId: 'TenantId', externalUserId: 'ExternalUserId',
  deliveryId: 'DeliveryId', webhookId: 'WebhookId',
};

const query = (name, schema = string(), description) => ({ name, in: 'query', required: false, schema, ...(description ? { description } : {}) });
const queryParameters = {
  'GET /v1/agent-catalog': [query('visibility'), query('agent_id')],
  'GET /v1/agent-installations': [query('tenant_id'), query('limit', integer({ minimum: 1, maximum: 100 })), query('cursor')],
  'GET /v1/agents/{agentId}/versions': [query('status')],
  'GET /v1/connections': [query('tenant_id')],
  'GET /v1/connections/oauth/callback': [query('code'), query('state'), query('error')],
  'GET /v1/end-users': [query('limit', integer({ minimum: 1, maximum: 100 })), query('cursor')],
  'GET /v1/knowledge-bases': [query('tenant_id')],
  'GET /v1/mcp/servers': [query('tenant_id')],
  'GET /v1/models': [query('provider'), query('type'), query('available', boolean()), query('source'), query('connection_id')],
  'GET /v1/runs/{runId}/events': [query('after'), query('limit', integer({ minimum: 1, maximum: 100 }))],
  'GET /v1/sessions': [query('page', integer({ minimum: 1 })), query('limit', integer({ minimum: 1, maximum: 100 })), query('status'), query('agent_id'), query('tenant_id')],
  'GET /v1/sessions/{sessionId}/events': [query('page', integer({ minimum: 1 })), query('limit', integer({ minimum: 1, maximum: 100 })), query('turn_number', integer({ minimum: 1 }))],
  'GET /v1/skills': [query('visibility'), query('tenant_id')],
  'GET /v1/tenants': [query('limit', integer({ minimum: 1, maximum: 100 })), query('cursor'), query('status')],
  'DELETE /v1/tenants/{tenantId}/users/{externalUserId}': [query('hard', boolean())],
  'GET /v1/usage': [query('days', integer({ minimum: 1, maximum: 365 })), query('tenant_id'), query('agent_id'), query('installation_id')],
  'GET /v1/usage/events': [query('days', integer({ minimum: 1, maximum: 365 })), query('tenant_id'), query('agent_id'), query('limit', integer({ minimum: 1, maximum: 100 })), query('cursor')],
  'GET /v1/usage/export': [query('format', string({ enum: ['json', 'csv'] })), query('days', integer({ minimum: 1, maximum: 365 })), query('tenant_id'), query('agent_id')],
};

const operationId = (method, path) => {
  const parts = path.split('/').slice(2).flatMap((part) => {
    const match = part.match(/^\{(.+)\}$/);
    return match ? ['by', match[1]] : part.split('-');
  });
  return method.toLowerCase() + parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
};

for (const [path, pathItem] of Object.entries(spec.paths)) {
  const pathParameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    $ref: `#/components/parameters/${parameterRefByName[match[1]]}`,
  }));
  if (pathParameters.length) pathItem.parameters = pathParameters;

  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const operation = pathItem[method];
    if (!operation) continue;

    const key = `${method.toUpperCase()} ${path}`;
    operation.operationId = operationId(method, path);
    operation.tags = [tagForPath(path)];
    operation.parameters = [
      ...(queryParameters[key] ?? []),
      ...(idempotentOperations.has(key) ? [{ $ref: '#/components/parameters/IdempotencyKey' }] : []),
    ];
    if (!operation.parameters.length) delete operation.parameters;

    if (requestSchemas[key]) {
      operation.requestBody = {
        required: spec.components.schemas[requestSchemas[key]].required?.length > 0,
        content: { 'application/json': { schema: ref(requestSchemas[key]) } },
      };
    } else if (emptyBodyOperations.has(key)) {
      operation['x-cencori-empty-body'] = true;
      delete operation.requestBody;
    }

    const schemaName = responseSchema(method.toUpperCase(), path);
    const successCode = Object.keys(operation.responses ?? {}).find((code) => /^2\d\d$/.test(code));
    if (successCode && successCode !== '204') {
      const response = operation.responses[successCode];
      if (path === '/v1/sessions/{sessionId}/turns' || path === '/v1/sessions/{sessionId}/approve') {
        response.content = { 'text/event-stream': { schema: string() } };
      } else if (path === '/v1/usage/export') {
        response.content = {
          'application/json': { schema: ref('UsageExport') },
          'text/csv': { schema: string({ format: 'binary' }) },
        };
      } else if (schemaName) {
        response.content = { 'application/json': { schema: ref(schemaName) } };
      }
    }
    operation.responses['400'] = { $ref: '#/components/responses/Error' };
    operation.responses.default = { $ref: '#/components/responses/Error' };
    if (key === 'DELETE /v1/agents/{agentId}') {
      delete operation.responses[successCode];
      operation.responses['204'] = { description: 'Deleted' };
    }
    if (path === '/v1/connections/oauth/callback') operation.security = [];
  }
}

writeFileSync(file, `${JSON.stringify(spec, null, 2)}\n`);
