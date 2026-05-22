import type { createAdminClient } from '@/lib/supabaseAdmin';
import { checkInputSecurity, type SecurityCheckResult } from '@/lib/safety/multi-layer-check';
import { getProjectSecurityConfig } from '@/lib/safety/utils';
import { triggerSecurityWebhook } from '@/lib/webhooks';
import type { SubscriptionTier } from '@/lib/entitlements';
import type { UnifiedMessage } from '@/lib/providers/base';
import {
    fetchAndProcessCustomRules,
    applyCustomRulesToUserMessages,
} from '@/lib/gateway/custom-rules';
import type { GatewayGuardBlock, GatewayInputPipelineResult } from '@/lib/gateway/guard-types';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type RunGatewayInputPipelineParams = {
    supabase: SupabaseAdmin;
    projectId: string;
    apiKeyId?: string | null;
    environment?: string;
    tier: SubscriptionTier;
    messages: UnifiedMessage[];
    endUserId?: string | null;
};

async function logSecurityBlock(
    supabase: SupabaseAdmin,
    params: RunGatewayInputPipelineParams,
    inputSecurity: SecurityCheckResult,
    inputText: string
) {
    const severity = inputSecurity.riskScore > 0.8 ? 'critical' : 'high';
    const { error } = await supabase.from('security_incidents').insert({
        project_id: params.projectId,
        api_key_id: params.apiKeyId ?? null,
        environment: params.environment || 'production',
        incident_type: inputSecurity.layer,
        severity,
        description: `Blocked ${inputSecurity.layer} attack: ${inputSecurity.reasons.join(', ')}`,
        input_text: inputText,
        risk_score: Math.min(Math.max(inputSecurity.riskScore, 0), 1),
        details: inputSecurity.details,
        action_taken: 'blocked',
        end_user_id: params.endUserId ?? null,
        blocked_at: 'input',
        detection_method: inputSecurity.layer,
    });
    if (error) {
        console.error('[SECURITY] Failed to log incident:', error);
    }

    void triggerSecurityWebhook(params.projectId, {
        incident_type: inputSecurity.layer,
        severity,
        description: `Blocked ${inputSecurity.layer} attack: ${inputSecurity.reasons.join(', ')}`,
        end_user_id: params.endUserId || undefined,
    });
}

async function logCustomRuleBlock(
    supabase: SupabaseAdmin,
    projectId: string,
    environment: string | undefined,
    ruleName: string,
    inputText: string
) {
    const { error } = await supabase.from('security_incidents').insert({
        project_id: projectId,
        environment: environment || 'production',
        incident_type: 'data_rule_block',
        severity: 'high',
        risk_score: 0.8,
        description: `Blocked by data rule: ${ruleName}`,
        input_text: inputText.substring(0, 500),
        blocked_at: 'input',
        detection_method: 'custom_data_rule',
        action_taken: 'blocked',
    });
    if (error) {
        console.error('[CustomRules] Failed to log block incident:', error);
    }
}

/**
 * Shared pre-provider pipeline: jailbreak/PII input scan + custom data rules.
 * Used by /api/v1/chat/completions and /api/ai/chat (and other gateway routes).
 */
export async function runGatewayInputPipeline(
    params: RunGatewayInputPipelineParams
): Promise<GatewayInputPipelineResult> {
    const lastUser = params.messages.slice().reverse().find((m) => m.role === 'user');
    const inputText = lastUser?.content || '';

    const securityConfig = await getProjectSecurityConfig(
        params.supabase,
        params.projectId,
        params.tier
    );

    const inputSecurity = checkInputSecurity(inputText, params.messages, securityConfig);

    if (!inputSecurity.safe) {
        await logSecurityBlock(params.supabase, params, inputSecurity, inputText);
        const block: GatewayGuardBlock = {
            ok: false,
            status: 403,
            code: 'security_violation',
            message: 'Security violation detected',
            assistantMessage:
                'I cannot provide that information as it may contain sensitive data or violates our safety policies.',
            reasons: inputSecurity.reasons,
        };
        return block;
    }

    const customRules = await fetchAndProcessCustomRules(
        params.supabase,
        params.projectId,
        inputText
    );

    if (customRules.inputResult.shouldBlock) {
        const blockRule = customRules.inputResult.matchedRules.find((r) => r.rule.action === 'block');
        if (blockRule) {
            await logCustomRuleBlock(
                params.supabase,
                params.projectId,
                params.environment,
                blockRule.rule.name,
                inputText
            );
        }
        const matchedRuleNames = customRules.inputResult.matchedRules
            .filter((r) => r.rule.action === 'block')
            .map((r) => r.rule.name);
        const block: GatewayGuardBlock = {
            ok: false,
            status: 403,
            code: 'data_rule_block',
            message: 'Request blocked by data rule',
            assistantMessage:
                'This request contains content that matches a blocked data pattern.',
            matched_rules: matchedRuleNames,
        };
        return block;
    }

    let messages = params.messages;
    let tokenMap = customRules.inputResult.tokenMap;

    if (customRules.inputResult.wasProcessed && customRules.rules.length > 0) {
        const applied = await applyCustomRulesToUserMessages(
            messages,
            customRules.rules,
            tokenMap
        );
        messages = applied.messages;
        tokenMap = applied.tokenMap;
    }

    return {
        ok: true,
        messages,
        inputText,
        inputSecurity,
        customRules,
        tokenMap,
    };
}
