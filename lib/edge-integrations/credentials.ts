import { createAdminClient } from '@/lib/supabaseAdmin';
import { decryptApiKey, encryptApiKey } from '@/lib/encryption';
import type { EdgeIntegrationCredentialRecord, EdgeProvider } from './types';

interface SaveEdgeIntegrationCredentialsInput {
    integrationId: string;
    projectId: string;
    organizationId: string;
    provider: EdgeProvider;
    accessToken?: string | null;
    webhookSecret?: string | null;
    metadata?: Record<string, unknown>;
}

export interface EdgeIntegrationCredentials {
    integrationId: string;
    projectId: string;
    organizationId: string;
    provider: EdgeProvider;
    accessToken: string | null;
    webhookSecret: string | null;
    metadata: Record<string, unknown>;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

export async function saveEdgeIntegrationCredentials(
    input: SaveEdgeIntegrationCredentialsInput
): Promise<void> {
    const supabaseAdmin = createAdminClient();
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
        .from('edge_integration_credentials')
        .upsert({
            integration_id: input.integrationId,
            project_id: input.projectId,
            organization_id: input.organizationId,
            provider: input.provider,
            access_token_encrypted: input.accessToken
                ? encryptApiKey(input.accessToken, input.organizationId)
                : null,
            webhook_secret_encrypted: input.webhookSecret
                ? encryptApiKey(input.webhookSecret, input.organizationId)
                : null,
            metadata: input.metadata || {},
            updated_at: now,
        }, {
            onConflict: 'integration_id',
        });

    if (error) {
        throw error;
    }
}

export async function getEdgeIntegrationCredentials(
    integrationId: string
): Promise<EdgeIntegrationCredentials | null> {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
        .from('edge_integration_credentials')
        .select('*')
        .eq('integration_id', integrationId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    const record = data as EdgeIntegrationCredentialRecord;

    return {
        integrationId: record.integration_id,
        projectId: record.project_id,
        organizationId: record.organization_id,
        provider: record.provider,
        accessToken: record.access_token_encrypted
            ? decryptApiKey(record.access_token_encrypted, record.organization_id)
            : null,
        webhookSecret: record.webhook_secret_encrypted
            ? decryptApiKey(record.webhook_secret_encrypted, record.organization_id)
            : null,
        metadata: normalizeMetadata(record.metadata),
    };
}
