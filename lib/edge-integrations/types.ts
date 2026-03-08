export type EdgeProvider = 'vercel' | 'supabase' | 'cloudflare' | 'aws' | 'azure' | 'gcp';

export type EdgeIntegrationStatus = 'pending' | 'connected' | 'error' | 'disconnected';

export type EdgeInstallSource = 'marketplace' | 'oauth' | 'manual' | 'system';

export type EdgeEnvironment = 'production' | 'preview' | 'development';

export interface EdgeIntegrationCapabilities {
    logs: boolean;
    deployments: boolean;
    domains: boolean;
}

export interface EdgeIntegrationRecord {
    id: string;
    project_id: string;
    organization_id: string;
    provider: EdgeProvider;
    status: EdgeIntegrationStatus;
    installed_via: EdgeInstallSource;
    external_account_id: string | null;
    external_account_name: string | null;
    external_project_id: string;
    external_project_name: string;
    external_project_slug: string | null;
    capabilities: unknown;
    metadata: unknown;
    connected_by: string | null;
    connected_at: string;
    disconnected_at: string | null;
    last_synced_at: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
}

export interface EdgeIntegrationDomainRecord {
    id: string;
    integration_id: string;
    project_id: string;
    organization_id: string;
    provider: EdgeProvider;
    domain: string;
    environment: EdgeEnvironment;
    is_primary: boolean;
    metadata: unknown;
    last_seen_at: string;
    created_at: string;
    updated_at: string;
}

export interface EdgeDeploymentRecord {
    id: string;
    integration_id: string;
    project_id: string;
    organization_id: string;
    provider: EdgeProvider;
    external_deployment_id: string;
    environment: EdgeEnvironment;
    status: 'created' | 'building' | 'ready' | 'error' | 'canceled' | 'promoted';
    deployment_url: string | null;
    branch_url: string | null;
    commit_sha: string | null;
    commit_ref: string | null;
    metadata: unknown;
    started_at: string | null;
    ready_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface EdgeIntegrationCredentialRecord {
    integration_id: string;
    project_id: string;
    organization_id: string;
    provider: EdgeProvider;
    access_token_encrypted: string | null;
    webhook_secret_encrypted: string | null;
    metadata: unknown;
    created_at: string;
    updated_at: string;
}

export interface EdgeIntegrationDomain {
    id: string;
    domain: string;
    environment: EdgeEnvironment;
    isPrimary: boolean;
    metadata: Record<string, unknown>;
    lastSeenAt: string;
}

export interface EdgeDeploymentSummary {
    id: string;
    environment: EdgeEnvironment;
    status: EdgeDeploymentRecord['status'];
    deploymentUrl: string | null;
    branchUrl: string | null;
    commitSha: string | null;
    commitRef: string | null;
    createdAt: string;
    readyAt: string | null;
    metadata: Record<string, unknown>;
}

export interface EdgeIntegration {
    id: string;
    provider: EdgeProvider;
    status: EdgeIntegrationStatus;
    installedVia: EdgeInstallSource;
    externalAccountId: string | null;
    externalAccountName: string | null;
    externalProjectId: string;
    externalProjectName: string;
    externalProjectSlug: string | null;
    capabilities: EdgeIntegrationCapabilities;
    metadata: Record<string, unknown>;
    connectedBy: string | null;
    connectedAt: string;
    disconnectedAt: string | null;
    lastSyncedAt: string | null;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
    domains: EdgeIntegrationDomain[];
    latestDeployment: EdgeDeploymentSummary | null;
}

export interface UpsertEdgeIntegrationInput {
    projectId: string;
    organizationId: string;
    provider: EdgeProvider;
    installedVia?: EdgeInstallSource;
    status?: EdgeIntegrationStatus;
    externalAccountId?: string | null;
    externalAccountName?: string | null;
    externalProjectId: string;
    externalProjectName: string;
    externalProjectSlug?: string | null;
    metadata?: Record<string, unknown>;
    capabilities?: Partial<EdgeIntegrationCapabilities>;
    connectedBy?: string | null;
    domains?: Array<{
        domain: string;
        environment?: EdgeEnvironment;
        isPrimary?: boolean;
        metadata?: Record<string, unknown>;
    }>;
}
