/**
 * Judgment API Route
 *
 * POST /v1/judgments
 *
 * Structured decisions via decision models (TypeSafe's Jev today, any
 * `judgment`-type catalog row tomorrow): send a state plus typed questions
 * (noul / choice / score), get back probabilities — never generated text.
 * Vendors plug in through lib/judgment/registry.ts; this route owns the
 * gateway pipeline (validation, access policy, key resolution, pricing,
 * logging, usage) and stays vendor-neutral.
 *
 * GET lists the judgment models with their pricing.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
} from '@/lib/gateway-middleware';
import { assertApiKeyModelAccess } from '@/lib/gateway/model-access';
import { ModelAccessDeniedError } from '@/lib/providers/errors';
import {
    DEFAULT_JUDGMENT_MODEL,
    JUDGMENT_CONTEXT_TOKENS,
    JudgmentRequestError,
    JudgmentUpstreamError,
    listJudgmentCatalogModels,
    validateJudgmentBody,
} from '@/lib/judgment/typesafe';
import { getJudgmentAdapter, resolveJudgmentAdapter } from '@/lib/judgment/registry';
import { SUPPORTED_PROVIDERS } from '@/lib/providers/config';
import { getModelDisplayPrice } from '@/lib/providers/display-pricing';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function judgmentCatalogEntries(): Array<{ id: string; provider: string }> {
    return SUPPORTED_PROVIDERS.flatMap((provider) =>
        provider.models
            .filter((m) => (Array.isArray(m.type) ? m.type : [m.type]).includes('judgment'))
            .map((m) => ({ id: m.id, provider: provider.id })),
    );
}

export async function GET() {
    return NextResponse.json({
        object: 'list',
        endpoint: 'POST /v1/judgments',
        context_tokens: JUDGMENT_CONTEXT_TOKENS,
        data: judgmentCatalogEntries().map(({ id, provider }) => {
            const price = getModelDisplayPrice(id, 'judgment');
            const adapter = getJudgmentAdapter(provider);
            return {
                id,
                object: 'model' as const,
                owned_by: provider,
                type: 'judgment',
                context_window: JUDGMENT_CONTEXT_TOKENS,
                available: adapter !== null,
                ...(adapter === null ? { unavailable_reason: 'provider_unavailable' } : {}),
                pricing: {
                    input_per_million: price.inputPerMillion,
                    output_per_million: price.outputPerMillion,
                    currency: 'USD' as const,
                    input_display: price.input,
                    output_display: price.output,
                    note: 'Input tokens billed; output tokens free.',
                },
            };
        }),
        question_types: ['noul', 'choice', 'score'],
        default_model: DEFAULT_JUDGMENT_MODEL,
    });
}

export async function POST(req: NextRequest) {
    const validation = await validateGatewayRequest(req);
    if (!validation.success) {
        return validation.response;
    }
    const ctx = validation.context;

    let model = DEFAULT_JUDGMENT_MODEL;
    let provider = 'typesafe';

    try {
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            throw new JudgmentRequestError('invalid_json', 'Request body must be valid JSON');
        }

        const judged = validateJudgmentBody(body);
        model = judged.model ?? DEFAULT_JUDGMENT_MODEL;

        // Vendor-neutral: the model's router prefix selects the adapter, so a
        // new decision vendor works here with no route changes.
        try {
            const adapter = resolveJudgmentAdapter(model);
            provider = adapter.provider;
        } catch (error) {
            const code = (error as { code?: string }).code ?? 'unknown_model';
            const status = (error as { status?: number }).status ?? 404;
            return addGatewayHeaders(
                NextResponse.json({ error: code, message: (error as Error).message }, { status }),
                { requestId: ctx.requestId },
            );
        }
        const adapter = getJudgmentAdapter(provider)!;

        // Key-level allowlist still applies: a restricted key must not reach
        // judgment models outside its grant.
        try {
            assertApiKeyModelAccess({
                allowedModels: ctx.allowedModels,
                sponsoredModels: ctx.sponsoredModels,
                provider,
                model,
            });
        } catch (error) {
            if (error instanceof ModelAccessDeniedError) {
                return addGatewayHeaders(
                    NextResponse.json({ error: 'model_not_allowed', message: error.message }, { status: 403 }),
                    { requestId: ctx.requestId },
                );
            }
            throw error;
        }

        // Resolve the vendor key (project BYOK first, managed fallback) and
        // confirm pricing BEFORE the billable upstream call, so a missing key
        // or pricing row fails closed instead of judging unbilled.
        const resolved = await adapter.resolveKey(ctx.supabase, ctx.projectId, ctx.organizationId);
        if (!resolved) {
            await logGatewayRequest(ctx, {
                endpoint: 'v1/judgments',
                model,
                provider,
                status: 'error',
                errorMessage: `No ${provider} key configured`,
            });
            return addGatewayHeaders(
                NextResponse.json(
                    { error: 'provider_connection_required', message: `No ${provider} key configured. Add a ${provider} provider key in project settings.` },
                    { status: 402 },
                ),
                { requestId: ctx.requestId },
            );
        }
        // Pricing confirmed pre-call so an unpriced model fails closed.
        await adapter.price(model, 0);

        const result = await adapter.evaluate(resolved.key, judged);
        // Upstream may resolve aliases (jev-latest → jev-1.13.0): bill the id
        // that answered, falling back to the requested id for pricing.
        let costUsd = 0;
        try {
            costUsd = await adapter.price(result.model, result.usage.input_tokens);
        } catch {
            costUsd = await adapter.price(model, result.usage.input_tokens);
        }
        const cencoriCharge = resolved.usesByok ? 0 : costUsd;

        await logGatewayRequest(ctx, {
            endpoint: 'v1/judgments',
            model: result.model,
            provider,
            status: 'success',
            promptTokens: result.usage.input_tokens,
            completionTokens: result.usage.output_tokens,
            totalTokens: result.usage.input_tokens + result.usage.output_tokens,
            costUsd: cencoriCharge,
            providerCostUsd: costUsd,
            cencoriChargeUsd: cencoriCharge,
            markupPercentage: 0,
            metadata: { uses_byok: resolved.usesByok, requested_model: model },
            requestPayload: { model, questions: Object.keys(judged.questions) },
            responsePayload: { model: result.model, usage: result.usage },
        });
        await incrementUsage(ctx, cencoriCharge);

        return addGatewayHeaders(
            NextResponse.json({
                object: 'judgment',
                model: result.model,
                answers: result.answers,
                usage: {
                    input_tokens: result.usage.input_tokens,
                    output_tokens: result.usage.output_tokens,
                },
                ...(resolved.usesByok ? { uses_byok: true } : {}),
            }),
            { requestId: ctx.requestId },
        );
    } catch (error) {
        if (error instanceof JudgmentRequestError) {
            return addGatewayHeaders(
                NextResponse.json({ error: error.code, message: error.message }, { status: error.status }),
                { requestId: ctx.requestId },
            );
        }
        if (error instanceof JudgmentUpstreamError) {
            await logGatewayRequest(ctx, {
                endpoint: 'v1/judgments',
                model,
                provider,
                status: 'error',
                errorMessage: error.message,
            });
            const status = error.status === 429 ? 429 : 502;
            return addGatewayHeaders(
                NextResponse.json({ error: error.code, message: error.message }, { status }),
                { requestId: ctx.requestId },
            );
        }
        console.error('[Judgments] unexpected error:', error);
        await logGatewayRequest(ctx, {
            endpoint: 'v1/judgments',
            model,
            provider,
            status: 'error',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        return addGatewayHeaders(
            NextResponse.json({ error: 'internal_error', message: 'Judgment request failed' }, { status: 500 }),
            { requestId: ctx.requestId },
        );
    }
}
