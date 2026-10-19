/**
 * Judgment API — Cloudflare Clef client.
 *
 * Clef is Cloudflare's decision-model family on Workers AI, the same family
 * as TypeSafe's Jev: it answers typed questions (noul / choice / score)
 * about a state with per-option probabilities and never generates text.
 * This module is purely "judge this state with these questions via Clef":
 * key resolution, the upstream call with 429 retries, and input-token
 * billing. Gateway concerns (Cencori auth, access policy, logging, usage)
 * stay in the route — see app/api/v1/judgments/route.ts. Shared request
 * validation lives in ./typesafe.ts (same typed-questions contract).
 *
 * Upstream: POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}
 *           /ai/run/@cf/cloudflare/clef        (flagship 27B)
 *           /ai/run/@cf/cloudflare/clef-flash  (fast 9B)
 *           /ai/run/@cf/cloudflare/clef-omni   (64k, audio/video-tolerant)
 * One run path per size; the body's `model` field is 'clef' / 'clef-flash'
 * / 'clef-omni'.
 * Docs: https://developers.cloudflare.com/ai/models/@cf/cloudflare/clef/
 */

import { safeProviderFetch } from '@/lib/security/outbound-url';
import { decryptApiKey } from '@/lib/encryption';
import { resolveProviderKeyRow } from '@/lib/providers/byok-store';
import { getPricingFromDB } from '@/lib/providers/pricing';
import {
    DEFAULT_JUDGMENT_MODEL,
    estimateTokens,
    isRecord,
    JudgmentRequestError,
    JudgmentUpstreamError,
    type JudgmentRequest,
} from './typesafe';

type Admin = ReturnType<typeof import('@/lib/supabaseAdmin').createAdminClient>;

export const CLEF_BASE_URL = 'https://api.cloudflare.com/client/v4';
export const CLEF_PROVIDER = 'cloudflare';
export const CLEF_MANAGED_TOKEN_ENV_VAR = 'CLOUDFLARE_API_TOKEN';
export const CLEF_MANAGED_ACCOUNT_ENV_VAR = 'CLOUDFLARE_ACCOUNT_ID';

/**
 * Each Clef size is served at its own Workers AI model path — verified live
 * 2026-10-18: run/@cf/cloudflare/clef rejects `model: 'clef-flash'` with
 * AiError 3030 ("Unsupported model 'clef-flash'. Use 'clef'"), and
 * run/@cf/cloudflare/clef-flash serves the 9B. Cloudflare's docs present the
 * body `model` as a selector over the same path; live behavior is one path
 * per size, so encode both here.
 */
const CLEF_UPSTREAM_SELECTORS: Record<string, { type_id: string; body_model: string }> = {
    'clef-latest': { type_id: '@cf/cloudflare/clef', body_model: 'clef' },
    'clef-flash': { type_id: '@cf/cloudflare/clef-flash', body_model: 'clef-flash' },
    'clef-omni': { type_id: '@cf/cloudflare/clef-omni', body_model: 'clef-omni' },
};

const FLAGSHIP = CLEF_UPSTREAM_SELECTORS['clef-latest'];

function upstreamSelector(model: string | undefined): { type_id: string; body_model: string } {
    if (!model) return FLAGSHIP;
    return CLEF_UPSTREAM_SELECTORS[model] ?? FLAGSHIP;
}

// ── Key resolution ─────────────────────────────────────────────
// Workers AI runs inside a Cloudflare account: the URL carries the account
// id and the Authorization header carries an API token, so a usable key is
// always the pair `<ACCOUNT_ID>:<API_TOKEN>`. Project BYOK keys are saved in
// that combined form; the managed path composes CLOUDFLARE_ACCOUNT_ID +
// CLOUDFLARE_API_TOKEN from the environment into the same shape. Never
// throws: absence is a 402/503 at the route, with a message telling the
// caller where a key goes.

export function parseClefKey(key: string): { accountId: string; apiToken: string } {
    const separator = key.indexOf(':');
    const accountId = separator > 0 ? key.slice(0, separator).trim() : '';
    const apiToken = separator > 0 ? key.slice(separator + 1).trim() : '';
    if (!accountId || !apiToken) {
        throw new JudgmentRequestError(
            'invalid_key',
            "A cloudflare key must be '<ACCOUNT_ID>:<API_TOKEN>'. Save a Cloudflare provider key in project settings in that form, or set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.",
            402,
        );
    }
    return { accountId, apiToken };
}

