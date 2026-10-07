import type { createAdminClient } from '@/lib/supabaseAdmin';
import type { ProviderTransportOptions } from '@/lib/providers/base';
import {
    GeminiProvider,
    OpenAIProvider,
    AnthropicProvider,
    OpenAICompatibleProvider,
    CohereProvider,
    isOpenAICompatible,
} from '@/lib/providers';
import { ProviderRouter } from '@/lib/providers/router';
import { decryptApiKey } from '@/lib/encryption';
import { applyPinnedConnection, registerByokKey, resolveProviderKeyRow } from '@/lib/providers/byok-store';
import { getGoogleApiKey } from '@/lib/providers/google-env';
import { resolveCustomProviderForProject } from '@/lib/providers/custom-provider-routing';
import type { AIProvider } from '@/lib/providers/base';
import { InvalidRequestError, ModelAccessDeniedError } from '@/lib/providers/errors';
import {
    assertApiKeyModelAccess,
    resolveProviderBillingMode,
    type GatewayBillingMode,
} from '@/lib/gateway/model-access';
import {
    getCachedProviderConfig,
    setCachedProviderConfig,
} from '@/lib/config-cache';
import {
    ByokRequiredError,
    candidatesForTask,
    classifyAutoTask,
    formatByokSetupHint,
    getActiveByokInventory,
    isAutoRouterModel,
    type AutoTask,
} from '@/lib/gateway/auto-router';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

const OPENAI_COMPATIBLE_ENV_VARS: Record<string, string[]> = {
    xai: ['XAI_API_KEY'],
    deepseek: ['DEEPSEEK_API_KEY'],
    groq: ['GROQ_API_KEY'],
    // Vercel AI Gateway (unified inference front door, zero markup). Key is
    // the AI Gateway API key (vck_…), billed as AI Gateway Credits on Vercel.
    vercel: ['AI_GATEWAY_API_KEY'],
    mistral: ['MISTRAL_API_KEY'],
    together: ['TOGETHER_API_KEY'],
    perplexity: ['PERPLEXITY_API_KEY'],
    huggingface: ['HUGGINGFACE_API_KEY'],
    // Moonshot AI (Kimi) direct key. Endpoint only for now — no catalog rows
    // until Kimi is re-homed off OpenRouter (removed 2026-09-23).
    moonshot: ['MOONSHOT_API_KEY'],
    zai: ['ZAI_API_KEY'],
    cerebras: ['CEREBRAS_API_KEY'],
    qwen: ['QWEN_API_KEY'],
    // Meta has no API of its own — OPENAI_COMPATIBLE_ENDPOINTS points its
    // models at Together, so it authenticates with the Together key.
    meta: ['TOGETHER_API_KEY'],
    // Support the historical deployment variable as well as the canonical one.
    maximo: ['MAXIMO_API_KEY', 'MAXIMOAI_API_KEY'],
    // Helix customer key (provisioned via the Launchverse partner secret).
    helix: ['HELIX_API_KEY'],
    // Centaur stealth-preview key (partner-provisioned, one-week window).
    centaur: ['CENTAUR_API_KEY'],
    // B.AI — backend provider for DeepSeek and GLM models rebranded under
    // their public-facing provider names (see MODEL_PROVIDER_OVERRIDES in
    // router.ts and the catalog entries in config.ts).
    bai: ['BAI_API_KEY'],
};

function firstConfiguredEnv(names: string[]): string | undefined {
    for (const name of names) {
        if (process.env[name]) return process.env[name];
    }
    return undefined;
}

/**
 * The managed (Cencori-funded) key for an OpenAI-compatible provider, if one is
 * deployed. Exported so the vision path resolves keys from the same table the
 * chat path does — a provider whose key variable is only known here would
 * otherwise look unconfigured to vision and fail with a misleading message.
 */
export function getManagedOpenAICompatibleKey(provider: string): string | undefined {
    const envVars = OPENAI_COMPATIBLE_ENV_VARS[provider];
    return envVars ? firstConfiguredEnv(envVars) : undefined;
}

