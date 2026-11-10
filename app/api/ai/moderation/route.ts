import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import OpenAI from 'openai';
import { decryptApiKey } from '@/lib/encryption';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
} from '@/lib/gateway-middleware';
import { promptPayload, toLoggedText } from '@/lib/gateway/log-payload';
import { executeGatewayChat } from '@/lib/gateway/chat-executor';
import type { SubscriptionTier } from '@/lib/entitlements';
import {
    moderate,
    ModerationInputError,
    DEFAULT_MODEL,
    MAX_ITEMS,
    type ModerationLayer,
    type ModerationOptions,
    type EscalationMode,
} from '@/lib/moderation';
import { DEFAULT_LLM_MODEL } from '@/lib/moderation/llm';
import { CENCORI_CATEGORIES, OPENAI_CATEGORIES, DEFAULT_BLOCK_THRESHOLD, DEFAULT_FLAG_THRESHOLD } from '@/lib/moderation/categories';
import { RULES_VERSION } from '@/lib/moderation/rules';

const LAYERS: ModerationLayer[] = ['rules', 'openai', 'llm'];
const ESCALATION: EscalationMode[] = ['auto', 'always', 'never'];

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function inputToText(input: unknown): string {
    if (typeof input === 'string') return input;
    if (!Array.isArray(input)) return '';
    return input
        .map((x) => (typeof x === 'string' ? x : x?.type === 'text' ? String(x.text ?? '') : x?.type === 'image_url' ? '[image]' : ''))
        .join('\n');
}

function badRequest(message: string, requestId: string) {
    return addGatewayHeaders(
        NextResponse.json({ error: 'bad_request', message }, { status: 400 }),
        { requestId },
    );
}

