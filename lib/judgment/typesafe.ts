/**
 * Judgment API — TypeSafe Jev client.
 *
 * Jev is evaluation-only: it answers typed questions (noul / choice / score)
 * about a state and returns probabilities, never generated text. This module
 * is purely "judge this state with these questions": key resolution, request
 * validation, the upstream call with 429 retries, and input-token billing.
 * Gateway concerns (Cencori auth, access policy, logging, usage) stay in the
 * route — see app/api/v1/judgments/route.ts.
 *
 * Upstream: POST https://api.typesafe.ai/v1/systemone
 * Docs: https://docs.typesafe.ai/api
 */

import { safeProviderFetch } from '@/lib/security/outbound-url';
import { decryptApiKey } from '@/lib/encryption';
import { resolveProviderKeyRow } from '@/lib/providers/byok-store';
import { getPricingFromDB } from '@/lib/providers/pricing';
import { SUPPORTED_PROVIDERS } from '@/lib/providers/config';
import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export const TYPESAFE_BASE_URL = 'https://api.typesafe.ai/v1';
export const JUDGMENT_PROVIDER = 'typesafe';
export const DEFAULT_JUDGMENT_MODEL = 'jev-latest';
export const TYPESAFE_MANAGED_ENV_VAR = 'TYPESAFE_API_KEY';

/** Jev ingests the state once: 64k tokens per request, 32k for state + longest question. */
export const JUDGMENT_CONTEXT_TOKENS = 64000;

export type JudgmentQuestionType = 'noul' | 'choice' | 'score';

export interface JudgmentQuestion {
    type: JudgmentQuestionType;
    instructions: unknown;
    criteria?: unknown;
}

export interface JudgmentRequest {
    state: unknown;
    questions: Record<string, JudgmentQuestion>;
    model?: string;
}

export interface JudgmentResult {
    model: string;
    answers: Record<string, unknown>;
    usage: { input_tokens: number; output_tokens: number };
    provider: 'typesafe';
    usesByok: boolean;
    costUsd: number;
}

/** Thrown for caller-fixable problems so the route can map to a 4xx. */
export class JudgmentRequestError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number = 400,
    ) {
        super(message);
        this.name = 'JudgmentRequestError';
    }
}

/** Thrown for upstream / billing failures so the route can map to a 5xx. */
export class JudgmentUpstreamError extends Error {
    constructor(
        message: string,
        public readonly status: number = 502,
        public readonly code: string = 'upstream_error',
    ) {
        super(message);
        this.name = 'JudgmentUpstreamError';
    }
}

/** Every `judgment`-type row in the provider catalog — the Judgment API's model list. */
export interface JudgmentCatalogRow {
    id: string;
    name: string;
    provider: string;
    contextWindow: number;
}

export function findJudgmentCatalogModel(model: string): JudgmentCatalogRow | undefined {
    for (const provider of SUPPORTED_PROVIDERS) {
        const row = provider.models.find(
            (m) => m.id === model && ((Array.isArray(m.type) ? m.type : [m.type]).includes('judgment')),
        );
        if (row) {
            return {
                id: row.id,
                name: row.name,
                provider: provider.id,
                contextWindow: row.contextWindow,
            };
        }
    }
    return undefined;
}

export function listJudgmentCatalogModels(): string[] {
    return listJudgmentCatalogRows().map((row) => row.id);
}

export function listJudgmentCatalogRows(): JudgmentCatalogRow[] {
    return SUPPORTED_PROVIDERS.flatMap((provider) =>
        provider.models
            .filter((m) => (Array.isArray(m.type) ? m.type : [m.type]).includes('judgment'))
            .map((m) => ({ id: m.id, name: m.name, provider: provider.id, contextWindow: m.contextWindow })),
    );
}

export function isJudgmentCatalogModel(model: string): boolean {
    return findJudgmentCatalogModel(model) !== undefined;
}

// ── Key resolution ─────────────────────────────────────────────
// Project BYOK key first (dashboard row, then embedded connection), managed
// TYPESAFE_API_KEY as fallback. Never throws: absence is a 402/503 at the
// route, with a message telling the caller where a key goes.

