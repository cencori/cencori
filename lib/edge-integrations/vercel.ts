import { createHmac } from 'crypto';
import type { EdgeEnvironment, EdgeIntegrationCapabilities } from './types';

const VERCEL_API_BASE_URL = 'https://api.vercel.com';

export interface VercelTokenExchangeResponse {
    access_token: string;
    token_type?: string;
    user_id?: string;
    team_id?: string | null;
}

export interface VercelIntegrationConfiguration {
    id: string;
    slug?: string;
    teamId?: string | null;
    userId?: string | null;
    projects?: string[];
    projectSelection?: 'all' | 'some';
    completedAt?: number | null;
}

export interface VercelProject {
    id: string;
    name: string;
    framework?: string | null;
    latestDeployments?: Array<{
        id?: string;
        name?: string;
        readyState?: string | null;
        url?: string | null;
        alias?: string[];
        target?: string | null;
        createdAt?: number | null;
        ready?: number | null;
        meta?: Record<string, string>;
    }>;
}

export interface VercelProjectDomain {
    name: string;
    gitBranch?: string | null;
    redirect?: string | null;
    customEnvironmentId?: string | null;
    updatedAt?: number | null;
}

export interface VercelWebhook {
    id: string;
    secret?: string | null;
}

export interface VercelLogDrain {
    id: string;
}

export interface VercelProvisioningArtifacts {
    accessToken: string;
    teamId: string | null;
    configuration: VercelIntegrationConfiguration;
    project: VercelProject;
    domains: Array<{
        domain: string;
        environment: EdgeEnvironment;
        isPrimary: boolean;
        metadata: Record<string, unknown>;
    }>;
    latestDeployment: {
        externalDeploymentId: string;
        environment: EdgeEnvironment;
        status: 'created' | 'building' | 'ready' | 'error' | 'canceled' | 'promoted';
        deploymentUrl: string | null;
        branchUrl: string | null;
        commitSha: string | null;
        commitRef: string | null;
        metadata: Record<string, unknown>;
        startedAt: string | null;
        readyAt: string | null;
    } | null;
    drainId: string;
    capabilities: EdgeIntegrationCapabilities;
}

function getAppBaseUrl(originFallback?: string): string | null {
    return (
        process.env.VERCEL_INTEGRATION_PUBLIC_BASE_URL?.replace(/\/$/, '')
        || process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
        || process.env.NEXT_PUBLIC_URL?.replace(/\/$/, '')
        || originFallback?.replace(/\/$/, '')
        || null
    );
}

function getVercelClientId(): string | null {
    return process.env.VERCEL_INTEGRATION_CLIENT_ID?.trim() || null;
}

function getVercelClientSecret(): string | null {
    return process.env.VERCEL_INTEGRATION_CLIENT_SECRET?.trim() || null;
}

export function getVercelCallbackUrl(originFallback?: string): string | null {
    return (
        process.env.VERCEL_INTEGRATION_REDIRECT_URI?.trim()
        || (getAppBaseUrl(originFallback)
            ? `${getAppBaseUrl(originFallback)}/api/edge-integrations/vercel/callback`
            : null)
    );
}

export function hasVercelProvisioningConfig(): boolean {
    return !!getVercelClientId() && !!getVercelClientSecret() && !!getVercelCallbackUrl();
}

function buildTeamQuery(teamId: string | null | undefined): string {
    return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
}

async function readVercelResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
        return response.json() as Promise<T>;
    }

    let message = `Vercel API error (${response.status})`;

    try {
        const body = await response.json() as {
            error?: { message?: string };
            message?: string;
        };
        message = body.error?.message || body.message || message;
    } catch {
        // Ignore JSON parse failures; keep default message.
    }

    throw new Error(message);
}

