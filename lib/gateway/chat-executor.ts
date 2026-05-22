import type { createAdminClient } from '@/lib/supabaseAdmin';
import {
    type UnifiedChatRequest,
    type UnifiedChatResponse,
    type UnifiedMessage,
    type StreamChunk,
    type ToolCall,
} from '@/lib/providers/base';
import { isCircuitOpen, recordSuccess, recordFailure } from '@/lib/providers/circuit-breaker';
import { getFallbackChain, getFallbackModel, isNonRetryableError } from '@/lib/providers/failover';
import { triggerFallbackWebhook } from '@/lib/webhooks';
import { hasFeature, type SubscriptionTier } from '@/lib/entitlements';
import {
    resolveGatewayProvider,
    initializeBYOKProviders,
    type ResolvedGatewayProvider,
} from '@/lib/gateway/providers-setup';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type GatewayChatExecutionMeta = {
    actualProvider: string;
    actualModel: string;
    usedFallback: boolean;
    originalProvider: string;
    originalModel: string;
};

export type GatewayStreamChunk = StreamChunk & GatewayChatExecutionMeta;

async function loadFailoverSettings(supabase: SupabaseAdmin, projectId: string) {
    const { data } = await supabase
        .from('project_settings')
        .select('enable_fallback, fallback_provider, max_retries_before_fallback')
        .eq('project_id', projectId)
        .single();

    return {
        enableFallback: data?.enable_fallback ?? true,
        configuredFallback: data?.fallback_provider as string | null | undefined,
        maxRetries: data?.max_retries_before_fallback ?? 3,
    };
}

/**
 * Non-streaming chat with retries + optional provider failover.
 */
export async function executeGatewayChat(params: {
    supabase: SupabaseAdmin;
    projectId: string;
    organizationId: string;
    tier: SubscriptionTier;
    request: UnifiedChatRequest;
    resolved?: ResolvedGatewayProvider;
}): Promise<UnifiedChatResponse & GatewayChatExecutionMeta> {
    const resolved =
        params.resolved ??
        (await resolveGatewayProvider({
            supabase: params.supabase,
            projectId: params.projectId,
            organizationId: params.organizationId,
            requestedModel: params.request.model,
        }));

    const { providerName, model, provider, router } = resolved;
    const chatRequest: UnifiedChatRequest = { ...params.request, model };
    const failoverAllowed = hasFeature(params.tier, 'failover');
    const settings = await loadFailoverSettings(params.supabase, params.projectId);

    let actualProvider = providerName;
    let actualModel = model;
    let usedFallback = false;
    let lastError: Error | null = null;

    if (failoverAllowed && (await isCircuitOpen(providerName))) {
        lastError = new Error(`Provider ${providerName} circuit is open`);
    } else {
        const maxRetries = failoverAllowed ? settings.maxRetries : 1;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await provider.chat(chatRequest);
                await recordSuccess(providerName);
                return {
                    ...response,
                    actualProvider,
                    actualModel,
                    usedFallback,
                    originalProvider: providerName,
                    originalModel: model,
                };
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.warn(
                    `[Gateway/Failover] Attempt ${attempt + 1}/${maxRetries} failed for ${providerName}:`,
                    lastError.message
                );
                if (isNonRetryableError(error)) throw error;
                await recordFailure(providerName);
                if (attempt < maxRetries - 1) {
                    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100));
                }
            }
        }
    }

    if (!failoverAllowed || !settings.enableFallback || !lastError) {
        throw lastError || new Error('Chat request failed');
    }

    const fallbackChain = getFallbackChain(providerName, settings.configuredFallback);
    for (const fallbackProviderName of fallbackChain) {
        if (await isCircuitOpen(fallbackProviderName)) continue;

        if (!router.hasProvider(fallbackProviderName)) {
            const initialized = await initializeBYOKProviders(
                router,
                params.supabase,
                params.projectId,
                params.organizationId,
                fallbackProviderName
            );
            if (!initialized.success) continue;
        }

        try {
            const fallbackProvider = router.getProvider(fallbackProviderName);
            const fallbackModel = await getFallbackModel(model, fallbackProviderName);
            const response = await fallbackProvider.chat({
                ...chatRequest,
                model: fallbackModel,
            });
            await recordSuccess(fallbackProviderName);

            void triggerFallbackWebhook(params.projectId, {
                original_provider: providerName,
                original_model: model,
                fallback_provider: fallbackProviderName,
                fallback_model: fallbackModel,
                reason: lastError.message,
            });

            return {
                ...response,
                actualProvider: fallbackProviderName,
                actualModel: fallbackModel,
                usedFallback: true,
                originalProvider: providerName,
                originalModel: model,
            };
        } catch (fallbackError) {
            console.warn(`[Gateway/Failover] Fallback ${fallbackProviderName} failed:`, fallbackError);
            await recordFailure(fallbackProviderName);
        }
    }

    throw lastError;
}

