import type { NextRequest } from 'next/server';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { ProviderRouter } from '@/lib/providers/router';
import { resolveCustomProviderForProject } from '@/lib/providers/custom-provider-routing';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Control-plane reads, cancellation, and configuration must not require AI credits. */
export function isMeteredGatewayRequest(method: string, pathname: string): boolean {
    if (method !== 'POST') return false;
    if (pathname.startsWith('/api/ai/')) return pathname !== '/api/ai/moderation';
    if (pathname === '/api/v1/chat/completions' || pathname === '/api/v1/responses') return true;
    if (pathname === '/api/memory/store' || pathname === '/api/memory/search') return true;
    if (/^\/api\/v1\/memory\/(remember|write|search)$/.test(pathname)) return true;
    if (/^\/api\/v1\/sessions\/[^/]+\/(turns|approve)$/.test(pathname)) return true;
    if (/^\/api\/v1\/agents\/[^/]+\/runs$/.test(pathname)) return true;
    if (/^\/api\/v1\/agents\/[^/]+\/versions\/[^/]+\/test$/.test(pathname)) return true;
    if (/^\/api\/v1\/knowledge-bases\/[^/]+\/search$/.test(pathname)) return true;
    return pathname === '/api/v1/web/browse';
}

/**
 * Only bypass the zero-credit preflight when the request identifies a provider
 * whose active project key can be proven before the provider call. Ambiguous or
 * multi-provider operations fail closed; they must not silently use a managed
 * fallback against an empty wallet.
 */
export async function isProvenByokRequest(params: {
    req: NextRequest;
    supabase: AdminClient;
    projectId: string;
    organizationId: string;
    defaultModel: string | null;
    agentId?: string | null;
}): Promise<boolean> {
    const pathname = params.req.nextUrl.pathname;
    const supported = pathname === '/api/ai/chat'
        || pathname === '/api/ai/completions'
        || pathname === '/api/v1/chat/completions'
        || pathname === '/api/v1/responses'
        || pathname === '/api/ai/embeddings'
        || pathname === '/api/ai/images/generate'
        || pathname === '/api/ai/audio/speech'
        || pathname.startsWith('/api/ai/vision');
    if (!supported || params.agentId) return false;

    let body: Record<string, unknown>;
    try {
        const parsed: unknown = await params.req.clone().json();
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
        body = parsed as Record<string, unknown>;
    } catch {
        return false;
    }
    if (body.agent_id || body.agentId || body.agent) return false;

    const explicitModel = typeof body.model === 'string' && body.model.trim()
        ? body.model.trim() : null;
    const defaultModel = pathname === '/api/ai/embeddings'
        ? 'text-embedding-3-small'
        : pathname === '/api/ai/audio/speech'
            ? 'tts-1'
            : pathname === '/api/ai/images/generate'
                ? 'gpt-image-1'
                : pathname.startsWith('/api/ai/vision')
                    ? 'gpt-4o-mini'
                : params.defaultModel;
    const model = explicitModel || defaultModel;
    if (!model) return false;

    try {
        if (pathname === '/api/ai/chat'
            || pathname === '/api/ai/completions'
            || pathname === '/api/v1/chat/completions'
            || pathname === '/api/v1/responses') {
            const custom = await resolveCustomProviderForProject({
                supabase: params.supabase,
                projectId: params.projectId,
                organizationId: params.organizationId,
                requestedModel: model,
            });
            if (custom) {
                return Boolean(custom.apiKey) || custom.apiFormat !== 'anthropic';
            }
        }

        const provider = pathname === '/api/ai/audio/speech' && typeof body.provider === 'string'
            ? body.provider
            : pathname === '/api/ai/images/generate'
                ? /gemini|imagen|nano.?banana/i.test(model) ? 'google' : 'openai'
                : pathname.startsWith('/api/ai/vision') && /^o[13]/i.test(model)
                    ? 'openai'
                    : new ProviderRouter().detectProvider(model);
        const { data, error } = await params.supabase
            .from('provider_keys')
            .select('encrypted_key, is_active')
            .eq('project_id', params.projectId)
            .eq('provider', provider)
            .eq('is_active', true)
            .maybeSingle();
        return !error && Boolean(data?.encrypted_key && data.is_active);
    } catch {
        return false;
    }
}
