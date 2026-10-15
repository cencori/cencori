/**
 * Judgment provider registry.
 *
 * The Judgment API (POST /v1/judgments) is vendor-neutral: any decision
 * model — any `judgment`-type row in the provider catalog — is served by the
 * same endpoint, the same auth, and the same billing. Each vendor behind it
 * gets one adapter here: how to resolve its key, call it, and price it.
 *
 * Adding a second decision vendor is three steps, no route changes:
 *   1. catalog rows with `type: ['judgment']` in lib/providers/config.ts,
 *      plus a `jev-`-style prefix rule in lib/providers/router.ts,
 *   2. an adapter below (key env, evaluate, price),
 *   3. active `<provider>:<model>` model_pricing rows.
 */

import { ProviderRouter } from '@/lib/providers/router';
import {
    DEFAULT_JUDGMENT_MODEL,
    JUDGMENT_PROVIDER,
    TYPESAFE_MANAGED_ENV_VAR,
    evaluateJudgment,
    isJudgmentCatalogModel,
    priceJudgment,
    resolveJudgmentKey,
    type JudgmentRequest,
} from './typesafe';
import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export interface JudgmentEvaluation {
    model: string;
    answers: Record<string, unknown>;
    usage: { input_tokens: number; output_tokens: number };
}

export interface JudgmentAdapter {
    provider: string;
    managedEnvVar: string;
    evaluate: (
        apiKey: string,
        request: JudgmentRequest,
        opts?: { signal?: AbortSignal; timeoutMs?: number },
    ) => Promise<JudgmentEvaluation>;
    price: (model: string, inputTokens: number) => Promise<number>;
    resolveKey: (
        supabase: Admin,
        projectId: string,
        organizationId: string,
    ) => Promise<{ key: string; usesByok: boolean } | null>;
}

const ADAPTERS: Record<string, JudgmentAdapter> = {
    [JUDGMENT_PROVIDER]: {
        provider: JUDGMENT_PROVIDER,
        managedEnvVar: TYPESAFE_MANAGED_ENV_VAR,
        evaluate: evaluateJudgment,
        price: priceJudgment,
        resolveKey: (supabase, projectId, organizationId) =>
            resolveJudgmentKey(supabase, projectId, organizationId, JUDGMENT_PROVIDER, TYPESAFE_MANAGED_ENV_VAR),
    },
};

export function getJudgmentAdapter(provider: string): JudgmentAdapter | null {
    return ADAPTERS[provider.trim().toLowerCase()] ?? null;
}

/**
 * Resolve the adapter serving a judgment model id. Fails closed: unknown
 * ids, non-judgment catalog rows, routed-but-unadapted providers, and
 * providers with no key path each get their own error.
 */
export function resolveJudgmentAdapter(model: string): JudgmentAdapter {
    if (!isJudgmentCatalogModel(model)) {
        throw Object.assign(
            new Error(`Unknown judgment model '${model}'.`),
            { code: 'unknown_model', status: 404 },
        );
    }
    const provider = new ProviderRouter().detectProvider(model);
    const adapter = getJudgmentAdapter(provider);
    if (!adapter) {
        throw Object.assign(
            new Error(`Judgment model '${model}' routes to '${provider}', which has no judgment adapter yet.`),
            { code: 'provider_unavailable', status: 501 },
        );
    }
    return adapter;
}

export { DEFAULT_JUDGMENT_MODEL };
