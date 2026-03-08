import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getEdgeIntegrationCredentials } from '@/lib/edge-integrations/credentials';
import {
    listEdgeIntegrationRecordsByProviderAndConfigurationId,
    listEdgeIntegrationRecordsByProviderAndExternalProjectId,
    replaceEdgeIntegrationDomains,
    updateEdgeIntegrationById,
    upsertEdgeDeployment,
} from '@/lib/edge-integrations/repository';
import { getVercelProjectDomains, normalizeVercelDomains } from '@/lib/edge-integrations/vercel';
import type { EdgeDeploymentRecord, EdgeEnvironment, EdgeIntegrationRecord } from '@/lib/edge-integrations/types';

interface VercelWebhookEnvelope {
    type?: string;
    payload?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function getNestedRecord(record: Record<string, unknown> | undefined, key: string): Record<string, unknown> | null {
    const value = record?.[key];
    return isRecord(value) ? value : null;
}

function getNestedString(record: Record<string, unknown> | undefined, key: string): string | null {
    const value = record?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getNestedNumber(record: Record<string, unknown> | undefined, key: string): number | null {
    const value = record?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getStringArray(record: Record<string, unknown> | undefined, key: string): string[] {
    const value = record?.[key];
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];
}

function verifyVercelSignature(rawBody: string, signature: string | null, secret: string): boolean {
    if (!signature) {
        return false;
    }

    const expectedHex = createHmac('sha1', secret).update(rawBody).digest('hex');
    const normalizedSignature = signature.replace(/^sha1=/i, '');
    const actual = Buffer.from(normalizedSignature);
    const expected = Buffer.from(expectedHex);

    if (actual.length !== expected.length) {
        return false;
    }

    return timingSafeEqual(actual, expected);
}

function mapDeploymentEnvironment(target: string | null | undefined): EdgeEnvironment {
    if (target === 'production') {
        return 'production';
    }

    if (target === 'development') {
        return 'development';
    }

    return 'preview';
}

function mapDeploymentStatus(
    eventType: string,
    readyState: string | null | undefined
): EdgeDeploymentRecord['status'] {
    if (eventType === 'deployment.promoted') {
        return 'promoted';
    }

    if (eventType === 'deployment.ready' || eventType === 'deployment.succeeded') {
        return 'ready';
    }

    if (eventType === 'deployment.error') {
        return 'error';
    }

    if (eventType === 'deployment.canceled') {
        return 'canceled';
    }

    switch ((readyState || '').toUpperCase()) {
        case 'READY':
            return 'ready';
        case 'ERROR':
            return 'error';
        case 'CANCELED':
            return 'canceled';
        case 'BUILDING':
        case 'QUEUED':
        case 'INITIALIZING':
            return 'building';
        default:
            return 'created';
    }
}

function toIsoDate(value: number | null): string | null {
    return typeof value === 'number' && Number.isFinite(value)
        ? new Date(value).toISOString()
        : null;
}

function getCommitMeta(meta: Record<string, unknown> | null) {
    if (!meta) {
        return { commitRef: null, commitSha: null };
    }

    const commitRef =
        getNestedString(meta, 'githubCommitRef')
        || getNestedString(meta, 'gitlabCommitRef')
        || getNestedString(meta, 'bitbucketCommitRef')
        || getNestedString(meta, 'commitRef');

    const commitSha =
        getNestedString(meta, 'githubCommitSha')
        || getNestedString(meta, 'gitlabCommitSha')
        || getNestedString(meta, 'bitbucketCommitSha')
        || getNestedString(meta, 'commitSha');

    return { commitRef, commitSha };
}

function getEventProjectId(payload: Record<string, unknown> | undefined): string | null {
    const project = getNestedRecord(payload, 'project') || undefined;
    const deployment = getNestedRecord(payload, 'deployment') || undefined;
    const deploymentProject = getNestedRecord(deployment, 'project') || undefined;
    const resource = getNestedRecord(payload, 'resource') || undefined;
    const resourceProject = getNestedRecord(resource, 'project') || undefined;
    const projectDomain = getNestedRecord(payload, 'projectDomain') || undefined;

    return getNestedString(payload, 'projectId')
        || getNestedString(resource, 'projectId')
        || getNestedString(projectDomain, 'projectId')
        || getNestedString(project, 'id')
        || getNestedString(resourceProject, 'id')
        || getNestedString(deploymentProject, 'id');
}

function getEventConfigurationId(payload: Record<string, unknown> | undefined): string | null {
    const configuration = getNestedRecord(payload, 'configuration') || undefined;
    const integrationConfiguration = getNestedRecord(payload, 'integrationConfiguration') || undefined;
    const resource = getNestedRecord(payload, 'resource') || undefined;

    return getNestedString(payload, 'configurationId')
        || getNestedString(payload, 'integrationConfigurationId')
        || getNestedString(resource, 'configurationId')
        || getNestedString(configuration, 'id')
        || getNestedString(integrationConfiguration, 'id');
}

async function resolveIntegrations(payload: Record<string, unknown>) {
    const externalProjectId = getEventProjectId(payload);
    const configurationId = getEventConfigurationId(payload);
    const matches = new Map<string, EdgeIntegrationRecord>();

    if (externalProjectId) {
        const byProject = await listEdgeIntegrationRecordsByProviderAndExternalProjectId('vercel', externalProjectId);
        for (const integration of byProject) {
            matches.set(integration.id, integration);
        }
    }

    if (configurationId) {
        const byConfiguration = await listEdgeIntegrationRecordsByProviderAndConfigurationId('vercel', configurationId);
        for (const integration of byConfiguration) {
            matches.set(integration.id, integration);
        }
    }

    return {
        externalProjectId,
        configurationId,
        integrations: [...matches.values()],
    };
}

async function refreshDomains(integration: EdgeIntegrationRecord) {
    const credentials = await getEdgeIntegrationCredentials(integration.id);

    if (!credentials?.accessToken) {
        return;
    }

    const domains = await getVercelProjectDomains({
        accessToken: credentials.accessToken,
        projectId: integration.external_project_id,
        teamId: integration.external_account_id,
    });

    await replaceEdgeIntegrationDomains({
        integrationId: integration.id,
        projectId: integration.project_id,
        organizationId: integration.organization_id,
        provider: 'vercel',
        domains: normalizeVercelDomains(domains),
    });
}

async function processIntegrationWebhook(
    integration: EdgeIntegrationRecord,
    type: string,
    payload: Record<string, unknown>,
    receivedAt: string,
    configurationId: string | null
) {
    const metadata = {
        ...normalizeMetadata(integration.metadata),
        lastWebhookType: type,
        lastWebhookAt: receivedAt,
        ...(configurationId ? { configurationId } : {}),
    };

    if (type.startsWith('deployment.')) {
        const deployment = getNestedRecord(payload, 'deployment') || payload;
        const deploymentMeta = getNestedRecord(deployment, 'meta');
        const alias = getStringArray(deployment, 'alias');
        const branchUrl = alias[0] || null;
        const { commitRef, commitSha } = getCommitMeta(deploymentMeta);
        const deploymentId =
            getNestedString(deployment, 'id')
            || getNestedString(payload, 'deploymentId')
            || getNestedString(payload, 'toDeploymentId');

        if (deploymentId) {
            const readyState = getNestedString(deployment, 'readyState');

            await upsertEdgeDeployment({
                integrationId: integration.id,
                projectId: integration.project_id,
                organizationId: integration.organization_id,
                provider: 'vercel',
                externalDeploymentId: deploymentId,
                environment: mapDeploymentEnvironment(
                    getNestedString(deployment, 'target') || getNestedString(payload, 'target')
                ),
                status: mapDeploymentStatus(type, readyState),
                deploymentUrl: getNestedString(deployment, 'url'),
                branchUrl,
                commitSha,
                commitRef,
                metadata: {
                    type,
                    readyState,
                    target: getNestedString(deployment, 'target') || getNestedString(payload, 'target'),
                    alias,
                },
                startedAt: toIsoDate(getNestedNumber(deployment, 'createdAt')),
                readyAt: toIsoDate(getNestedNumber(deployment, 'ready')),
            });
        }

        await updateEdgeIntegrationById(integration.id, {
            status: 'connected',
            lastSyncedAt: receivedAt,
            lastError: null,
            metadata,
        });

        return;
    }

    if (type.startsWith('project.domain.')) {
        await refreshDomains(integration);

        await updateEdgeIntegrationById(integration.id, {
            status: 'connected',
            lastSyncedAt: receivedAt,
            lastError: null,
            metadata,
        });

        return;
    }

    if (type === 'integration-resource.project-disconnected' || type === 'integration-configuration.removed') {
        await updateEdgeIntegrationById(integration.id, {
            status: 'disconnected',
            disconnectedAt: receivedAt,
            lastSyncedAt: receivedAt,
            lastError: null,
            metadata: {
                ...metadata,
                provisioningStatus: type === 'integration-configuration.removed' ? 'removed' : 'disconnected',
            },
        });

        return;
    }

    if (type === 'integration-resource.project-connected' || type.startsWith('integration-configuration.')) {
        await updateEdgeIntegrationById(integration.id, {
            status: 'connected',
            disconnectedAt: null,
            lastSyncedAt: receivedAt,
            lastError: null,
            metadata: {
                ...metadata,
                provisioningStatus: 'connected',
            },
        });

        return;
    }

    await updateEdgeIntegrationById(integration.id, {
        lastSyncedAt: receivedAt,
        lastError: null,
        metadata,
    });
}

export async function POST(req: NextRequest) {
    const secret = process.env.VERCEL_INTEGRATION_CLIENT_SECRET?.trim();
    if (!secret) {
        return NextResponse.json({ error: 'Vercel integration secret is not configured' }, { status: 503 });
    }

    const rawBody = await req.text();
    if (!verifyVercelSignature(rawBody, req.headers.get('x-vercel-signature'), secret)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let event: VercelWebhookEnvelope;
    try {
        event = JSON.parse(rawBody) as VercelWebhookEnvelope;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const type = typeof event.type === 'string' ? event.type : '';
    const payload = isRecord(event.payload) ? event.payload : undefined;

    if (!type || !payload) {
        return NextResponse.json({ error: 'Malformed webhook payload' }, { status: 400 });
    }

    const receivedAt = new Date().toISOString();
    const { configurationId, integrations } = await resolveIntegrations(payload);

    if (integrations.length === 0) {
        return NextResponse.json({ ok: true, skipped: 'integration_not_found' });
    }

    let processed = 0;
    let failed = 0;

    for (const integration of integrations) {
        try {
            await processIntegrationWebhook(integration, type, payload, receivedAt, configurationId);
            processed += 1;
        } catch (error) {
            failed += 1;
            console.error('[Vercel Webhook] Failed to process integration webhook:', {
                integrationId: integration.id,
                type,
                error,
            });

            await updateEdgeIntegrationById(integration.id, {
                status: 'error',
                lastSyncedAt: receivedAt,
                lastError: error instanceof Error ? error.message : 'Failed to process Vercel webhook',
            });
        }
    }

    return NextResponse.json({
        ok: true,
        processed,
        failed,
    });
}
