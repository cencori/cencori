/**
 * Memory embeddings — 1536-dim, matching the gateway_memories.embedding column.
 *
 * Managed default: Google `gemini-embedding-001` at outputDimensionality=1536
 * (free tier, no OpenAI dependency). BYOK: a project's own active OpenAI key
 * still wins and uses text-embedding-3-small (also 1536, so vectors stay
 * comparable within a project). Both paths yield the same dimensionality.
 *
 * A project must not switch providers mid-life — OpenAI-space and Gemini-space
 * vectors are not comparable. New projects have no memories, so the managed
 * Gemini default is a clean baseline.
 *
 * (The semantic cache uses a separate Gemini 768-dim stack — not shared.)
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI, type EmbedContentRequest } from '@google/generative-ai';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { decryptApiKey } from '@/lib/encryption';
import { getPricingFromDB } from '@/lib/providers/pricing';
import { calculateProviderTokenCost } from '@/lib/providers/base';
import { getMemoryGoogleApiKey } from '@/lib/providers/google-env';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// BYOK OpenAI path (kept for projects that bring their own OpenAI key).
export const MEMORY_EMBEDDING_MODEL = 'text-embedding-3-small';
// Managed default — free, 1536-dim via Matryoshka output dimensionality.
export const MEMORY_EMBEDDING_MODEL_MANAGED = 'gemini-embedding-001';
export const MEMORY_EMBEDDING_DIMENSIONS = 1536;

export interface MemoryEmbeddingResult {
    embeddings: number[][];
    totalTokens: number;
    providerCostUsd: number;
    cencoriChargeUsd: number;
    markupPercentage: number;
    /** Which model actually produced the vectors ('openai' BYOK or managed Gemini). */
    model: string;
    provider: 'openai' | 'google';
}

interface MemoryEmbeddingConfig {
    provider: 'openai' | 'google';
    model: string;
    encryptedOpenAIKey?: string;
}

async function resolveMemoryEmbeddingConfig(
    supabase: SupabaseAdmin,
    projectId: string
): Promise<MemoryEmbeddingConfig> {
    const { data: providerKey, error: keyError } = await supabase
        .from('provider_keys')
        .select('encrypted_key')
        .eq('project_id', projectId)
        .eq('provider', 'openai')
        .eq('is_active', true)
        .maybeSingle();

    if (keyError) {
        throw new Error(`Could not resolve memory embedding credentials: ${keyError.message}`);
    }

    const preferredProvider: 'openai' | 'google' = providerKey?.encrypted_key
        ? 'openai'
        : 'google';
    const preferredModel = preferredProvider === 'openai'
        ? MEMORY_EMBEDDING_MODEL
        : MEMORY_EMBEDDING_MODEL_MANAGED;

    const { data, error } = await supabase.rpc('claim_gateway_memory_embedding_config', {
        p_project_id: projectId,
        p_provider: preferredProvider,
        p_model: preferredModel,
    });

    if (error) {
        throw new Error(`Could not pin memory embedding space: ${error.message}`);
    }

    const claimed = Array.isArray(data) ? data[0] : data;
    if (claimed?.embedding_provider === 'openai') {
        if (!providerKey?.encrypted_key) {
            throw new Error(
                'This project\'s memory space is pinned to OpenAI, but its active OpenAI provider key is unavailable.'
            );
        }
        return {
            provider: 'openai',
            model: MEMORY_EMBEDDING_MODEL,
            encryptedOpenAIKey: providerKey.encrypted_key,
        };
    }

    if (claimed?.embedding_provider === 'google') {
        return { provider: 'google', model: MEMORY_EMBEDDING_MODEL_MANAGED };
    }

    throw new Error('The project memory embedding space could not be resolved.');
}

/**
 * Embed one or more strings for memory storage/search.
 * Throws on failure — callers decide whether to fail open (chat retrieval)
 * or surface the error (direct endpoints).
 */
export async function embedForMemory(
    supabase: SupabaseAdmin,
    projectId: string,
    organizationId: string,
    input: string | string[]
): Promise<MemoryEmbeddingResult> {
    const inputs = Array.isArray(input) ? input : [input];

    const config = await resolveMemoryEmbeddingConfig(supabase, projectId);
    if (config.provider === 'openai' && config.encryptedOpenAIKey) {
        const openaiKey = decryptApiKey(config.encryptedOpenAIKey, organizationId);
        return embedWithOpenAI(openaiKey, inputs);
    }

    return embedWithGemini(inputs);
}