export function getManagedProviderNames(): Set<string> {
    const providers = new Set<string>();
    if (getGoogleApiKey()) providers.add('google');
    if (process.env.OPENAI_API_KEY) providers.add('openai');
    if (process.env.ANTHROPIC_API_KEY) providers.add('anthropic');
    if (process.env.COHERE_API_KEY) providers.add('cohere');
    for (const [provider, envVars] of Object.entries(OPENAI_COMPATIBLE_ENV_VARS)) {
        if (firstConfiguredEnv(envVars)) providers.add(provider);
    }
    return providers;
}

export function registerDefaultProviders(router: ProviderRouter, transport?: ProviderTransportOptions): void {
    const defaultGoogleApiKey = getGoogleApiKey();
    if (!router.hasProvider('google') && defaultGoogleApiKey) {
        try {
            router.registerProvider('google', new GeminiProvider(defaultGoogleApiKey, transport));
        } catch (error) {
            console.warn('[Gateway] Gemini provider not available:', error);
        }
    }

    if (!router.hasProvider('openai') && process.env.OPENAI_API_KEY) {
        try {
            router.registerProvider('openai', new OpenAIProvider(undefined, transport));
        } catch (error) {
            console.warn('[Gateway] OpenAI provider not available:', error);
        }
    }

    if (!router.hasProvider('anthropic') && process.env.ANTHROPIC_API_KEY) {
        try {
            router.registerProvider('anthropic', new AnthropicProvider(undefined, transport ? { transport } : undefined));
        } catch (error) {
            console.warn('[Gateway] Anthropic provider not available:', error);
        }
    }

    if (!router.hasProvider('cohere') && process.env.COHERE_API_KEY) {
        try {
            router.registerProvider('cohere', new CohereProvider(process.env.COHERE_API_KEY, transport));
        } catch (error) {
            console.warn('[Gateway] Cohere provider not available:', error);
        }
    }

    for (const [provider, envVars] of Object.entries(OPENAI_COMPATIBLE_ENV_VARS)) {
        const apiKey = firstConfiguredEnv(envVars);
        if (!router.hasProvider(provider) && apiKey) {
            try {
                router.registerProvider(provider, new OpenAICompatibleProvider(provider, apiKey, undefined, undefined, transport));
            } catch (error) {
                console.warn(`[Gateway] ${provider} provider not available:`, error);
            }
        }
    }
}

export async function initializeBYOKProviders(
    router: ProviderRouter,
    supabase: SupabaseAdmin,
    projectId: string,
    organizationId: string,
    targetProvider: string,
    transport?: ProviderTransportOptions
): Promise<{ success: boolean; usesByok: boolean; defaultModel?: string }> {
    try {
        const cached = await getCachedProviderConfig(projectId, targetProvider);
        let providerKey = cached?.row;
        if (!cached) {
            // Unified read: dashboard row first, newest usable embedded
            // connection as fallback — one surface for both key stores.
            // Cache misses too: managed-provider projects should not query
            // the BYOK tables on every inference.
            const resolved = await resolveProviderKeyRow(supabase as never, {
                projectId,
                provider: targetProvider,
            });
            providerKey = resolved?.row ?? null;
            void setCachedProviderConfig(projectId, targetProvider, providerKey);
        }

        if (providerKey && providerKey.is_active) {
            const apiKey = decryptApiKey(providerKey.encrypted_key, organizationId);
            if (registerByokKey(router, targetProvider, apiKey, transport)) {
                return { success: true, usesByok: true, defaultModel: providerKey.default_model || undefined };
            }
        }

        if (router.hasProvider(targetProvider)) {
            return { success: true, usesByok: false };
        }

        return { success: false, usesByok: false };
    } catch (error) {
        console.error(`[Gateway] Failed to initialize BYOK provider ${targetProvider}:`, error);
        return { success: router.hasProvider(targetProvider), usesByok: false };
    }
}

export type ResolvedGatewayProvider = {
    router: ProviderRouter;
    providerName: string;
    model: string;
    provider: AIProvider;
    billingMode: GatewayBillingMode;
    customProviderTag?: string;
    /**
     * Set for `auto` / `cencori-auto` resolutions. Fallback must stay
     * BYOK-only: never fall back to a managed (credit-billed) provider.
     */
    byokOnly?: boolean;
    autoRouted?: {
        requestedModel: string;
        task: AutoTask;
        providerName: string;
        model: string;
    };
};