export async function exchangeVercelCodeForToken(input: {
    code: string;
    teamId?: string | null;
    originFallback?: string;
}): Promise<VercelTokenExchangeResponse> {
    const clientId = getVercelClientId();
    const clientSecret = getVercelClientSecret();
    const redirectUri = getVercelCallbackUrl(input.originFallback);

    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('Vercel integration credentials are not configured');
    }

    const response = await fetch(
        `${VERCEL_API_BASE_URL}/v2/oauth/access_token${buildTeamQuery(input.teamId)}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code: input.code,
                redirect_uri: redirectUri,
            }),
            signal: AbortSignal.timeout(15_000),
        }
    );

    return readVercelResponse<VercelTokenExchangeResponse>(response);
}

async function vercelApiRequest<T>(input: {
    accessToken: string;
    path: string;
    method?: 'GET' | 'POST';
    teamId?: string | null;
    body?: Record<string, unknown>;
}): Promise<T> {
    const response = await fetch(
        `${VERCEL_API_BASE_URL}${input.path}${buildTeamQuery(input.teamId)}`,
        {
            method: input.method || 'GET',
            headers: {
                Authorization: `Bearer ${input.accessToken}`,
                ...(input.body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: input.body ? JSON.stringify(input.body) : undefined,
            signal: AbortSignal.timeout(15_000),
        }
    );

    return readVercelResponse<T>(response);
}

export async function getVercelIntegrationConfiguration(input: {
    accessToken: string;
    configurationId: string;
    teamId?: string | null;
}): Promise<VercelIntegrationConfiguration> {
    return vercelApiRequest<VercelIntegrationConfiguration>({
        accessToken: input.accessToken,
        path: `/v1/integrations/configuration/${encodeURIComponent(input.configurationId)}`,
        teamId: input.teamId,
    });
}

export async function getVercelProject(input: {
    accessToken: string;
    projectId: string;
    teamId?: string | null;
}): Promise<VercelProject> {
    return vercelApiRequest<VercelProject>({
        accessToken: input.accessToken,
        path: `/v9/projects/${encodeURIComponent(input.projectId)}`,
        teamId: input.teamId,
    });
}

export async function getVercelProjectDomains(input: {
    accessToken: string;
    projectId: string;
    teamId?: string | null;
}): Promise<VercelProjectDomain[]> {
    const response = await vercelApiRequest<{ domains?: VercelProjectDomain[] }>({
        accessToken: input.accessToken,
        path: `/v9/projects/${encodeURIComponent(input.projectId)}/domains`,
        teamId: input.teamId,
    });

    return Array.isArray(response.domains) ? response.domains : [];
}

export async function createVercelLogDrain(input: {
    accessToken: string;
    teamId?: string | null;
    projectId: string;
    endpoint: string;
    ingestSecret: string;
}): Promise<VercelLogDrain> {
    return vercelApiRequest<VercelLogDrain>({
        accessToken: input.accessToken,
        path: '/v1/drains',
        method: 'POST',
        teamId: input.teamId,
        body: {
            name: 'Cencori HTTP Traffic',
            projectIds: [input.projectId],
            deliveryFormat: 'json',
            url: input.endpoint,
            headers: {
                'x-cencori-edge-secret': input.ingestSecret,
            },
        },
    });
}

export function createVercelLogIngestSecret(input: {
    integrationId: string;
    organizationId: string;
}): string {
    const secret = process.env.ENCRYPTION_SECRET || 'default-secret-change-in-production';
    return createHmac('sha256', secret)
        .update(`${input.organizationId}:${input.integrationId}:vercel-log-ingest`)
        .digest('hex');
}

export function buildVercelLogIngestUrl(integrationId: string, originFallback?: string): string {
    const baseUrl = getAppBaseUrl(originFallback);
    if (!baseUrl) {
        throw new Error('Public app URL is not configured');
    }

    return `${baseUrl}/api/internal/edge-integrations/vercel/logs/${integrationId}`;
}

export function buildVercelWebhookUrl(integrationId: string, originFallback?: string): string {
    const baseUrl = getAppBaseUrl(originFallback);
    if (!baseUrl) {
        throw new Error('Public app URL is not configured');
    }

    return `${baseUrl}/api/edge-integrations/vercel/webhook`;
}

export async function createVercelWebhook(input: {
    accessToken: string;
    teamId?: string | null;
    projectId: string;
    url: string;
}): Promise<VercelWebhook> {
    return vercelApiRequest<VercelWebhook>({
        accessToken: input.accessToken,
        path: '/v1/webhooks',
        method: 'POST',
        teamId: input.teamId,
        body: {
            name: 'Cencori Deployments',
            url: input.url,
            projectIds: [input.projectId],
            events: [
                'deployment.created',
                'deployment.succeeded',
                'deployment.error',
                'deployment.canceled',
                'deployment.promoted',
                'project.domain-created',
                'project.domain-updated',
                'project.domain-deleted',
                'project.domain-verified',
                'project.domain-unverified',
            ],
        },
    });
}

function mapDeploymentEnvironment(target?: string | null): EdgeEnvironment {
    if (target === 'production') {
        return 'production';
    }

    if (target === 'development') {
        return 'development';
    }

    return 'preview';
}

function mapDeploymentStatus(readyState?: string | null): 'created' | 'building' | 'ready' | 'error' | 'canceled' | 'promoted' {
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

function toIsoDate(value: number | null | undefined): string | null {
    return typeof value === 'number' && Number.isFinite(value)
        ? new Date(value).toISOString()
        : null;
}

function readCommitRef(meta?: Record<string, string>): string | null {
    if (!meta) return null;

    return meta.githubCommitRef
        || meta.gitlabCommitRef
        || meta.bitbucketCommitRef
        || meta.commitRef
        || null;
}

function readCommitSha(meta?: Record<string, string>): string | null {
    if (!meta) return null;

    return meta.githubCommitSha
        || meta.gitlabCommitSha
        || meta.bitbucketCommitSha
        || meta.commitSha
        || null;
}

export function normalizeVercelDomains(domains: VercelProjectDomain[]): Array<{
    domain: string;
    environment: EdgeEnvironment;
    isPrimary: boolean;
    metadata: Record<string, unknown>;
}> {
    const mapped = domains
        .map((domain) => {
            const environment: EdgeEnvironment =
                domain.gitBranch
                    ? 'preview'
                    : domain.name.includes('-git-') && domain.name.endsWith('.vercel.app')
                        ? 'preview'
                        : 'production';

            return {
                domain: domain.name,
                environment,
                isPrimary: false,
                metadata: {
                    gitBranch: domain.gitBranch || null,
                    redirect: domain.redirect || null,
                    customEnvironmentId: domain.customEnvironmentId || null,
                    updatedAt: toIsoDate(domain.updatedAt),
                },
            };
        })
        .sort((left, right) => {
            if (left.environment === right.environment) return left.domain.localeCompare(right.domain);
            return left.environment === 'production' ? -1 : 1;
        });

    const primaryProductionIndex = mapped.findIndex((domain) => domain.environment === 'production');
    if (primaryProductionIndex >= 0) {
        mapped[primaryProductionIndex].isPrimary = true;
    }

    return mapped;
}

export function normalizeLatestVercelDeployment(project: VercelProject): VercelProvisioningArtifacts['latestDeployment'] {
    const latestDeployment = Array.isArray(project.latestDeployments) ? project.latestDeployments[0] : null;
    if (!latestDeployment?.id) {
        return null;
    }

    const branchUrl = Array.isArray(latestDeployment.alias) && latestDeployment.alias.length > 0
        ? latestDeployment.alias[0]
        : null;

    return {
        externalDeploymentId: latestDeployment.id,
        environment: mapDeploymentEnvironment(latestDeployment.target),
        status: mapDeploymentStatus(latestDeployment.readyState),
        deploymentUrl: latestDeployment.url || null,
        branchUrl,
        commitSha: readCommitSha(latestDeployment.meta),
        commitRef: readCommitRef(latestDeployment.meta),
        metadata: {
            alias: latestDeployment.alias || [],
            readyState: latestDeployment.readyState || null,
            target: latestDeployment.target || null,
        },
        startedAt: toIsoDate(latestDeployment.createdAt),
        readyAt: toIsoDate(latestDeployment.ready),
    };
}
