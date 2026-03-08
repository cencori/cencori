import type { EdgeProvider } from './types';

export interface EdgeProviderDefinition {
    id: EdgeProvider;
    name: string;
    tagline: string;
    description: string;
    availability: 'active' | 'planned';
    features: string[];
}

export const EDGE_PROVIDER_DEFINITIONS: EdgeProviderDefinition[] = [
    {
        id: 'vercel',
        name: 'Vercel',
        tagline: 'Zero-code HTTP traffic and deployment sync',
        description: 'Connect a Vercel project to Cencori so HTTP traffic, domains, and deployments can sync into a single observability plane.',
        availability: 'active',
        features: [
            'Project linking foundation',
            'HTTP traffic sync model',
            'Deployment and domain model',
        ],
    },
    {
        id: 'supabase',
        name: 'Supabase',
        tagline: 'Edge functions and hosted domains',
        description: 'Connect Supabase projects later without changing the internal observability model.',
        availability: 'planned',
        features: [
            'Edge function traffic',
            'Project domains',
            'Deployment-aware observability',
        ],
    },
    {
        id: 'cloudflare',
        name: 'Cloudflare',
        tagline: 'Workers and edge runtime telemetry',
        description: 'Normalize Cloudflare Workers traffic into the same HTTP traffic plane and deployment model.',
        availability: 'planned',
        features: [
            'Workers request telemetry',
            'Domain sync',
            'Runtime metadata normalization',
        ],
    },
    {
        id: 'aws',
        name: 'AWS',
        tagline: 'Lambda and API edge metadata',
        description: 'Map Lambda and API Gateway traffic into the shared edge integration model when AWS is added.',
        availability: 'planned',
        features: [
            'Lambda / API Gateway mapping',
            'Deployment snapshots',
            'Domain and stage sync',
        ],
    },
    {
        id: 'azure',
        name: 'Azure',
        tagline: 'Functions and platform deployments',
        description: 'Keep Azure as another adapter into the same project-linked HTTP traffic and deployment system.',
        availability: 'planned',
        features: [
            'Functions telemetry',
            'Deployment normalization',
            'Custom domain sync',
        ],
    },
    {
        id: 'gcp',
        name: 'Google Cloud',
        tagline: 'Cloud Run and Functions coverage',
        description: 'Add Google Cloud later as another source of normalized HTTP traffic, domains, and deployments.',
        availability: 'planned',
        features: [
            'Cloud Run / Functions telemetry',
            'Revision metadata',
            'Domain inventory',
        ],
    },
];

export function getEdgeProviderDefinition(provider: EdgeProvider): EdgeProviderDefinition | undefined {
    return EDGE_PROVIDER_DEFINITIONS.find((definition) => definition.id === provider);
}
