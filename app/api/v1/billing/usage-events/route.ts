import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { extractCencoriApiKeyFromHeaders } from '@/lib/api-keys';
import { recordEndUserUsageAsync, calculateCustomerCharge } from '@/lib/end-user-billing';
import crypto from 'crypto';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface UsageEvent {
    end_user_id: string;
    model?: string;
    provider?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost_usd?: number;
    latency_ms?: number;
    status?: 'success' | 'error';
    metadata?: Record<string, unknown>;
}

interface ValidatedEvent extends UsageEvent {
    end_user_id: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

// ──────────────────────────────────────────────
// Key lookup (shared with gateway)
// ──────────────────────────────────────────────

async function authenticateApiKey(req: NextRequest) {
    const apiKey = extractCencoriApiKeyFromHeaders(req.headers);
    if (!apiKey) {
        return { error: 'Missing API key. Provide CENCORI_API_KEY header or Authorization: Bearer <key>', status: 401 };
    }

    const supabase = createAdminClient();
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .select(`
            id,
            project_id,
            environment,
            key_type,
            projects!inner(
                id,
                organization_id,
                end_user_billing_enabled,
                customer_markup_percentage,
                default_rate_plan_id
            )
        `)
        .eq('key_hash', keyHash)
        .is('revoked_at', null)
        .single();

    if (keyError || !keyData) {
        return { error: 'Invalid API key', status: 401 };
    }

    // Only secret keys can report usage
    if (keyData.key_type === 'publishable') {
        return { error: 'Usage reporting requires a secret API key (csk_*)', status: 403 };
    }

    const project = keyData.projects as unknown as {
        id: string;
        organization_id: string;
        end_user_billing_enabled: boolean | null;
        customer_markup_percentage: number | null;
        default_rate_plan_id: string | null;
    };

    if (!project.end_user_billing_enabled) {
        return { error: 'End-user billing is not enabled for this project. Enable it in the dashboard first.', status: 400 };
    }

    return {
        supabase,
        projectId: project.id,
        organizationId: project.organization_id,
        apiKeyId: keyData.id,
        environment: keyData.environment || 'production',
        customerMarkupPercentage: project.customer_markup_percentage ?? 0,
    };
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

function validateEvent(event: unknown, index: number): { valid: ValidatedEvent } | { error: string } {
    if (!event || typeof event !== 'object') {
        return { error: `Event ${index}: must be an object` };
    }

    const e = event as Record<string, unknown>;

    if (!e.end_user_id || typeof e.end_user_id !== 'string' || e.end_user_id.trim().length === 0) {
        return { error: `Event ${index}: end_user_id is required and must be a non-empty string` };
    }

    const promptTokens = Number(e.prompt_tokens) || 0;
    const completionTokens = Number(e.completion_tokens) || 0;
    let totalTokens = Number(e.total_tokens) || 0;

    // Auto-calculate total if not provided
    if (totalTokens === 0 && (promptTokens > 0 || completionTokens > 0)) {
        totalTokens = promptTokens + completionTokens;
    }

    if (totalTokens < 0 || promptTokens < 0 || completionTokens < 0) {
        return { error: `Event ${index}: token counts must be non-negative` };
    }

    if (e.cost_usd !== undefined && (typeof e.cost_usd !== 'number' || e.cost_usd < 0)) {
        return { error: `Event ${index}: cost_usd must be a non-negative number` };
    }

    return {
        valid: {
            ...e,
            end_user_id: (e.end_user_id as string).trim(),
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
        } as ValidatedEvent,
    };
}

// ──────────────────────────────────────────────
// POST — Report usage events (single or batch)
// ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const auth = await authenticateApiKey(req);
        if ('error' in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { supabase, projectId, apiKeyId, environment, customerMarkupPercentage } = auth;

        const body = await req.json();

        // Support both single event and batch
        const rawEvents: unknown[] = Array.isArray(body.events)
            ? body.events
            : Array.isArray(body)
                ? body
                : [body];

        if (rawEvents.length === 0) {
            return NextResponse.json({ error: 'No events provided' }, { status: 400 });
        }

        if (rawEvents.length > 1000) {
            return NextResponse.json(
                { error: 'Maximum 1000 events per batch. Split into multiple requests.' },
                { status: 400 }
            );
        }

        // Validate all events
        const validated: ValidatedEvent[] = [];
        const errors: string[] = [];

        for (let i = 0; i < rawEvents.length; i++) {
            const result = validateEvent(rawEvents[i], i);
            if ('error' in result) {
                errors.push(result.error);
            } else {
                validated.push(result.valid);
            }
        }

        if (errors.length > 0 && validated.length === 0) {
            return NextResponse.json({ error: 'All events failed validation', details: errors }, { status: 400 });
        }

        // Look up rate plan markup for each unique end-user
        const uniqueUserIds = [...new Set(validated.map(e => e.end_user_id))];
        const userMarkups: Record<string, { markupPercentage: number; flatRatePerRequest: number | null }> = {};

        if (uniqueUserIds.length > 0) {
            const { data: endUsers } = await supabase
                .from('end_users')
                .select('external_id, rate_plan_id, rate_plans(markup_percentage, flat_rate_per_request)')
                .eq('project_id', projectId)
                .in('external_id', uniqueUserIds);

            if (endUsers) {
                for (const eu of endUsers) {
                    const plan = eu.rate_plans as { markup_percentage?: number; flat_rate_per_request?: number } | null;
                    userMarkups[eu.external_id] = {
                        markupPercentage: plan?.markup_percentage ?? customerMarkupPercentage,
                        flatRatePerRequest: plan?.flat_rate_per_request ?? null,
                    };
                }
            }
        }

        // Process events
        const results: { end_user_id: string; status: 'recorded' | 'error'; error?: string }[] = [];
        const aiRequestRows: Record<string, unknown>[] = [];

        for (const event of validated) {
            const markup = userMarkups[event.end_user_id] ?? {
                markupPercentage: customerMarkupPercentage,
                flatRatePerRequest: null,
            };

            const providerCostUsd = event.cost_usd ?? 0;
            const cencoriChargeUsd = providerCostUsd; // Cencori's cut is the provider cost (no gateway markup since they're not using the gateway)
            const customerChargeUsd = calculateCustomerCharge(
                cencoriChargeUsd,
                markup.markupPercentage,
                markup.flatRatePerRequest,
            );

            try {
                // Record in end-user usage aggregates (daily + monthly)
                await recordEndUserUsageAsync({
                    projectId,
                    externalUserId: event.end_user_id,
                    environment,
                    tokens: {
                        prompt: event.prompt_tokens,
                        completion: event.completion_tokens,
                        total: event.total_tokens,
                    },
                    cost: {
                        providerUsd: providerCostUsd,
                        cencoriChargeUsd,
                    },
                    customerMarkupPercentage: markup.markupPercentage,
                    flatRatePerRequest: markup.flatRatePerRequest,
                });

                // Build ai_requests row for the raw log
                aiRequestRows.push({
                    project_id: projectId,
                    api_key_id: apiKeyId,
                    environment,
                    endpoint: 'usage-events',
                    model: event.model || 'external',
                    provider: event.provider || 'external',
                    status: event.status || 'success',
                    prompt_tokens: event.prompt_tokens,
                    completion_tokens: event.completion_tokens,
                    total_tokens: event.total_tokens,
                    cost_usd: providerCostUsd,
                    provider_cost_usd: providerCostUsd,
                    cencori_charge_usd: customerChargeUsd,
                    markup_percentage: markup.markupPercentage,
                    latency_ms: event.latency_ms ?? 0,
                    end_user_id: event.end_user_id,
                    metadata: event.metadata ?? {},
                    request_id: crypto.randomUUID(),
                });

                results.push({ end_user_id: event.end_user_id, status: 'recorded' });
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                results.push({ end_user_id: event.end_user_id, status: 'error', error: msg });
            }
        }

        // Bulk insert ai_requests rows
        if (aiRequestRows.length > 0) {
            const { error: insertError } = await supabase
                .from('ai_requests')
                .insert(aiRequestRows);

            if (insertError) {
                console.error('[UsageEvents] Failed to insert ai_requests:', insertError.message);
            }
        }

        const recorded = results.filter(r => r.status === 'recorded').length;
        const failed = results.filter(r => r.status === 'error').length;

        return NextResponse.json({
            recorded,
            failed,
            total: validated.length,
            ...(errors.length > 0 ? { validation_errors: errors } : {}),
            ...(failed > 0 ? { results } : {}),
        }, { status: failed > 0 && recorded === 0 ? 500 : 200 });
    } catch (error) {
        console.error('[UsageEvents] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ──────────────────────────────────────────────
// OPTIONS — CORS preflight
// ──────────────────────────────────────────────

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, CENCORI_API_KEY',
            'Access-Control-Max-Age': '86400',
        },
    });
}