export async function resolveClefKey(
    supabase: Admin,
    projectId: string,
    organizationId: string,
): Promise<{ key: string; usesByok: boolean } | null> {
    try {
        const resolved = await resolveProviderKeyRow(supabase as never, {
            projectId,
            provider: CLEF_PROVIDER,
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
    const apiToken = process.env[CLEF_MANAGED_TOKEN_ENV_VAR]?.trim();
    const accountId = process.env[CLEF_MANAGED_ACCOUNT_ENV_VAR]?.trim();
    if (apiToken && accountId) return { key: `${accountId}:${apiToken}`, usesByok: false };
    return null;
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

/**
 * Cloudflare's Workers AI REST envelope: { result, success, errors, messages }.
 * `result` is the same object the Workers binding returns (answers + usage).
 */
interface ClefRestEnvelope {
    result?: unknown;
    success?: unknown;
    errors?: unknown;
}

function envelopeError(envelope: ClefRestEnvelope, fallback: string): string {
    const first = Array.isArray(envelope.errors) && isRecord(envelope.errors[0])
        ? envelope.errors[0]
        : null;
    const message = typeof first?.message === 'string' ? first.message : '';
    const code = first && typeof first.code === 'number' ? ` (code ${first.code})` : '';
    return [message, code].filter(Boolean).join('') || fallback;
}

export async function evaluateClefJudgment(
    apiKey: string,
    request: JudgmentRequest,
    opts?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<{ model: string; answers: Record<string, unknown>; usage: { input_tokens: number; output_tokens: number } }> {
    const timeoutMs = opts?.timeoutMs ?? 60_000;
    let lastError: unknown = null;
    const { accountId, apiToken } = parseClefKey(apiKey);
    const selector = upstreamSelector(request.model);
    const endpoint = `${CLEF_BASE_URL}/accounts/${encodeURIComponent(accountId)}/ai/run/${selector.type_id}`;

    for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const onAbort = () => controller.abort();
        opts?.signal?.addEventListener('abort', onAbort, { once: true });
        try {
            const response = await safeProviderFetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: selector.body_model,
                    state: request.state,
                    questions: request.questions,
                }),
                signal: controller.signal,
            });

            if (response.status === 429) {
                lastError = new JudgmentUpstreamError('Cloudflare rate limit exceeded', 429, 'rate_limited');
                await sleep(retryAfterMs(response.headers.get('retry-after'), attempt));
                continue;
            }
            if (!response.ok) {
                const envelope = (await response.json().catch(() => null)) as ClefRestEnvelope | null;
                const detail = envelope ? envelopeError(envelope, '') : '';
                if (response.status === 401 || response.status === 403) {
                    throw new JudgmentUpstreamError(
                        `Cloudflare rejected the API key (${response.status})${detail ? `: ${detail}` : ''}. Check CLOUDFLARE_API_TOKEN or the project's cloudflare key.`,
                        502,
                        'provider_auth',
                    );
                }
                if (response.status === 404 && detail.toLowerCase().includes('model')) {
                    throw new JudgmentUpstreamError(
                        `Cloudflare does not serve ${selector.type_id} for this account${detail ? `: ${detail}` : ''}`,
                        502,
                        'provider_unavailable',
                    );
                }
                if (response.status === 400 || response.status === 422) {
                    throw new JudgmentUpstreamError(
                        `Cloudflare rejected the request${detail ? `: ${detail}` : ''}`,
                        502,
                        'provider_validation',
                    );
                }
                throw new JudgmentUpstreamError(
                    `Cloudflare request failed (${response.status})${detail ? `: ${detail}` : ''}`,
                    502,
                    'upstream_error',
                );
            }

            const envelope = (await response.json()) as ClefRestEnvelope;
            const result = envelope.result;
            if (!isRecord(result) || !isRecord(result.answers)) {
                throw new JudgmentUpstreamError('Cloudflare returned no answers object', 502, 'upstream_error');
            }

            // Workers AI reports token usage on `result.usage` with prompt /
            // completion counts. Clef bills input tokens only (output tokens
            // are free and usually 0). If the envelope omits usage, fall back
            // to the same characters-per-token estimate as the shared
            // pre-flight guard so usage records are never zero for a judged
            // request.
            const usageRow = isRecord(result.usage) ? result.usage : null;
            const promptTokens = Number(usageRow?.prompt_tokens ?? usageRow?.input_tokens);
            const completionTokens = Number(usageRow?.completion_tokens ?? usageRow?.output_tokens);
            const estimated = estimateTokens({ state: request.state, questions: request.questions });
            // The envelope names its size with the upstream body selector
            // ('clef' | 'clef-flash'). Map it back to the catalog id the route
            // knows ('clef-latest'), so pricing resolves without the
            // requested-model fallback.
            const answeredModel = typeof result.model === 'string'
                ? Object.entries(CLEF_UPSTREAM_SELECTORS).find(([, v]) => v.body_model === result.model)?.[0]
                : undefined;
            return {
                model: answeredModel ?? request.model ?? DEFAULT_JUDGMENT_MODEL,
                answers: result.answers as Record<string, unknown>,
                usage: {
                    input_tokens: promptTokens > 0 ? promptTokens : estimated,
                    output_tokens: completionTokens > 0 ? completionTokens : 0,
                },
            };
        } catch (error) {
            if (error instanceof JudgmentUpstreamError) throw error;
            lastError = error;
            // Network/abort errors retry; caller aborts do not.
            if (opts?.signal?.aborted) {
                throw new JudgmentUpstreamError('Judgment request aborted', 502, 'aborted');
            }
            if (attempt < 2) {
                await sleep(Math.min(500 * 2 ** attempt, 4000));
                continue;
            }
            throw new JudgmentUpstreamError(error instanceof Error ? error.message : 'Cloudflare request failed', 502, 'upstream_error');
        } finally {
            clearTimeout(timer);
            opts?.signal?.removeEventListener('abort', onAbort);
        }
    }
    throw lastError ?? new JudgmentUpstreamError('Cloudflare request failed after retries', 502, 'upstream_error');
}

// ── Billing ────────────────────────────────────────────────────
// Clef bills input tokens only ($0.24 per MTok flagship, $0.038 per MTok
// flash); output tokens are free. Rates live in `cloudflare:<id>`
// model_pricing rows — see the companion migration.

export async function priceClefJudgment(model: string, inputTokens: number): Promise<number> {
    const pricing = await getPricingFromDB(CLEF_PROVIDER, model);
    return (Math.max(0, inputTokens) * pricing.inputPer1KTokens) / 1000;
}