export type AutoRouterInput = {
    text?: string | null;
    tools?: unknown[] | null;
    hasImage?: boolean;
};

const TENSOR_OPEN_WEIGHT_MODEL_MARKERS = [
    'deepseek',
    'glm-',
    'qwen',
    'kimi',
    'llama',
    'mistral',
    'devstral',
    'nemotron',
    'gpt-oss',
    'maximo-atlas',
];

const TENSOR_AUTO_ALLOWED_MODEL_MARKERS = [
    'deepseek-v4-flash',
    'maximo-atlas-1.3',
    'maximo-atlas-1.2',
];

export function resolveTensorPlanModel(
    requestedModel: string,
    policy: 'auto' | 'open_weight' | 'frontier' | 'custom' | null | undefined,
): string {
    if (!policy || policy === 'frontier' || policy === 'custom') return requestedModel;

    const normalized = requestedModel.trim().toLowerCase();
    const askedForAuto = !normalized || normalized === 'auto' || normalized === 'tensor-auto';
    const isOpenWeight = TENSOR_OPEN_WEIGHT_MODEL_MARKERS.some((marker) =>
        normalized.includes(marker),
    );
    const isAutoAllowed = TENSOR_AUTO_ALLOWED_MODEL_MARKERS.some((marker) =>
        normalized.includes(marker),
    );

    if (policy === 'auto') {
        const autoModel = process.env.TENSOR_AUTO_MODEL?.trim() || 'deepseek-v4-flash';
        if (askedForAuto) return autoModel;
        // Free/auto is request-counted, not cost-weighted, so it must stay pinned to
        // the cheap weak models (flash + atlas). Anything else — including expensive
        // open-weight like glm-5.3-flash — falls back to the server auto model
        // rather than blowing the free cost envelope.
        if (isAutoAllowed) return requestedModel;
        if (isOpenWeight) return autoModel;
        // A frontier model is not an error here, it is simply not on this plan, and the auto model
        // answers instead — which is what this policy did for every request before. Refusing would
        // break callers that have always been quietly substituted.
        return autoModel;
    }

    if (askedForAuto) {
        // GLM rather than DeepSeek: the DeepSeek quota is spent, so the old default resolved every
        // Builder Auto turn onto a model that cannot answer. The env var still overrides this.
        return process.env.TENSOR_BUILDER_AUTO_MODEL?.trim() || 'glm-5.3-flash';
    }
    if (!isOpenWeight) {
        throw new ModelAccessDeniedError('tensor-builder', requestedModel);
    }
    return requestedModel;
}

