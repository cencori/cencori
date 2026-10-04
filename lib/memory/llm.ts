/**
 * Memory generative call — provider fan-out.
 *
 * Extraction, reconciliation, and entity extraction all need *a* capable model
 * returning JSON — they don't care which. Memory is a MANAGED product, so
 * Cencori picks the backend and keeps a provider-diverse fallback: the call
 * fans out across cost-controlled managed providers in order and returns the
 * first success.
 *
 *   Cerebras GPT-OSS 120B  →  Groq GPT-OSS 20B
 *
 * Generation is deliberately Google-free: Gemini does only embeddings for
 * memory (its dedicated project has generative models retired for new projects
 * anyway). Why a chain instead of one provider:
 * - No single dependency (not beholden to Google — or to any one of them).
 * - A provider throttle or outage does not stall memory writeback.
 * - Deliberately excludes OpenAI/Anthropic — a memory call must never cascade
 *   into an unfunded paid provider.
 *
 * Each attempt disables the gateway's own fallback (`googleOnly`) so it is
 * exactly one provider; the fan-out across providers is done HERE. Throws
 * MemoryLlmExhaustedError (with per-attempt causes) when every provider
 * failed — every caller fails open.
 */

import { executeGatewayChat } from '@/lib/gateway/chat-executor';
import { getMemoryProviderKey } from '@/lib/providers/google-env';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import type { SubscriptionTier } from '@/lib/entitlements';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/**
 * Ordered list of managed production models to try. Cerebras 120b is primary:
 * it runs on our paid quota (no free-tier roulette), answers warm in ~1s,
 * and validated identical recall shape to Groq 20b. Groq 20b stays second as
 * the free fallback. Override via MEMORY_LLM_CHAIN (comma-separated) without
 * a deploy.
 */
export const MEMORY_LLM_CHAIN: string[] = (process.env.MEMORY_LLM_CHAIN
    ?.split(',')
    .map(s => s.trim())
    .filter(Boolean)) ?? [
    'gpt-oss-120b',             // Cerebras — paid primary: no free-tier roulette, ~1s warm
    'openai/gpt-oss-20b',       // Groq — fast, low-cost free fallback
    // Gemini is intentionally NOT here: memory's generation stays Google-free
    // (Gemini serves embeddings only). Add a current Gemini model to
    // MEMORY_LLM_CHAIN for a 3rd fallback if you want one.
];

/** Dedicated memory keys per provider (falls back to shared managed key when unset). */
function memoryProviderKeys(): Record<string, string | undefined> {
    return {
        google: getMemoryProviderKey('google'),
        groq: getMemoryProviderKey('groq'),
        cerebras: getMemoryProviderKey('cerebras'),
    };
}

export interface MemoryLlmParams {
    supabase: SupabaseAdmin;
    projectId: string;
    organizationId: string;
    tier: SubscriptionTier;
    requestId?: string;
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    temperature?: number;
    maxTokens?: number;
    /** Pin this model first if it's already in the chain (e.g. project's configured model). */
    preferModel?: string;
}

export interface MemoryLlmResult {
    content: string;
    model: string;
    provider: string;
    costUsd: number;
    /** Truncated per-attempt failure messages (empty when the first attempt succeeded). */
    attemptErrors: string[];
}

/** Thrown when every provider in the chain failed. Carries the per-attempt causes. */
export class MemoryLlmExhaustedError extends Error {
    attemptErrors: string[];
    constructor(attemptErrors: string[]) {
        super('Memory LLM fan-out exhausted — all providers failed.');
        this.name = 'MemoryLlmExhaustedError';
        this.attemptErrors = attemptErrors;
    }
}

/** Build the attempt order, pinning a configured chain member first. */
function orderedChain(preferModel?: string): string[] {
    if (preferModel && MEMORY_LLM_CHAIN.includes(preferModel)) {
        return [preferModel, ...MEMORY_LLM_CHAIN.filter(m => m !== preferModel)];
    }
    return MEMORY_LLM_CHAIN;
}

/**
 * Run a memory generative call across the provider chain. Returns the first
 * provider that answers. Throws MemoryLlmExhaustedError (with per-attempt
 * causes) when every provider failed — every caller fails open, and the
 * causes land in request logs for triage instead of a bare null.
 */
export async function callMemoryLlm(params: MemoryLlmParams): Promise<MemoryLlmResult> {
    const chain = orderedChain(params.preferModel);
    let attempts = 0;
    const attemptErrors: string[] = [];

    for (const model of chain) {
        attempts++;
        try {
            const response = await executeGatewayChat({
                supabase: params.supabase,
                projectId: params.projectId,
                organizationId: params.organizationId,
                tier: params.tier,
                requestId: params.requestId,
                // Each provider uses its dedicated memory key when configured.
                memoryProviderKeys: memoryProviderKeys(),
                // Single-provider attempt — this fan-out owns cross-provider fallback.
                googleOnly: true,
                request: {
                    model,
                    temperature: params.temperature ?? 0,
                    maxTokens: params.maxTokens ?? 800,
                    messages: params.messages,
                },
            });
            return {
                content: response.content ?? '',
                model: response.actualModel ?? model,
                provider: response.actualProvider,
                costUsd: response.cost?.cencoriChargeUsd ?? 0,
                attemptErrors,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            attemptErrors.push(`${model}: ${msg.slice(0, 160)}`);
            console.warn(`[Memory] LLM provider '${model}' failed (${attempts}/${chain.length}), trying next:`, msg);
        }
    }

    console.warn('[Memory] LLM fan-out exhausted — all providers failed.');
    throw new MemoryLlmExhaustedError(attemptErrors);
}
