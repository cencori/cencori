import { NextResponse } from 'next/server';

interface ProviderHealth {
    name: string;
    status: 'healthy' | 'degraded' | 'down';
    latency: number | null;
    error?: string;
}

// Provider API endpoints to ping (using their models endpoints)
const PROVIDERS = [
    {
        name: 'OpenAI',
        url: 'https://api.openai.com/v1/models',
        envKey: 'OPENAI_API_KEY',
    },
    {
        name: 'Anthropic',
        url: 'https://api.anthropic.com/v1/messages',
        envKey: 'ANTHROPIC_API_KEY',
        headers: { 'anthropic-version': '2023-06-01' },
    },
    {
        name: 'Google AI',
        url: 'https://generativelanguage.googleapis.com/v1beta/models',
        envKey: 'GOOGLE_AI_API_KEY',
        useQueryParam: true,
    },
];

async function pingProvider(provider: typeof PROVIDERS[0]): Promise<ProviderHealth> {
    const apiKey = process.env[provider.envKey];

    if (!apiKey) {
        return {
            name: provider.name,
            status: 'down',
            latency: null,
            error: 'API key not configured',
        };
    }

    const start = Date.now();

    try {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            ...provider.headers,
        };

        // Anthropic uses x-api-key instead of Bearer
        if (provider.name === 'Anthropic') {
            headers['x-api-key'] = apiKey;
            delete headers['Authorization'];
        }

        let url = provider.url;
        if (provider.useQueryParam) {
            url = `${provider.url}?key=${apiKey}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(5000), // 5s timeout
        });

        const latency = Date.now() - start;

        if (response.ok || response.status === 401 || response.status === 403) {
            // 401/403 means the endpoint is reachable, just auth issue (which is fine for ping)
            return {
                name: provider.name,
                status: latency > 500 ? 'degraded' : 'healthy',
                latency,
            };
        }

        return {
            name: provider.name,
            status: 'degraded',
            latency,
            error: `HTTP ${response.status}`,
        };
    } catch (error) {
        const latency = Date.now() - start;
        return {
            name: provider.name,
            status: 'down',
            latency: latency > 5000 ? null : latency,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// GET - Check health of all AI providers
export async function GET() {
    const results = await Promise.all(PROVIDERS.map(pingProvider));

    return NextResponse.json({
        providers: results,
        checked_at: new Date().toISOString(),
    });
}