export async function resolveGatewayProvider(params: {
    supabase: SupabaseAdmin;
    projectId: string;
    organizationId: string;
    requestedModel: string;
    tensorModelPolicy?: 'auto' | 'open_weight' | 'frontier' | 'custom' | null;
    allowedModels?: string[] | null;
    sponsoredModels?: string[] | null;
    /**
     * Exact provider-connection pin from the agent manifest. Overrides
     * default BYOK resolution for the resolved provider; mismatches fail
     * closed here (rotation/deletion since publish must not silently fall
     * back to another key).
     */
    pinnedConnectionId?: string | null;
    /**
     * Task signals for `auto` / `cencori-auto`. Callers pass the already-
     * guarded message text, tools, and image presence so the router can pick
     * a task-appropriate BYOK model.
     */
    autoRouterInput?: AutoRouterInput | null;
    /**
     * First-class transport for every provider registered during resolution
     * (managed and BYOK). Lets agent runtimes attach their own fetch,
     * timeout, retry, and telemetry hooks instead of patching
     * `globalThis.fetch`.
     */
    transport?: ProviderTransportOptions;
}): Promise<ResolvedGatewayProvider> {
    // BYOK auto-router (`cencori-auto` / `cencori/auto`) is explicit and always
    // wins over the Tensor plan rewrite. Bare `auto` is ambiguous: Tensor
    // Desktop uses it for its server auto model, so with a Tensor policy it
    // follows the Tensor mapping; without one (or after mapping, when the
    // result is still auto-like) it is the BYOK router.
    const rawNormalized = params.requestedModel.trim().toLowerCase();
    const isExplicitCencoriAuto =
        rawNormalized === 'cencori-auto' || rawNormalized === 'cencori/auto';
    if (isExplicitCencoriAuto) {
        const router = new ProviderRouter();
        registerDefaultProviders(router, params.transport);
        return resolveAutoGatewayProvider({
            router,
            supabase: params.supabase,
            projectId: params.projectId,
            organizationId: params.organizationId,
            requestedModel: params.requestedModel.trim(),
            allowedModels: params.allowedModels,
            sponsoredModels: params.sponsoredModels,
            pinnedConnectionId: params.pinnedConnectionId ?? null,
            autoRouterInput: params.autoRouterInput ?? null,
            transport: params.transport,
        });
    }
    const requestedModel = resolveTensorPlanModel(
        params.requestedModel,
        params.tensorModelPolicy,
    );
    const router = new ProviderRouter();
    registerDefaultProviders(router, params.transport);

    if (isAutoRouterModel(requestedModel)) {
        return resolveAutoGatewayProvider({
            router,
            supabase: params.supabase,
            projectId: params.projectId,
            organizationId: params.organizationId,
            requestedModel,
            allowedModels: params.allowedModels,
            sponsoredModels: params.sponsoredModels,
            pinnedConnectionId: params.pinnedConnectionId ?? null,
            autoRouterInput: params.autoRouterInput ?? null,
            transport: params.transport,
        });
    }

    const customProvider = await resolveCustomProviderForProject({
        supabase: params.supabase,
        projectId: params.projectId,
        organizationId: params.organizationId,
        requestedModel,
    });

    let providerName: string;
    let model: string;
    let usesByok = Boolean(customProvider)
        && (Boolean(customProvider?.apiKey) || customProvider?.apiFormat !== 'anthropic');

    if (customProvider) {
        providerName = customProvider.providerTag;
        model = customProvider.upstreamModel;

        if (customProvider.apiFormat === 'anthropic' && !(customProvider.apiKey || process.env.ANTHROPIC_API_KEY)) {
            throw new Error(
                `Custom provider '${customProvider.name}' is missing an API key.`
            );
        }

        if (!router.hasProvider(providerName)) {
            const impl =
                customProvider.apiFormat === 'anthropic'
                    ? new AnthropicProvider(customProvider.apiKey || process.env.ANTHROPIC_API_KEY!, {
                          baseURL: customProvider.baseUrl,
                          pricing: customProvider.pricing,
                      })
                    : new OpenAICompatibleProvider(
                          providerName,
                          customProvider.apiKey || 'cencori-no-key',
                          customProvider.baseUrl,
                          customProvider.pricing,
                      );
            router.registerProvider(providerName, impl);
        }
    } else {
        providerName = router.detectProvider(requestedModel);
        model = router.normalizeModelName(requestedModel, providerName);

        const byokResult = await initializeBYOKProviders(
            router,
            params.supabase,
            params.projectId,
            params.organizationId,
            providerName,
            params.transport
        );
        usesByok = byokResult.usesByok;

        if (!byokResult.success) {
            registerDefaultProviders(router, params.transport);
        }

        if (params.pinnedConnectionId) {
            await applyPinnedConnection(router, params.supabase as never, {
                projectId: params.projectId,
                organizationId: params.organizationId,
                provider: providerName,
                connectionId: params.pinnedConnectionId,
            });
            usesByok = true;
        }
    }

    if (!router.hasProvider(providerName)) {
        throw new Error(
            `Provider '${providerName}' is not configured. Add your API key in project settings.`
        );
    }

    const provider = customProvider
        ? router.getProvider(providerName)
        : router.getProviderForModel(requestedModel);

    const accessMode = assertApiKeyModelAccess({
        allowedModels: params.allowedModels,
        sponsoredModels: params.sponsoredModels,
        provider: providerName,
        model,
    });
    const billingMode = resolveProviderBillingMode(accessMode, usesByok);

    // Verify exact billing configuration before any upstream request is made.
    // This prevents a successful provider call from later becoming an
    // unbillable response because a model was only covered by a guessed
    // provider-wide default.
    await provider.getPricing(model);

    return {
        router,
        providerName,
        model,
        provider,
        billingMode,
        customProviderTag: customProvider?.providerTag,
    };
}

