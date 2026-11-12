import type { NextRequest } from 'next/server';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { ProviderRouter } from '@/lib/providers/router';
import { resolveCustomProviderForProject } from '@/lib/providers/custom-provider-routing';
import { isAutoRouterModel } from '@/lib/gateway/auto-router';
import { resolveProviderKeyRow } from '@/lib/providers/byok-store';
import { canonicalGatewayPath } from '@/lib/gateway/canonical-path';
import { memoryEmbedsOnOwnKey } from '@/lib/memory/embeddings';

const MEMORY_EMBEDDING_PATH = /^\/api\/v1\/(memory\/(remember|write|search)|knowledge-bases\/[^/]+\/search)$/;
const SESSION_TURN_PATH = /^\/api\/v1\/sessions\/([^/]+)\/turns$/;

type AdminClient = ReturnType<typeof createAdminClient>;

/** Control-plane reads, cancellation, and configuration must not require AI credits. */
export function isMeteredGatewayRequest(method: string, requestPath: string): boolean {
    if (method !== 'POST') return false;
    // `/v1/...` and the path it is served from are the same endpoint.
    const pathname = canonicalGatewayPath(requestPath);
    if (pathname.startsWith('/api/ai/')) return pathname !== '/api/ai/moderation';
    if (pathname === '/api/v1/chat/completions' || pathname === '/api/v1/responses') return true;
    if (pathname === '/api/memory/store' || pathname === '/api/memory/search') return true;
    if (/^\/api\/v1\/memory\/(remember|write|search)$/.test(pathname)) return true;
    if (/^\/api\/v1\/sessions\/[^/]+\/(turns|approve)$/.test(pathname)) return true;
    if (/^\/api\/v1\/agents\/[^/]+\/runs$/.test(pathname)) return true;
    if (/^\/api\/v1\/agents\/[^/]+\/versions\/[^/]+\/test$/.test(pathname)) return true;
    if (/^\/api\/v1\/knowledge-bases\/[^/]+\/search$/.test(pathname)) return true;
    // Cencori Web is priced per call (lib/web/pricing.ts); takedown requests are free.
    return /^\/api\/v1\/web\/(search|fetch|extract|crawl|browse)$/.test(pathname);
}

/**
 * Endpoints whose model call goes through the chat executor, which checks the
 * wallet again against the key it actually resolved (and against every
 * fallback it tries). A request here that can't be judged up front is safe to
 * let through: a managed call on an empty wallet is still refused there.
 */
export function settlesCreditsAtExecution(requestPath: string): boolean {
    const pathname = canonicalGatewayPath(requestPath);
    return pathname === '/api/ai/chat'
        || pathname === '/api/ai/completions'
        || pathname === '/api/v1/chat/completions'
        || pathname === '/api/v1/responses'
        || /^\/api\/v1\/sessions\/[^/]+\/(turns|approve)$/.test(pathname)
        || /^\/api\/v1\/agents\/[^/]+\/runs$/.test(pathname)
        || /^\/api\/v1\/agents\/[^/]+\/versions\/[^/]+\/test$/.test(pathname);
}

type ByokParams = {
    req: NextRequest;
    supabase: AdminClient;
    projectId: string;
    organizationId: string;
    defaultModel: string | null;
    agentId?: string | null;
};

/** True only when the request names a provider the project holds an active key for. */
export async function isProvenByokRequest(params: ByokParams): Promise<boolean> {
    return await byokVerdict(params) === 'byok';
}

/**
 * Whether a metered request may go ahead with an empty wallet. A call proven
 * to run on the project's own key always may. One that can't be judged here
 * (a stored agent picks the model, not the request) may only where the
 * executor settles it; everywhere else it fails closed, so an ambiguous
 * operation never quietly runs on a managed key against an empty wallet.
 */
