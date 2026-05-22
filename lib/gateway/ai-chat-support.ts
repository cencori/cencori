import crypto from 'crypto';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { deductCredits } from '@/lib/credits';
import { checkOutputSecurity } from '@/lib/safety/multi-layer-check';
import type { SecurityCheckResult } from '@/lib/safety/multi-layer-check';
import type { UnifiedMessage } from '@/lib/providers/base';
import { deTokenize } from '@/lib/safety/custom-data-rules';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export async function incrementMonthlyUsage(
    supabase: SupabaseAdmin,
    organizationId: string,
    fallbackUsage: number
): Promise<void> {
    const { error } = await supabase.rpc('increment_monthly_usage', { org_id: organizationId });
    if (!error) return;
    await supabase
        .from('organizations')
        .update({ monthly_requests_used: fallbackUsage + 1 })
        .eq('id', organizationId);
}

export async function chargeUsageCredits(
    supabase: SupabaseAdmin,
    organizationId: string,
    tier: string,
    amount: number,
    referenceId: string | null,
    endpoint: string
): Promise<void> {
    if (tier === 'free' || tier === 'enterprise') return;
    if (!(amount > 0) || !referenceId) return;

    const { data: existingCharge, error: existingChargeError } = await supabase
        .from('credit_transactions')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('transaction_type', 'usage')
        .eq('reference_id', referenceId)
        .maybeSingle();

    if (existingChargeError) {
        console.warn(
            `[Billing] Failed to check existing charge for reference=${referenceId}:`,
            existingChargeError.message
        );
    }
    if (existingCharge?.id) return;

    const charged = await deductCredits(
        organizationId,
        amount,
        `Usage charge: ${endpoint}`,
        referenceId
    );
    if (!charged) {
        console.warn(
            `[Billing] Failed to deduct credits for org=${organizationId} endpoint=${endpoint} amount=${amount}`
        );
    }
}

export function parseCachedPayload(rawPayload: unknown): Record<string, unknown> | null {
    if (!rawPayload) return null;
    if (typeof rawPayload === 'object') return rawPayload as Record<string, unknown>;
    if (typeof rawPayload === 'string') {
        try {
            const parsed = JSON.parse(rawPayload);
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
        } catch {
            return null;
        }
    }
    return null;
}

export function getCachedContent(payload: Record<string, unknown>): string {
    if (typeof payload.content === 'string') return payload.content;
    const choices = payload.choices;
    if (!Array.isArray(choices) || choices.length === 0) return '';
    const firstChoice = choices[0];
    if (!firstChoice || typeof firstChoice !== 'object') return '';
    const message = (firstChoice as Record<string, unknown>).message;
    if (!message || typeof message !== 'object') return '';
    const content = (message as Record<string, unknown>).content;
    return typeof content === 'string' ? content : '';
}

export function getCachedUsage(payload: Record<string, unknown>): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
} {
    const usageRaw = payload.usage;
    const usage =
        usageRaw && typeof usageRaw === 'object' ? (usageRaw as Record<string, unknown>) : {};
    const parseNumber = (value: unknown) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };
    const promptTokens = parseNumber(usage.prompt_tokens ?? usage.promptTokens);
    const completionTokens = parseNumber(usage.completion_tokens ?? usage.completionTokens);
    const totalTokens = parseNumber(usage.total_tokens ?? usage.totalTokens);
    return {
        promptTokens,
        completionTokens,
        totalTokens: totalTokens > 0 ? totalTokens : promptTokens + completionTokens,
    };
}

export function buildCencoriChatResponse(params: {
    content: string;
    actualModel: string;
    actualProvider: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    costUsd: number;
    finishReason?: string;
    toolCalls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
    usedFallback?: boolean;
    originalModel?: string;
    originalProvider?: string;
    cacheHit?: { type: 'exact' | 'semantic' };
}): Record<string, unknown> {
    const completionId = `chatcmpl-${crypto.randomUUID()}`;
    const createdAt = Math.floor(Date.now() / 1000);
    const openAiToolCalls = params.toolCalls;

    const body: Record<string, unknown> = {
        id: completionId,
        object: 'chat.completion',
        created: createdAt,
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: params.content,
                    ...(openAiToolCalls && openAiToolCalls.length > 0
                        ? { tool_calls: openAiToolCalls }
                        : {}),
                },
                finish_reason: params.finishReason,
            },
        ],
        content: params.content,
        model: params.actualModel,
        provider: params.actualProvider,
        ...(openAiToolCalls && openAiToolCalls.length > 0 ? { tool_calls: openAiToolCalls } : {}),
        toolCalls: openAiToolCalls ?? null,
        usage: {
            prompt_tokens: params.usage.promptTokens,
            completion_tokens: params.usage.completionTokens,
            total_tokens: params.usage.totalTokens,
        },
        cost_usd: params.costUsd,
        finish_reason: params.finishReason,
    };

    if (params.usedFallback) {
        body.fallback_used = true;
        body.original_model = params.originalModel;
        body.original_provider = params.originalProvider;
    }
    if (params.cacheHit) {
        body.cache_hit = true;
        body.cache_type = params.cacheHit.type;
    }

    return body;
}

export function validateCachedOutput(params: {
    cachedContent: string;
    tokenMap?: Map<string, string>;
    inputText: string;
    inputSecurity: SecurityCheckResult;
    conversationHistory: UnifiedMessage[];
}): string | null {
    const finalContent = params.tokenMap
        ? deTokenize(params.cachedContent, params.tokenMap)
        : params.cachedContent;
    const outputSecurity = checkOutputSecurity(finalContent, {
        inputText: params.inputText,
        inputSecurityResult: params.inputSecurity,
        conversationHistory: params.conversationHistory,
    });
    if (!outputSecurity.safe) {
        console.warn('[Cache] Ignoring cache hit because output failed current policy checks');
        return null;
    }
    return finalContent;
}