/**
 * BYOK-only auto-router: `auto` / `cencori-auto` → concrete provider+model
 * chosen for the task, from the project's active BYOK keys only. Fails closed
 * with {@link ByokRequiredError} (402) when no BYOK key — or no priced,
 * allowed BYOK model — can serve the task. Never touches managed credit
 * billing: the resolved billing mode is always `byok` (or `sponsored`).
 */
async function resolveAutoGatewayProvider(args: {
    router: ProviderRouter;
    supabase: SupabaseAdmin;
    projectId: string;
    organizationId: string;
    requestedModel: string;
    allowedModels?: string[] | null;
    sponsoredModels?: string[] | null;
    pinnedConnectionId?: string | null;
    autoRouterInput?: AutoRouterInput | null;
    transport?: ProviderTransportOptions;
}): Promise<ResolvedGatewayProvider> {
    if (args.pinnedConnectionId) {
        throw new InvalidRequestError(
            'cencori',
            'Pinned provider connections cannot be combined with the auto-router. Use a concrete model with `connection_id` instead.',
        );
    }

    const task = classifyAutoTask({
        text: args.autoRouterInput?.text ?? null,
        tools: args.autoRouterInput?.tools ?? null,
        hasImage: args.autoRouterInput?.hasImage ?? false,
    });

    const inventory = await getActiveByokInventory(
        args.supabase as never,
        args.projectId,
    );
    if (inventory.providers.size === 0) {
        throw new ByokRequiredError(
            `Auto-router requires a BYOK key. ${formatByokSetupHint(inventory.providers)}`,
        );
    }

    const ranked = candidatesForTask(task).filter((c) =>
        inventory.providers.has(c.provider.toLowerCase()),
    );
    // Last resort: per-provider dashboard default models (user-verified to
    // work with their key), then any remaining BYOK provider is already
    // covered above. De-dupe while preserving rank order.
    const seen = new Set<string>();
    const ordered: { provider: string; model: string }[] = [];
    for (const c of ranked) {
        const key = `${c.provider.toLowerCase()}:${c.model.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        ordered.push(c);
    }
    for (const [provider, defaultModel] of inventory.defaultModels) {
        if (!inventory.providers.has(provider)) continue;
        const key = `${provider}:${defaultModel.trim().toLowerCase()}`;
        if (!defaultModel.trim() || seen.has(key)) continue;
        seen.add(key);
        ordered.push({ provider, model: defaultModel.trim() });
    }

    let lastPricingError: unknown = null;
    for (const candidate of ordered) {
        const providerName = candidate.provider.toLowerCase();
        const model = candidate.model;
        try {
            // Key-level allowlist still applies to auto: a restricted key must
            // not reach models outside its grant via the router.
            const accessMode = assertApiKeyModelAccess({
                allowedModels: args.allowedModels,
                sponsoredModels: args.sponsoredModels,
                provider: providerName,
                model,
            });
            const byokResult = await initializeBYOKProviders(
                args.router,
                args.supabase,
                args.projectId,
                args.organizationId,
                providerName,
                args.transport,
            );
            if (!byokResult.success || !byokResult.usesByok) continue;
            const provider = args.router.getProvider(providerName);
            await provider.getPricing(model);
            const billingMode = resolveProviderBillingMode(accessMode, true);
            return {
                router: args.router,
                providerName,
                model,
                provider,
                billingMode,
                byokOnly: true,
                autoRouted: {
                    requestedModel: args.requestedModel,
                    task,
                    providerName,
                    model,
                },
            };
        } catch (error) {
            if (error instanceof ByokRequiredError) throw error;
            // ModelAccessDenied (restricted key) and pricing gaps just skip to
            // the next BYOK candidate — the 402 below explains the outcome.
            lastPricingError = error;
            continue;
        }
    }

    const detail =
        lastPricingError instanceof Error
            ? ` Last error: ${lastPricingError.message}`
            : '';
    throw new ByokRequiredError(
        `Auto-router found BYOK key(s) for [${[...inventory.providers].sort().join(', ')}] but no priced, allowed model for '${task}' tasks.${detail} ${formatByokSetupHint(inventory.providers)}`,
    );
}