/**
 * Streaming chat with retries + optional provider failover.
 */
export async function* streamGatewayChat(params: {
    supabase: SupabaseAdmin;
    projectId: string;
    organizationId: string;
    tier: SubscriptionTier;
    request: UnifiedChatRequest;
    resolved?: ResolvedGatewayProvider;
}): AsyncGenerator<GatewayStreamChunk> {
    const resolved =
        params.resolved ??
        (await resolveGatewayProvider({
            supabase: params.supabase,
            projectId: params.projectId,
            organizationId: params.organizationId,
            requestedModel: params.request.model,
        }));

    const { providerName, model, provider, router } = resolved;
    const chatRequest: UnifiedChatRequest = { ...params.request, model };
    const failoverAllowed = hasFeature(params.tier, 'failover');
    const settings = await loadFailoverSettings(params.supabase, params.projectId);

    let actualProvider = providerName;
    let actualModel = model;
    let usedFallback = false;
    let lastError: Error | null = null;

    async function* runPrimary(): AsyncGenerator<GatewayStreamChunk> {
        const stream = provider.stream(chatRequest);
        for await (const chunk of stream) {
            yield {
                ...chunk,
                actualProvider,
                actualModel,
                usedFallback,
                originalProvider: providerName,
                originalModel: model,
            };
        }
    }

    if (!(await isCircuitOpen(providerName))) {
        const maxRetries = failoverAllowed ? settings.maxRetries : 1;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                for await (const chunk of runPrimary()) {
                    yield chunk;
                }
                await recordSuccess(providerName);
                return;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (isNonRetryableError(error)) throw error;
                await recordFailure(providerName);
                if (attempt < maxRetries - 1) {
                    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100));
                }
            }
        }
    } else {
        lastError = new Error(`Provider ${providerName} circuit is open`);
    }

    if (!failoverAllowed || !settings.enableFallback || !lastError) {
        throw lastError || new Error('Stream request failed');
    }

    const fallbackChain = getFallbackChain(providerName, settings.configuredFallback);
    for (const fallbackProviderName of fallbackChain) {
        if (await isCircuitOpen(fallbackProviderName)) continue;

        if (!router.hasProvider(fallbackProviderName)) {
            const initialized = await initializeBYOKProviders(
                router,
                params.supabase,
                params.projectId,
                params.organizationId,
                fallbackProviderName
            );
            if (!initialized.success) continue;
        }

        try {
            const fallbackProvider = router.getProvider(fallbackProviderName);
            const fallbackModel = await getFallbackModel(model, fallbackProviderName);
            actualProvider = fallbackProviderName;
            actualModel = fallbackModel;
            usedFallback = true;

            const stream = fallbackProvider.stream({ ...chatRequest, model: fallbackModel });
            for await (const chunk of stream) {
                yield {
                    ...chunk,
                    actualProvider,
                    actualModel,
                    usedFallback,
                    originalProvider: providerName,
                    originalModel: model,
                };
            }

            await recordSuccess(fallbackProviderName);
            void triggerFallbackWebhook(params.projectId, {
                original_provider: providerName,
                original_model: model,
                fallback_provider: fallbackProviderName,
                fallback_model: fallbackModel,
                reason: lastError.message,
            });
            return;
        } catch (fallbackError) {
            console.warn(`[Gateway/Failover/Stream] Fallback ${fallbackProviderName} failed:`, fallbackError);
            await recordFailure(fallbackProviderName);
        }
    }

    throw lastError;
}
