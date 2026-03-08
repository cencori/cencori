import { createAdminClient } from '@/lib/supabaseAdmin';
import type {
    EdgeDeploymentRecord,
    EdgeDeploymentSummary,
    EdgeEnvironment,
    EdgeIntegration,
    EdgeIntegrationCapabilities,
    EdgeIntegrationDomain,
    EdgeIntegrationDomainRecord,
    EdgeProvider,
    EdgeIntegrationRecord,
    EdgeIntegrationStatus,
    UpsertEdgeIntegrationInput,
} from './types';

const DEFAULT_CAPABILITIES: EdgeIntegrationCapabilities = {
    logs: false,
    deployments: false,
    domains: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingRelationError(error: { message?: string; details?: string } | null): boolean {
    const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return text.includes('does not exist') || text.includes('schema cache');
}

function normalizeCapabilities(value: unknown): EdgeIntegrationCapabilities {
    if (!isRecord(value)) return DEFAULT_CAPABILITIES;

    return {
        logs: value.logs === true,
        deployments: value.deployments === true,
        domains: value.domains === true,
    };
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function normalizeDomain(record: EdgeIntegrationDomainRecord): EdgeIntegrationDomain {
    return {
        id: record.id,
        domain: record.domain,
        environment: record.environment,
        isPrimary: record.is_primary,
        metadata: normalizeMetadata(record.metadata),
        lastSeenAt: record.last_seen_at,
    };
}

function normalizeDeployment(record: EdgeDeploymentRecord): EdgeDeploymentSummary {
    return {
        id: record.external_deployment_id,
        environment: record.environment,
        status: record.status,
        deploymentUrl: record.deployment_url,
        branchUrl: record.branch_url,
        commitSha: record.commit_sha,
        commitRef: record.commit_ref,
        createdAt: record.created_at,
        readyAt: record.ready_at,
        metadata: normalizeMetadata(record.metadata),
    };
}

function normalizeIntegration(
    record: EdgeIntegrationRecord,
    domains: EdgeIntegrationDomainRecord[],
    latestDeployment: EdgeDeploymentRecord | undefined
): EdgeIntegration {
    return {
        id: record.id,
        provider: record.provider,
        status: record.status,
        installedVia: record.installed_via,
        externalAccountId: record.external_account_id,
        externalAccountName: record.external_account_name,
        externalProjectId: record.external_project_id,
        externalProjectName: record.external_project_name,
        externalProjectSlug: record.external_project_slug,
        capabilities: normalizeCapabilities(record.capabilities),
        metadata: normalizeMetadata(record.metadata),
        connectedBy: record.connected_by,
        connectedAt: record.connected_at,
        disconnectedAt: record.disconnected_at,
        lastSyncedAt: record.last_synced_at,
        lastError: record.last_error,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        domains: domains.map(normalizeDomain),
        latestDeployment: latestDeployment ? normalizeDeployment(latestDeployment) : null,
    };
}

function dedupeDomains(domains: NonNullable<UpsertEdgeIntegrationInput['domains']>) {
    const seen = new Set<string>();

    return domains.filter((domain) => {
        const key = domain.domain.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export async function listProjectEdgeIntegrations(projectId: string): Promise<EdgeIntegration[]> {
    const supabaseAdmin = createAdminClient();

    const { data: integrationRows, error: integrationsError } = await supabaseAdmin
        .from('edge_integrations')
        .select('*')
        .eq('project_id', projectId)
        .neq('status', 'disconnected')
        .order('created_at', { ascending: false });

    if (integrationsError) {
        if (isMissingRelationError(integrationsError)) return [];
        throw integrationsError;
    }

    const integrations = (integrationRows as EdgeIntegrationRecord[] | null) || [];
    if (integrations.length === 0) return [];

    const integrationIds = integrations.map((integration) => integration.id);

    const [domainsResult, deploymentsResult] = await Promise.all([
        supabaseAdmin
            .from('edge_integration_domains')
            .select('*')
            .in('integration_id', integrationIds)
            .order('created_at', { ascending: false }),
        supabaseAdmin
            .from('edge_deployments')
            .select('*')
            .in('integration_id', integrationIds)
            .order('created_at', { ascending: false }),
    ]);

    if (domainsResult.error) {
        if (!isMissingRelationError(domainsResult.error)) throw domainsResult.error;
    }

    if (deploymentsResult.error) {
        if (!isMissingRelationError(deploymentsResult.error)) throw deploymentsResult.error;
    }

    const domainRows = (domainsResult.data as EdgeIntegrationDomainRecord[] | null) || [];
    const deploymentRows = (deploymentsResult.data as EdgeDeploymentRecord[] | null) || [];

    const domainsByIntegrationId = new Map<string, EdgeIntegrationDomainRecord[]>();
    for (const domain of domainRows) {
        const existing = domainsByIntegrationId.get(domain.integration_id) || [];
        existing.push(domain);
        domainsByIntegrationId.set(domain.integration_id, existing);
    }

    const latestDeploymentByIntegrationId = new Map<string, EdgeDeploymentRecord>();
    for (const deployment of deploymentRows) {
        if (!latestDeploymentByIntegrationId.has(deployment.integration_id)) {
            latestDeploymentByIntegrationId.set(deployment.integration_id, deployment);
        }
    }

    return integrations.map((integration) => normalizeIntegration(
        integration,
        domainsByIntegrationId.get(integration.id) || [],
        latestDeploymentByIntegrationId.get(integration.id)
    ));
}

export async function upsertProjectEdgeIntegration(input: UpsertEdgeIntegrationInput): Promise<EdgeIntegration> {
    const supabaseAdmin = createAdminClient();
    const now = new Date().toISOString();

    const capabilities: EdgeIntegrationCapabilities = {
        ...DEFAULT_CAPABILITIES,
        ...(input.capabilities || {}),
    };

    const { data: integrationRow, error: integrationError } = await supabaseAdmin
        .from('edge_integrations')
        .upsert({
            project_id: input.projectId,
            organization_id: input.organizationId,
            provider: input.provider,
            status: (input.status || 'connected') as EdgeIntegrationStatus,
            installed_via: input.installedVia || 'manual',
            external_account_id: input.externalAccountId || null,
            external_account_name: input.externalAccountName || null,
            external_project_id: input.externalProjectId,
            external_project_name: input.externalProjectName,
            external_project_slug: input.externalProjectSlug || null,
            capabilities,
            metadata: input.metadata || {},
            connected_by: input.connectedBy || null,
            connected_at: now,
            disconnected_at: null,
            updated_at: now,
        }, {
            onConflict: 'project_id,provider,external_project_id',
        })
        .select('*')
        .single();

    if (integrationError) throw integrationError;

    const integration = integrationRow as EdgeIntegrationRecord;

    if (input.domains) {
        const normalizedDomains = dedupeDomains(input.domains);

        const { error: deleteError } = await supabaseAdmin
            .from('edge_integration_domains')
            .delete()
            .eq('integration_id', integration.id);

        if (deleteError) throw deleteError;

        if (normalizedDomains.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('edge_integration_domains')
                .insert(normalizedDomains.map((domain) => ({
                    integration_id: integration.id,
                    project_id: input.projectId,
                    organization_id: input.organizationId,
                    provider: input.provider,
                    domain: domain.domain.trim().toLowerCase(),
                    environment: (domain.environment || 'production') as EdgeEnvironment,
                    is_primary: domain.isPrimary === true,
                    metadata: domain.metadata || {},
                    last_seen_at: now,
                    updated_at: now,
                })));

            if (insertError) throw insertError;
        }
    }

    const integrations = await listProjectEdgeIntegrations(input.projectId);
    const saved = integrations.find((item) => item.id === integration.id);

    if (!saved) {
        throw new Error('Failed to reload edge integration after save');
    }

    return saved;
}

export async function getEdgeIntegrationRecordById(integrationId: string): Promise<EdgeIntegrationRecord | null> {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
        .from('edge_integrations')
        .select('*')
        .eq('id', integrationId)
        .maybeSingle();

    if (error) throw error;
    return (data as EdgeIntegrationRecord | null) || null;
}

export async function listEdgeIntegrationRecordsByProviderAndExternalProjectId(
    provider: EdgeProvider,
    externalProjectId: string
): Promise<EdgeIntegrationRecord[]> {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
        .from('edge_integrations')
        .select('*')
        .eq('provider', provider)
        .eq('external_project_id', externalProjectId)
        .neq('status', 'disconnected')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as EdgeIntegrationRecord[] | null) || [];
}

export async function listEdgeIntegrationRecordsByProviderAndConfigurationId(
    provider: EdgeProvider,
    configurationId: string
): Promise<EdgeIntegrationRecord[]> {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
        .from('edge_integrations')
        .select('*')
        .eq('provider', provider)
        .neq('status', 'disconnected')
        .filter('metadata->>configurationId', 'eq', configurationId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as EdgeIntegrationRecord[] | null) || [];
}

export async function updateEdgeIntegrationById(
    integrationId: string,
    patch: {
        status?: EdgeIntegrationStatus;
        installedVia?: EdgeIntegrationRecord['installed_via'];
        externalAccountId?: string | null;
        externalAccountName?: string | null;
        externalProjectId?: string;
        externalProjectName?: string;
        externalProjectSlug?: string | null;
        capabilities?: EdgeIntegrationCapabilities;
        metadata?: Record<string, unknown>;
        connectedBy?: string | null;
        connectedAt?: string;
        disconnectedAt?: string | null;
        lastSyncedAt?: string | null;
        lastError?: string | null;
    }
): Promise<EdgeIntegrationRecord> {
    const supabaseAdmin = createAdminClient();
    const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (patch.status !== undefined) updateData.status = patch.status;
    if (patch.installedVia !== undefined) updateData.installed_via = patch.installedVia;
    if (patch.externalAccountId !== undefined) updateData.external_account_id = patch.externalAccountId;
    if (patch.externalAccountName !== undefined) updateData.external_account_name = patch.externalAccountName;
    if (patch.externalProjectId !== undefined) updateData.external_project_id = patch.externalProjectId;
    if (patch.externalProjectName !== undefined) updateData.external_project_name = patch.externalProjectName;
    if (patch.externalProjectSlug !== undefined) updateData.external_project_slug = patch.externalProjectSlug;
    if (patch.capabilities !== undefined) updateData.capabilities = patch.capabilities;
    if (patch.metadata !== undefined) updateData.metadata = patch.metadata;
    if (patch.connectedBy !== undefined) updateData.connected_by = patch.connectedBy;
    if (patch.connectedAt !== undefined) updateData.connected_at = patch.connectedAt;
    if (patch.disconnectedAt !== undefined) updateData.disconnected_at = patch.disconnectedAt;
    if (patch.lastSyncedAt !== undefined) updateData.last_synced_at = patch.lastSyncedAt;
    if (patch.lastError !== undefined) updateData.last_error = patch.lastError;

    const { data, error } = await supabaseAdmin
        .from('edge_integrations')
        .update(updateData)
        .eq('id', integrationId)
        .select('*')
        .single();

    if (error) throw error;
    return data as EdgeIntegrationRecord;
}

export async function replaceEdgeIntegrationDomains(
    input: {
        integrationId: string;
        projectId: string;
        organizationId: string;
        provider: EdgeIntegrationRecord['provider'];
        domains: Array<{
            domain: string;
            environment?: EdgeEnvironment;
            isPrimary?: boolean;
            metadata?: Record<string, unknown>;
        }>;
    }
): Promise<void> {
    const supabaseAdmin = createAdminClient();
    const now = new Date().toISOString();
    const normalizedDomains = dedupeDomains(input.domains);

    const { error: deleteError } = await supabaseAdmin
        .from('edge_integration_domains')
        .delete()
        .eq('integration_id', input.integrationId);

    if (deleteError) throw deleteError;

    if (normalizedDomains.length === 0) {
        return;
    }

    const { error: insertError } = await supabaseAdmin
        .from('edge_integration_domains')
        .insert(normalizedDomains.map((domain) => ({
            integration_id: input.integrationId,
            project_id: input.projectId,
            organization_id: input.organizationId,
            provider: input.provider,
            domain: domain.domain.trim().toLowerCase(),
            environment: (domain.environment || 'production') as EdgeEnvironment,
            is_primary: domain.isPrimary === true,
            metadata: domain.metadata || {},
            last_seen_at: now,
            updated_at: now,
        })));

    if (insertError) throw insertError;
}

export async function upsertEdgeDeployment(input: {
    integrationId: string;
    projectId: string;
    organizationId: string;
    provider: EdgeIntegrationRecord['provider'];
    externalDeploymentId: string;
    environment: EdgeEnvironment;
    status: EdgeDeploymentRecord['status'];
    deploymentUrl?: string | null;
    branchUrl?: string | null;
    commitSha?: string | null;
    commitRef?: string | null;
    metadata?: Record<string, unknown>;
    startedAt?: string | null;
    readyAt?: string | null;
}): Promise<void> {
    const supabaseAdmin = createAdminClient();
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
        .from('edge_deployments')
        .upsert({
            integration_id: input.integrationId,
            project_id: input.projectId,
            organization_id: input.organizationId,
            provider: input.provider,
            external_deployment_id: input.externalDeploymentId,
            environment: input.environment,
            status: input.status,
            deployment_url: input.deploymentUrl || null,
            branch_url: input.branchUrl || null,
            commit_sha: input.commitSha || null,
            commit_ref: input.commitRef || null,
            metadata: input.metadata || {},
            started_at: input.startedAt || null,
            ready_at: input.readyAt || null,
            updated_at: now,
        }, {
            onConflict: 'integration_id,external_deployment_id',
        });

    if (error) throw error;
}

export async function disconnectProjectEdgeIntegration(projectId: string, integrationId: string): Promise<void> {
    const supabaseAdmin = createAdminClient();
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
        .from('edge_integrations')
        .update({
            status: 'disconnected',
            disconnected_at: now,
            updated_at: now,
        })
        .eq('project_id', projectId)
        .eq('id', integrationId);

    if (error) throw error;
}
