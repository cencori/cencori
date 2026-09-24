/**
 * M0 Embedded Agents — shared types.
 * PRD docs/prds/CENCORI_EMBEDDED_AGENTS_PRD.md §6, §10, §13
 */

export type EmbeddedActor = 'project_service' | 'client_user' | 'system';

export interface ExecutionContext {
    organizationId: string;
    projectId: string;
    environment: string;
    tenantId: string | null;
    externalUserId: string | null;
    installationId: string | null;
    actor: EmbeddedActor;
    requestId: string;
}

export type ModelSource = 'cencori' | 'byok' | 'custom';
export type ModelLifecycleStatus = 'active' | 'preview' | 'deprecated' | 'retired';
export type PricingStatus = 'priced' | 'unpriced' | 'custom' | 'unknown';

export type ModelUnavailableReason =
    | 'provider_connection_required'
    | 'model_not_allowed'
    | 'pricing_required'
    | 'provider_unhealthy'
    | 'unsupported'
    | 'restricted'
    | 'upstream_missing';

export interface UnifiedModelRow {
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
    name: string;
    provider: string;
    source: ModelSource;
    connection_id: string | null;
    types: string[];
    context_window: number;
    status: ModelLifecycleStatus;
    available: boolean;
    /** True when the model advertises reasoning capabilities (reasoning_effort may be set). */
    reasoning_supported: boolean;
    unavailable_reason: ModelUnavailableReason | null;
    byok_supported: boolean;
    managed_access: boolean;
    pricing_status: PricingStatus;
    pricing?: { input_per_million: number; output_per_million: number; currency: 'USD' } | null;
    description?: string;
}

export type TenantStatus = 'active' | 'suspended' | 'deleting' | 'deleted';
export type PlatformUserStatus = 'active' | 'blocked' | 'deleted';

export interface TenantRecord {
    id: string;
    project_id: string;
    external_id: string;
    name: string;
    status: TenantStatus;
    region: string | null;
    retention_policy: Record<string, unknown>;
    rate_plan_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export type ProviderApiFormat = 'openai' | 'anthropic' | 'openai-compatible' | 'anthropic-compatible';

export interface ProviderConnectionRecord {
    id: string;
    project_id: string;
    name: string;
    provider: string;
    api_format: ProviderApiFormat;
    base_url: string | null;
    key_hint: string | null;
    status: 'active' | 'disabled' | 'unhealthy';
    last_tested_at: string | null;
    last_synced_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ClientTokenClaims {
    project_id: string;
    env: string;
    tenant_id: string;
    external_user_id: string;
    installation_ids?: string[];
    permissions: string[];
    session_id?: string;
    exp: number;
    iat: number;
    aud: 'cencori-api';
}

export const CLIENT_TOKEN_PREFIX = 'ect_';
export const PROVIDER_CONNECTION_PREFIX = 'prc_';
export const PROVIDER_SYNC_PREFIX = 'pms_';
// withPrefix adds the separator. Keep these as bare resource prefixes.
export const TENANT_PREFIX = 'ten';
export const USER_PREFIX = 'usr';

export const EMBEDDED_ERROR_CODES = [
    'tenant_scope_mismatch',
    'tenant_suspended',
    'tenant_not_found',
    'user_not_found',
    'installation_not_found',
    'provider_connection_required',
    'model_not_allowed',
    'idempotency_conflict',
    'client_token_expired',
    'client_token_revoked',
    'unsafe_provider_url',
    'sync_expired',
    'sync_already_applied',
] as const;