export async function resolveJudgmentKey(
    supabase: Admin,
    projectId: string,
    organizationId: string,
    provider: string = JUDGMENT_PROVIDER,
    managedEnvVar: string = TYPESAFE_MANAGED_ENV_VAR,
): Promise<{ key: string; usesByok: boolean } | null> {
    try {
        const resolved = await resolveProviderKeyRow(supabase as never, {
            projectId,
            provider,
        });
        if (resolved?.row) {
            return {
                key: decryptApiKey(resolved.row.encrypted_key, organizationId),
                usesByok: true,
            };
        }
    } catch {
        // Fall through to managed.
    }
    const managed = process.env[managedEnvVar]?.trim();
    if (managed) return { key: managed, usesByok: false };
    return null;
}

// ── Validation ─────────────────────────────────────────────────
// Mirrors the upstream contract just enough to fail fast with a 400 before
// spending a billed request. TypeSafe re-validates and returns 422 for
// anything subtler.

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function estimateTokens(value: unknown): number {
    // ~4 chars per token, measured over the JSON wire form.
    return Math.ceil(JSON.stringify(value ?? '').length / 4);
}

export { isRecord, estimateTokens };

export function validateJudgmentBody(body: unknown): JudgmentRequest {
    if (!isRecord(body)) {
        throw new JudgmentRequestError('invalid_request', 'Request body must be a JSON object');
    }
    const { state, questions, model } = body;

    if (state === undefined || state === null) {
        throw new JudgmentRequestError('invalid_state', 'state is required (string, JSON object, or array of text)');
    }
    if (typeof state !== 'string' && !isRecord(state) && !Array.isArray(state)) {
        throw new JudgmentRequestError('invalid_state', 'state must be a string, JSON object, or array');
    }

    if (!isRecord(questions) || Object.keys(questions).length === 0) {
        throw new JudgmentRequestError('invalid_questions', 'questions must be a non-empty object keyed by question id');
    }
    for (const [id, question] of Object.entries(questions)) {
        if (!isRecord(question)) {
            throw new JudgmentRequestError('invalid_questions', `question '${id}' must be an object`);
        }
        const q = question as Record<string, unknown>;
        if (q.type !== 'noul' && q.type !== 'choice' && q.type !== 'score') {
            throw new JudgmentRequestError('invalid_questions', `question '${id}' has unknown type '${String(q.type)}' (noul, choice, score)`);
        }
        if (q.instructions === undefined || q.instructions === null || q.instructions === '') {
            throw new JudgmentRequestError('invalid_questions', `question '${id}' requires instructions`);
        }
        if (q.type === 'choice') {
            const options = isRecord(q.criteria) ? Object.keys(q.criteria) : null;
            if (!options || options.length === 0 || options.length > 255) {
                throw new JudgmentRequestError('invalid_questions', `choice question '${id}' needs 1–255 options in criteria`);
            }
        }
        if (q.type === 'score') {
            if (!Array.isArray(q.criteria) || q.criteria.length < 2 || q.criteria.length > 10) {
                throw new JudgmentRequestError('invalid_questions', `score question '${id}' needs 2–10 ordered levels in criteria`);
            }
        }
    }

    const resolvedModel = model === undefined || model === null || model === ''
        ? DEFAULT_JUDGMENT_MODEL
        : String(model);
    // Catalog-driven: any `judgment`-type catalog row is accepted, so a new
    // decision model only needs a config entry (plus pricing + adapter) to
    // work here. See lib/judgment/registry.ts.
    const catalogRow = findJudgmentCatalogModel(resolvedModel);
    if (!catalogRow) {
        const known = listJudgmentCatalogModels().join(', ') || DEFAULT_JUDGMENT_MODEL;
        throw new JudgmentRequestError(
            'unknown_model',
            `Unknown judgment model '${resolvedModel}'. Use one of: ${known}`,
            404,
        );
    }

    // Client-side context guard, per model (Jev 64k; Clef 64k/24k): the
    // budget covers state plus all questions combined. Upstream 4xxs
    // over-budget requests; this 400 names the limit before the request is
    // billed.
    const budget = catalogRow.contextWindow > 0 ? catalogRow.contextWindow : JUDGMENT_CONTEXT_TOKENS;
    const longest = Math.max(...Object.values(questions).map((q) => estimateTokens(q)));
    const estimated = estimateTokens(state) + longest;
    if (estimated > budget) {
        throw new JudgmentRequestError(
            'context_exceeded',
            `Estimated ~${estimated.toLocaleString()} tokens exceeds ${catalogRow.name}'s ${budget.toLocaleString()}-token per-request budget (measured as state plus the longest question, ~4 characters per token)`,
        );
    }

    return { state, questions: questions as JudgmentRequest['questions'], model: resolvedModel };
}

