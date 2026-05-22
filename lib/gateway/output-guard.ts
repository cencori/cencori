import type { createAdminClient } from '@/lib/supabaseAdmin';
import {
    checkOutputSecurity,
    type SecurityCheckResult,
} from '@/lib/safety/multi-layer-check';
import { triggerSecurityWebhook } from '@/lib/webhooks';
import type { UnifiedMessage } from '@/lib/providers/base';
import type { GatewayGuardBlock } from '@/lib/gateway/guard-types';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type OutputGuardParams = {
    supabase: SupabaseAdmin;
    projectId: string;
    apiKeyId?: string | null;
    environment?: string;
    outputText: string;
    inputText: string;
    inputSecurity: SecurityCheckResult;
    conversationHistory: UnifiedMessage[];
    endUserId?: string | null;
};

export type OutputGuardResult =
    | { ok: true }
    | (GatewayGuardBlock & { ok: false });

export async function runGatewayOutputGuard(
    params: OutputGuardParams
): Promise<OutputGuardResult> {
    const outputSecurity = checkOutputSecurity(params.outputText, {
        inputText: params.inputText,
        inputSecurityResult: params.inputSecurity,
        conversationHistory: params.conversationHistory,
    });

    if (outputSecurity.safe) {
        return { ok: true };
    }

    const severity = 'critical';
    await params.supabase.from('security_incidents').insert({
        project_id: params.projectId,
        api_key_id: params.apiKeyId ?? null,
        environment: params.environment || 'production',
        incident_type: 'output_leakage',
        severity,
        description: `Blocked output leakage: ${outputSecurity.reasons.join(', ')}`,
        input_text: params.inputText,
        output_text: params.outputText.substring(0, 2000),
        risk_score: Math.min(Math.max(outputSecurity.riskScore, 0), 1),
        details: outputSecurity.details,
        action_taken: 'blocked',
        end_user_id: params.endUserId ?? null,
        blocked_at: 'output',
        detection_method: 'automated_check',
    });

    void triggerSecurityWebhook(params.projectId, {
        incident_type: 'output_leakage',
        severity,
        description: `Blocked output leakage: ${outputSecurity.reasons.join(', ')}`,
        end_user_id: params.endUserId || undefined,
    });

    return {
        ok: false,
        status: 403,
        code: 'output_security_violation',
        message: 'Response blocked due to security content policy',
        reasons: outputSecurity.reasons,
    };
}
