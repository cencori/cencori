import type { ModelPricing, UnifiedChatResponse } from '@/lib/providers/base';
import { ModelAccessDeniedError } from '@/lib/providers/errors';
import { isExplicitlyFree } from '@/lib/providers/pricing';

export type GatewayBillingMode = 'standard' | 'sponsored' | 'byok';

export const ALL_MODELS_GRANT = '*';

// Models a key can only reach through an explicit allowlist grant. The
// restriction is per model, not per line: Atlas 1.2 ships generally available,
// while 1.1 stays gated under its existing arrangement.
const RESTRICTED_MODELS = new Set([
    'maximo:maximo-atlas-1.1',
    // Anthropic serves Mythos 5.1 only to its trusted-access program (vetted
    // cybersecurity and life-sciences professionals). Fable 5.1 is the same
    // model under general safeguards and stays open, so the restriction is on
    // the Mythos id alone.
    'anthropic:claude-mythos-5-1',
]);

export function canonicalModelKey(provider: string, model: string): string {
    return `${provider.trim().toLowerCase()}:${model.trim().toLowerCase()}`;
}

function canonicalSet(models: string[] | null | undefined): Set<string> {
    return new Set((models ?? []).map((model) => model.trim().toLowerCase()));
}

export function resolveApiKeyModelAccess(params: {
    allowedModels?: string[] | null;
    sponsoredModels?: string[] | null;
    provider: string;
    model: string;
}): { allowed: boolean; billingMode: GatewayBillingMode } {
    const key = canonicalModelKey(params.provider, params.model);
    const allowed = canonicalSet(params.allowedModels);
    const sponsored = canonicalSet(params.sponsoredModels);
    const hasExplicitAllowlist = Array.isArray(params.allowedModels);
    const grantsEveryModel = allowed.has(ALL_MODELS_GRANT);
    // An allowlist scopes which models a key may reach. The free catalog used to
    // stay open to every key that was not fully closed; it was retired
    // 2026-09-23, so an allowlist is now the only grant. An empty array still
    // permits nothing, which is the only way to shut a key off entirely.
    const isAllowed = hasExplicitAllowlist
        ? allowed.size > 0 && (
            grantsEveryModel
            || allowed.has(key)
            || isExplicitlyFree(params.provider, params.model)
        )
        : !RESTRICTED_MODELS.has(key);

    return {
        allowed: isAllowed,
        billingMode: isAllowed && sponsored.has(key) ? 'sponsored' : 'standard',
    };
}

export function assertApiKeyModelAccess(params: {
    allowedModels?: string[] | null;
    sponsoredModels?: string[] | null;
    provider: string;
    model: string;
}): GatewayBillingMode {
    const access = resolveApiKeyModelAccess(params);
    if (!access.allowed) {
        throw new ModelAccessDeniedError(params.provider, params.model);
    }
    return access.billingMode;
}

export function isFullySponsoredApiKey(
    allowedModels: string[] | null | undefined,
    sponsoredModels: string[] | null | undefined,
): boolean {
    if (!Array.isArray(allowedModels) || allowedModels.length === 0) return false;
    const sponsored = canonicalSet(sponsoredModels);
    return allowedModels.every((model) => sponsored.has(model.trim().toLowerCase()));
}

/** The upstream provider bills BYOK requests directly; Cencori bills only managed calls. */
export function resolveProviderBillingMode(
    accessMode: GatewayBillingMode,
    usesByok: boolean,
): GatewayBillingMode {
    return accessMode === 'sponsored' ? 'sponsored' : usesByok ? 'byok' : 'standard';
}

export function calculateGatewayCharge(
    providerCostUsd: number,
    _pricing: ModelPricing,
    billingMode: GatewayBillingMode,
): { cencoriChargeUsd: number; markupPercentage: number } {
    if (billingMode !== 'standard') {
        return { cencoriChargeUsd: 0, markupPercentage: 0 };
    }

    return {
        cencoriChargeUsd: providerCostUsd,
        markupPercentage: 0,
    };
}

export function applyResponseBillingMode(
    response: UnifiedChatResponse,
    billingMode: GatewayBillingMode,
): UnifiedChatResponse {
    if (billingMode === 'standard') return response;
    return {
        ...response,
        cost: {
            ...response.cost,
            cencoriChargeUsd: 0,
            markupPercentage: 0,
        },
    };
}