// ── Upstream call ──────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(header: string | null, attempt: number): number {
    const parsed = header ? Number(header) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0) return Math.min(parsed * 1000, 30_000);
    return Math.min(1000 * 2 ** attempt, 8000);
}

export async function evaluateJudgment(
    apiKey: string,
    request: JudgmentRequest,
    opts?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<{ model: string; answers: Record<string, unknown>; usage: { input_tokens: number; output_tokens: number } }> {
    const timeoutMs = opts?.timeoutMs ?? 60_000;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const onAbort = () => controller.abort();
        opts?.signal?.addEventListener('abort', onAbort, { once: true });
        try {
            const response = await safeProviderFetch(`${TYPESAFE_BASE_URL}/systemone`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    state: request.state,
                    model: request.model ?? DEFAULT_JUDGMENT_MODEL,
                    questions: request.questions,
                }),
                signal: controller.signal,
            });

            if (response.status === 429) {
                lastError = new JudgmentUpstreamError('TypeSafe rate limit exceeded', 429, 'rate_limited');
                await sleep(retryAfterMs(response.headers.get('retry-after'), attempt));
                continue;
            }
            if (!response.ok) {
                const detail = (await response.text().catch(() => '')).slice(0, 500);
                if (response.status === 401 || response.status === 403) {
                    throw new JudgmentUpstreamError(
                        `TypeSafe rejected the API key (${response.status}). Check TYPESAFE_API_KEY or the project's typesafe key.`,
                        502,
                        'provider_auth',
                    );
                }
                if (response.status === 422) {
                    throw new JudgmentUpstreamError(`TypeSafe rejected the request: ${detail || 'validation error'}`, 502, 'provider_validation');
                }
                throw new JudgmentUpstreamError(`TypeSafe request failed (${response.status})${detail ? `: ${detail}` : ''}`);
            }

            const payload = (await response.json()) as {
                model?: unknown;
                answers?: unknown;
                usage?: { input_tokens?: unknown; output_tokens?: unknown };
            };
            if (!isRecord(payload.answers)) {
                throw new JudgmentUpstreamError('TypeSafe returned no answers object');
            }
            return {
                model: typeof payload.model === 'string' ? payload.model : (request.model ?? DEFAULT_JUDGMENT_MODEL),
                answers: payload.answers,
                usage: {
                    input_tokens: Number(payload.usage?.input_tokens ?? 0) || 0,
                    output_tokens: Number(payload.usage?.output_tokens ?? 0) || 0,
                },
            };
        } catch (error) {
            if (error instanceof JudgmentUpstreamError) throw error;
            lastError = error;
            // Network/abort errors retry once with backoff; caller aborts do not.
            if (opts?.signal?.aborted) {
                throw new JudgmentUpstreamError('Judgment request aborted');
            }
            if (attempt < 2) {
                await sleep(Math.min(500 * 2 ** attempt, 4000));
                continue;
            }
            throw new JudgmentUpstreamError(error instanceof Error ? error.message : 'TypeSafe request failed');
        } finally {
            clearTimeout(timer);
            opts?.signal?.removeEventListener('abort', onAbort);
        }
    }
    throw lastError instanceof JudgmentUpstreamError
        ? lastError
        : new JudgmentUpstreamError('TypeSafe request failed after retries');
}

// ── Billing ────────────────────────────────────────────────────
// Jev bills input tokens only ($42/Btok = $0.042/Mtok); output is free.

export async function priceJudgment(model: string, inputTokens: number): Promise<number> {
    const pricing = await getPricingFromDB(JUDGMENT_PROVIDER, model);
    return (Math.max(0, inputTokens) * pricing.inputPer1KTokens) / 1000;
}