/** How many times a single managed embedding call is attempted. */
const EMBED_MAX_ATTEMPTS = 3;
/** Base backoff between attempts (doubled per attempt, plus jitter). */
const EMBED_RETRY_BASE_MS = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Only transient failures retry: 429/5xx/timeouts/network blips. Auth,
 * quota-exhaustion-as-400, bad-request and not-found errors fail fast —
 * retrying those burns budget for nothing. Exported for tests.
 */
export function isEmbedRetryable(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    if (/\[40[0134]\b/.test(msg)) return false;
    if (/\[429\b|\[50\d\b|\[502\b|\[503\b|\[504\b/.test(msg)) return true;
    if (/timed?\s?out|timeout|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|fetch failed|network/i.test(msg)) return true;
    return false;
}

/**
 * One managed embedding call with backoff. A single 429/503 mid-batch must
 * not fail the whole batch (or the write): 429s cluster under burst load and
 * usually clear within seconds. Non-retryable errors throw immediately.
 */
async function embedContentWithRetry(
    // Narrowed against the SDK's model type: real embedContent accepts more
    // input shapes and returns a richer response; both directions are
    // assignable here.
    model: { embedContent: (request: EmbedContentRequest) => Promise<any> },
    request: EmbedContentRequest
): Promise<number[]> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= EMBED_MAX_ATTEMPTS; attempt++) {
        try {
            const result = await model.embedContent(request);
            return result.embedding.values;
        } catch (error) {
            lastError = error;
            if (attempt === EMBED_MAX_ATTEMPTS || !isEmbedRetryable(error)) throw error;
            const backoffMs = EMBED_RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * 250;
            console.warn(
                `[Memory] Embedding attempt ${attempt}/${EMBED_MAX_ATTEMPTS} failed, retrying in ${Math.round(backoffMs)}ms:`,
                error instanceof Error ? error.message.slice(0, 160) : error
            );
            await sleep(backoffMs);
        }
    }
    throw lastError;
}

/** Managed path — Google gemini-embedding-001 at 1536 dims. */
async function embedWithGemini(inputs: string[]): Promise<MemoryEmbeddingResult> {
    // Memory-dedicated key (MEMORY_GEMINI_API_KEY) when set, else the shared
    // managed key. Isolates memory embedding quota from general Gemini chat.
    const key = getMemoryGoogleApiKey();
    if (!key) {
        throw new Error('No Google API key configured for memory embeddings');
    }

    // Resolve paid-tier list pricing before making a potentially billable call.
    // Free-tier allowance is not a durable production billing guarantee.
    const pricing = await getPricingFromDB('google', MEMORY_EMBEDDING_MODEL_MANAGED);
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: MEMORY_EMBEDDING_MODEL_MANAGED });

    const embeddings: number[][] = [];
    let totalTokens = 0;
    for (const text of inputs) {
        // outputDimensionality is supported by the API (Matryoshka) but missing
        // from the v0.24.1 SDK types — widen the request type to pass it.
        const request: EmbedContentRequest & { outputDimensionality?: number } = {
            content: { role: 'user', parts: [{ text }] },
            outputDimensionality: MEMORY_EMBEDDING_DIMENSIONS,
        };
        const result = await embedContentWithRetry(model, request);
        embeddings.push(result);
        totalTokens += Math.ceil(text.length / 4);
    }

    const providerCostUsd = calculateProviderTokenCost(totalTokens, 0, pricing);
    const cencoriChargeUsd = providerCostUsd;

    return {
        embeddings,
        totalTokens,
        providerCostUsd,
        cencoriChargeUsd,
        markupPercentage: 0,
        model: MEMORY_EMBEDDING_MODEL_MANAGED,
        provider: 'google',
    };
}

/** BYOK path — OpenAI text-embedding-3-small (1536 dims). */
async function embedWithOpenAI(openaiKey: string, inputs: string[]): Promise<MemoryEmbeddingResult> {
    const pricing = await getPricingFromDB('openai', MEMORY_EMBEDDING_MODEL);
    const client = new OpenAI({ apiKey: openaiKey, timeout: 55_000, maxRetries: 0 });
    const response = await client.embeddings.create({
        model: MEMORY_EMBEDDING_MODEL,
        input: inputs,
    });

    const totalTokens = response.usage?.total_tokens ?? 0;
    const providerCostUsd = calculateProviderTokenCost(totalTokens, 0, pricing);
    const cencoriChargeUsd = 0;

    // OpenAI returns embeddings with an index field; keep input order.
    const ordered = [...response.data].sort((a, b) => a.index - b.index);

    return {
        embeddings: ordered.map(d => d.embedding),
        totalTokens,
        providerCostUsd,
        cencoriChargeUsd,
        markupPercentage: 0,
        model: MEMORY_EMBEDDING_MODEL,
        provider: 'openai',
    };
}