export async function mayProceedOnEmptyWallet(params: ByokParams): Promise<boolean> {
    const verdict = await byokVerdict(params);
    if (verdict === 'byok') return true;
    return verdict === 'unknown' && settlesCreditsAtExecution(params.req.nextUrl.pathname);
}

/**
 * 'byok': the request names a provider whose active project key can be proven
 * before the provider call. 'managed': it names one the project has no key
 * for. 'unknown': the model isn't decided by the request.
 */
async function byokVerdict(params: ByokParams): Promise<'byok' | 'managed' | 'unknown'> {
    const pathname = canonicalGatewayPath(params.req.nextUrl.pathname);
    const sessionId = SESSION_TURN_PATH.exec(pathname)?.[1] ?? null;
    // Memory and knowledge-base calls spend on one thing the executor doesn't
    // settle: the embedding. That runs on the project's own key or it doesn't.
    if (MEMORY_EMBEDDING_PATH.test(pathname)) {
        try {
            return await memoryEmbedsOnOwnKey(params.supabase as never, params.projectId) ? 'byok' : 'managed';
        } catch {
            return 'managed';
        }
    }
    const supported = Boolean(sessionId)
        || pathname === '/api/ai/chat'
        || pathname === '/api/ai/completions'
        || pathname === '/api/v1/chat/completions'
        || pathname === '/api/v1/responses'
        || pathname === '/api/ai/embeddings'
        || pathname === '/api/ai/images/generate'
        || pathname === '/api/ai/audio/speech'
        || pathname.startsWith('/api/ai/vision');
    if (!supported || params.agentId) return 'unknown';
    // A request that names no model it could be judged by proves nothing.
    const unreadable = 'managed' as const;

    let body: Record<string, unknown>;
    try {
        const parsed: unknown = await params.req.clone().json();
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return unreadable;
        body = parsed as Record<string, unknown>;
    } catch {
        return unreadable;
    }
    if (body.agent_id || body.agentId || body.agent) return 'unknown';

    // A turn in a session bound to a stored agent or an installation runs that
    // agent's model, not the body's, so only a plain session can be proven here.
    if (sessionId) {
        try {
            const { data: session, error } = await params.supabase
                .from('sessions')
                .select('agent_id, installation_id')
                .eq('id', sessionId)
                .eq('project_id', params.projectId)
                .maybeSingle();
            if (error || !session || session.agent_id || session.installation_id) return 'unknown';
        } catch {
            return 'unknown';
        }
    }

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
    if (!model) return unreadable;

    // Auto-router is BYOK-only and fails closed with 402 `byok_required`
    // when no key exists. Bypass the generic zero-balance block so the caller
    // gets the actionable BYOK message instead of `credit_balance_exhausted`.
    // Chat tasks classify from the prompt; embeddings/images/audio tasks are
    // endpoint-implied (`embed` / `image` / `speech`) in their routes.
    if (isAutoRouterModel(model)) {
        return 'byok';
    }

    try {
        if (sessionId
            || pathname === '/api/ai/chat'
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
                return Boolean(custom.apiKey) || custom.apiFormat !== 'anthropic' ? 'byok' : 'managed';
            }
        }

        const provider = pathname === '/api/ai/audio/speech' && typeof body.provider === 'string'
            ? body.provider
            : pathname === '/api/ai/images/generate'
                ? /gemini|imagen|nano.?banana/i.test(model) ? 'google' : 'openai'
                : pathname.startsWith('/api/ai/vision') && /^o[13]/i.test(model)
                    ? 'openai'
                    : new ProviderRouter().detectProvider(model);
        // The same lookup the gateway runs when it picks the key for the call:
        // a key saved in the console, else one added through the API
        // (provider_connections). Reading only the first refused calls the
        // gateway would have served with the customer's own key.
        const key = await resolveProviderKeyRow(params.supabase, { projectId: params.projectId, provider });
        return key?.row.encrypted_key ? 'byok' : 'managed';
    } catch {
        return 'managed';
    }
}
