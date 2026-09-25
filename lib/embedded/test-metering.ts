import type { createAdminClient } from '@/lib/supabaseAdmin';
import { chargeProjectUsageCredits } from '@/lib/project-credit-billing';

type Admin = ReturnType<typeof createAdminClient>;

export interface AgentTestUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface AgentTestCost {
    providerCostUsd: number;
    cencoriChargeUsd: number;
    markupPercentage: number;
}

/**
 * Meter a sandbox agent test (studio console or API version test).
 *
 * Both test routes execute a real managed model call via executeGatewayChat
 * but historically returned the response without touching the credit wallet
 * or writing an ai_requests row — leaving the $5 grant untouched and the
 * ledger blind. This helper performs the same two steps normal runs do:
 *
 *   1. Idempotent wallet debit (credit_transactions reference_id = requestId).
 *      requestId MUST be a pure UUID: credit_transactions.reference_id is UUID
 *      in the live schema, so prefixed ids (studio_test_…, test_…) make the
 *      deduct RPC reject the insert and every test surfaces as unchargeable.
 *   2. ai_requests usage row (request_id = requestId) attributed to the agent.
 *
 * Must be called BEFORE the caller records passing test evidence. Returns
 * ok:false when the charge or the metering insert fails so the caller can
 * leave last_test_passed=false and surface 402/502 instead of a free pass.
 */
export async function meterAgentTestUsage(params: {
    supabase: Admin;
    projectId: string;
    organizationId: string;
    tier: string;
    endpoint: 'agents.studio_test' | 'agents.version_test';
    requestId: string;
    agentId: string;
    model: string;
    provider: string;
    usage: AgentTestUsage;
    cost: AgentTestCost;
    latencyMs?: number;
    apiKeyId?: string | null;
    environment?: string;
}): Promise<{ ok: true } | { ok: false; code: 'insufficient_credits' | 'metering_failure'; message: string }> {
    const {
        supabase, projectId, organizationId, tier, endpoint, requestId,
        agentId, model, provider, usage, cost, latencyMs = 0,
        apiKeyId = null, environment = 'production',
    } = params;

    const chargeUsd = Number(cost.cencoriChargeUsd) || 0;
    const providerCostUsd = Number(cost.providerCostUsd) || 0;
    const markupPercentage = Number(cost.markupPercentage) || 0;

    // Idempotency: a retried execution reuses requestId and must not debit
    // twice. deduct_organization_credits inserts blindly, so pre-check the
    // ledger first (same pattern as gateway chargeCreditsForRequest).
    // ai_requests has no unique constraint on request_id, so also skip a
    // second metering row when one already exists.
    try {
        const { data: existingRow } = await supabase
            .from('ai_requests')
            .select('id')
            .eq('project_id', projectId)
            .eq('request_id', requestId)
            .maybeSingle();
        if ((existingRow as { id?: string } | null)?.id) {
            return { ok: true };
        }
    } catch {
        // Pre-check failure must not block metering; the charge path below is
        // still reference-guarded.
    }

    let alreadyCharged = false;
    if (chargeUsd > 0) {
        try {
            const { data: existingCharge } = await supabase
                .from('credit_transactions')
                .select('id')
                .eq('organization_id', organizationId)
                .eq('transaction_type', 'usage')
                .eq('reference_id', requestId)
                .maybeSingle();
            alreadyCharged = Boolean((existingCharge as { id?: string } | null)?.id);
        } catch (error) {
            console.warn(`[AgentTestMetering] Charge idempotency check failed for ${requestId}:`, error);
        }
    }

    let charged = alreadyCharged;
    if (!alreadyCharged) {
        try {
            charged = await chargeProjectUsageCredits(organizationId, tier, chargeUsd, endpoint, requestId);
        } catch {
            charged = false;
        }
    }

    if (!charged && chargeUsd > 0) {
        // Record the failed debit so the ledger shows why the test did not
        // pass, mirroring runs.execute error rows.
        try {
            await supabase.from('ai_requests').insert({
                project_id: projectId,
                api_key_id: apiKeyId,
                environment,
                endpoint,
                model,
                provider,
                status: 'error',
                prompt_tokens: usage.promptTokens || 0,
                completion_tokens: usage.completionTokens || 0,
                total_tokens: usage.totalTokens || 0,
                latency_ms: latencyMs,
                cost_usd: 0,
                provider_cost_usd: providerCostUsd,
                cencori_charge_usd: 0,
                markup_percentage: markupPercentage,
                agent_id: agentId,
                request_id: requestId,
                request_payload: {},
                metadata: { billing_reconciliation_required: true, reason: 'credit_deduction_failed', test: true },
            });
        } catch (error) {
            console.warn('[AgentTestMetering] Failed to log unpaid test usage', { requestId, error });
        }
        return { ok: false, code: 'insufficient_credits', message: 'Unable to charge credits for this test.' };
    }

    const { error: usageError } = await supabase.from('ai_requests').insert({
        project_id: projectId,
        api_key_id: apiKeyId,
        environment,
        endpoint,
        model,
        provider,
        status: 'success',
        prompt_tokens: usage.promptTokens || 0,
        completion_tokens: usage.completionTokens || 0,
        total_tokens: usage.totalTokens || 0,
        latency_ms: latencyMs,
        cost_usd: charged ? chargeUsd : 0,
        provider_cost_usd: providerCostUsd,
        cencori_charge_usd: charged ? chargeUsd : 0,
        markup_percentage: markupPercentage,
        agent_id: agentId,
        request_id: requestId,
        request_payload: {},
        metadata: { test: true },
    });

    if (usageError) {
        console.warn('[AgentTestMetering] Usage insert failed', { requestId, code: usageError.code });
        return { ok: false, code: 'metering_failure', message: 'Test ran, but usage could not be recorded. Try again.' };
    }

    return { ok: true };
}
