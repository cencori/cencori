/**
 * Judgment provider registry.
 *
 * The Judgment API (POST /v1/judgments) is vendor-neutral: any decision
 * model — any `judgment`-type row in the provider catalog — is served by the
 * same endpoint, the same auth, and the same billing. Each vendor behind it
 * gets one adapter here: how to resolve its key, call it, and price it.
 *
 * Adding another decision vendor is three steps, no route changes:
 *   1. catalog rows with `type: ['judgment']` in lib/providers/config.ts,
 *      plus a `<vendor>-` prefix rule in lib/providers/router.ts,
 *   2. an adapter below (key env, evaluate, price),
 *   3. active `<provider>:<model>` model_pricing rows.
 *
 * Two vendors are wired today: TypeSafe (Jev — ./typesafe.ts) and Cloudflare
 * (Clef — ./clef.ts). Both share the route's transport, validation shape and
 * error mapping; they differ only in the upstream contract and key format.
 */

import { ProviderRouter } from '@/lib/providers/router';
import {
    CLEF_MANAGED_ACCOUNT_ENV_VAR,
    CLEF_MANAGED_TOKEN_ENV_VAR,
    CLEF_PROVIDER,
    evaluateClefJudgment,
    priceClefJudgment,
    resolveClefKey,
} from './clef';
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
    /** Every env var the managed (Cencori-paid) key needs; all must be set. */
    managedEnvVars: string[];
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
        managedEnvVars: [TYPESAFE_MANAGED_ENV_VAR],
        evaluate: evaluateJudgment,
        price: priceJudgment,
        resolveKey: (supabase, projectId, organizationId) =>
            resolveJudgmentKey(supabase, projectId, organizationId, JUDGMENT_PROVIDER, TYPESAFE_MANAGED_ENV_VAR),
    },
    [CLEF_PROVIDER]: {
        provider: CLEF_PROVIDER,
        managedEnvVar: CLEF_MANAGED_TOKEN_ENV_VAR,
        managedEnvVars: [CLEF_MANAGED_ACCOUNT_ENV_VAR, CLEF_MANAGED_TOKEN_ENV_VAR],
        evaluate: evaluateClefJudgment,
        price: priceClefJudgment,
        resolveKey: (supabase, projectId, organizationId) =>
            resolveClefKey(supabase, projectId, organizationId),
    },
};

export function getJudgmentAdapter(provider: string): JudgmentAdapter | null {
    return ADAPTERS[provider.trim().toLowerCase()] ?? null;
}

/**
 * Judgment vendors Cencori can serve on its own key. They are not chat
 * providers, so the gateway's managed-provider set never lists them; the
 * model catalog adds these so /v1/models reports judgment models available.
 */
export function getManagedJudgmentProviderNames(): Set<string> {
    const providers = new Set<string>();
    for (const adapter of Object.values(ADAPTERS)) {
        if (adapter.managedEnvVars.every((name) => process.env[name]?.trim())) providers.add(adapter.provider);
    }
    return providers;
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