export async function POST(req: NextRequest) {
    const validation = await validateGatewayRequest(req);
    if (!validation.success) {
        return validation.response;
    }
    const ctx = validation.context;

    // Kept outside the try so the failure path can still log what was sent.
    let inputForLog = '';
    let model = DEFAULT_MODEL;

    try {
        let body: Record<string, unknown>;
        try {
            body = await req.json();
        } catch {
            return badRequest('Body must be JSON', ctx.requestId);
        }
        const { input } = body;
        inputForLog = inputToText(input);
        if (typeof body.model === 'string' && body.model) model = body.model;

        const layers = body.layers;
        if (layers !== undefined && (!Array.isArray(layers) || layers.some((l) => !LAYERS.includes(l)))) {
            return badRequest(`layers must be an array of ${LAYERS.map((l) => `"${l}"`).join(', ')}`, ctx.requestId);
        }
        const thresholds = body.thresholds;
        if (thresholds !== undefined && (typeof thresholds !== 'object' || thresholds === null || Array.isArray(thresholds))) {
            return badRequest('thresholds must be an object of category → number', ctx.requestId);
        }

        if (body.escalate !== undefined && !ESCALATION.includes(body.escalate as EscalationMode)) {
            return badRequest('escalate must be "auto", "always" or "never"', ctx.requestId);
        }
        if (body.llm_model !== undefined && typeof body.llm_model !== 'string') {
            return badRequest('llm_model must be a string', ctx.requestId);
        }

        const options: ModerationOptions = {
            model,
            layers: layers as ModerationLayer[] | undefined,
            thresholds: thresholds as ModerationOptions['thresholds'],
            block_threshold: typeof body.block_threshold === 'number' ? body.block_threshold : undefined,
            escalate: body.escalate as EscalationMode | undefined,
            llm_model: body.llm_model as string | undefined,
            custom_categories: body.custom_categories as ModerationOptions['custom_categories'],
            blocklist: body.blocklist as string[] | undefined,
            allowlist: body.allowlist as string[] | undefined,
            brand_names: body.brand_names as string[] | undefined,
            context: body.context as string | undefined,
            previous_messages: body.previous_messages as ModerationOptions['previous_messages'],
            category_actions: body.category_actions as ModerationOptions['category_actions'],
        };
        const tier = (ctx.tier || 'free') as SubscriptionTier;
        let llmProvider: string | null = null;

        const response = await moderate(input, options, {
            getOpenAI: async () => {
                // BYOK first, then the managed key.
                const { data: providerKey } = await ctx.supabase
                    .from('provider_keys')
                    .select('encrypted_key')
                    .eq('project_id', ctx.projectId)
                    .eq('provider', 'openai')
                    .eq('is_active', true)
                    .maybeSingle();
                const key = providerKey?.encrypted_key
                    ? decryptApiKey(providerKey.encrypted_key, ctx.organizationId)
                    : process.env.OPENAI_API_KEY ?? null;
                return key ? new OpenAI({ apiKey: key, timeout: 20_000, maxRetries: 1 }) : null;
            },
            // Billed like any gateway call: provider cost plus the usual markup.
            llm: async ({ model: llmModel, system, user, maxTokens }) => {
                const res = await executeGatewayChat({
                    supabase: ctx.supabase,
                    projectId: ctx.projectId,
                    organizationId: ctx.organizationId,
                    tier,
                    requestId: ctx.requestId,
                    request: {
                        model: llmModel,
                        temperature: 0,
                        maxTokens,
                        userId: ctx.projectId,
                        messages: [
                            { role: 'system', content: system },
                            { role: 'user', content: user },
                        ],
                    },
                });
                llmProvider = res.actualProvider;
                return { content: res.content ?? '', model: res.actualModel, costUsd: res.cost.cencoriChargeUsd ?? 0 };
            },
        });
        const chargeUsd = response.usage.cost_usd;

        const flagged = response.results.filter((r) => r.flagged);
        const flaggedCategories = [...new Set(flagged.flatMap((r) => r.flagged_categories))];
        const anyBlock = response.results.some((r) => r.action === 'block');
        const estimatedTokens = Math.ceil(inputForLog.length / 4);

        await logGatewayRequest(ctx, {
            endpoint: 'moderation',
            model: response.model,
            provider: response.layers.openai === 'ok' ? 'openai' : llmProvider ?? 'cencori',
            status: flagged.length ? 'filtered' : 'success',
            promptTokens: estimatedTokens,
            totalTokens: estimatedTokens,
            // Rules and OpenAI are free; only the model layer costs anything.
            costUsd: chargeUsd,
            cencoriChargeUsd: chargeUsd,
            metadata: {
                flagged: flagged.length > 0,
                results_count: response.results.length,
                flagged_count: flagged.length,
                categories: flaggedCategories,
                layers: response.layers,
                usage: response.usage,
            },
            requestPayload: promptPayload(inputForLog, { model }),
            responsePayload: {
                flagged: flagged.length > 0,
                results: response.results.map((r) => ({
                    flagged: r.flagged,
                    action: r.action,
                    categories: r.flagged_categories,
                })),
            },
        });
        await incrementUsage(ctx, chargeUsd > 0 ? chargeUsd : undefined);

        if (flagged.length) {
            await ctx.supabase.from('security_incidents').insert({
                id: crypto.randomUUID(),
                project_id: ctx.projectId,
                organization_id: ctx.organizationId,
                environment: ctx.environment === 'test' ? 'test' : 'production',
                incident_type: 'content_moderation',
                severity: anyBlock ? 'high' : 'medium',
                description: `Content flagged for: ${flaggedCategories.join(', ')}`,
                // Without input_text the incident opens blank in the console.
                input_text: toLoggedText(inputForLog),
                details: { reasons: flaggedCategories },
                metadata: {
                    categories: flaggedCategories,
                    request_id: ctx.requestId,
                    flagged_count: flagged.length,
                    results_count: response.results.length,
                },
                created_at: new Date().toISOString(),
            });
        }

        const res = NextResponse.json(response);
        if (response.layers.openai === 'error') res.headers.set('X-Cencori-Moderation-Degraded', 'openai');
        return addGatewayHeaders(res, { requestId: ctx.requestId });
    } catch (error) {
        if (error instanceof ModerationInputError) {
            return badRequest(error.message, ctx.requestId);
        }
        console.error('Moderation API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await logGatewayRequest(ctx, {
            endpoint: 'moderation',
            model,
            provider: 'openai',
            status: 'error',
            errorMessage,
            requestPayload: promptPayload(inputForLog),
        });

        return addGatewayHeaders(
            NextResponse.json({ error: 'internal_error', message: errorMessage }, { status: 500 }),
            { requestId: ctx.requestId },
        );
    }
}

export async function GET() {
    return NextResponse.json({
        default_model: DEFAULT_MODEL,
        models: [
            { id: 'omni-moderation-latest', description: 'OpenAI multimodal moderation (text + images). Default.' },
            { id: 'text-moderation-latest', description: 'OpenAI legacy text-only moderation.' },
        ],
        layers: {
            rules: `Cencori fraud and local-language rules (${RULES_VERSION}). Free, runs locally.`,
            openai: 'OpenAI moderation for the standard safety categories. Free.',
            llm: `A cheap model (default ${DEFAULT_LLM_MODEL}) for unclear items and custom categories. Billed per token; batched and cached.`,
        },
        default_llm_model: DEFAULT_LLM_MODEL,
        max_items: MAX_ITEMS,
        default_flag_threshold: DEFAULT_FLAG_THRESHOLD,
        default_block_threshold: DEFAULT_BLOCK_THRESHOLD,
        categories: [
            ...OPENAI_CATEGORIES.map((id) => ({ id, source: 'openai' })),
            ...Object.entries(CENCORI_CATEGORIES).map(([id, description]) => ({ id, source: 'cencori', description })),
        ],
    });
}
