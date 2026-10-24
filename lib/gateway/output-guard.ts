import type { createAdminClient } from '@/lib/supabaseAdmin';
import type { SecurityCheckResult } from '@/lib/safety/multi-layer-check';
import type { UnifiedMessage } from '@/lib/providers/base';
import type { GatewayGuardBlock } from '@/lib/gateway/guard-types';
import { enforcePolicies, type PolicyRedaction } from '@/lib/governance/policy-enforcement';

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
    /** Set to enable policy-as-code enforcement (PRD M1.2). Omit = policy skipped. */
    organizationId?: string | null;
    model?: string | null;
    region?: string | null;
    /**
     * Explicit dashboard opt-in for the legacy output scanner. Absent/false =
     * no scan (safe, zero risk signals); governance policies still enforce.
     */
    securityEnabled?: boolean;
};

export type OutputGuardResult =
    | { ok: true; redactions?: PolicyRedaction[] }
    | (GatewayGuardBlock & { ok: false });

export async function runGatewayOutputGuard(
    params: OutputGuardParams
): Promise<OutputGuardResult> {
    // Without organization governance context, output is allowed. The legacy
    // scanner is intentionally not run on this path: its broad heuristics
    // caused false positives and user-visible stream failures.
    if (!params.organizationId) {
        return { ok: true };
    }

    // Output is never scanned (Cencori only offers opt-in PII protection on
    // input). Only governance policy-as-code, when enabled, may act on output.
    const enforcement = await enforcePolicies(params.supabase, {
        orgId: params.organizationId,
        projectId: params.projectId,
        direction: 'output',
        model: params.model,
        environment: params.environment,
        region: params.region,
        content: params.outputText,
        signals: { risk_score: 0 },
        apiKeyId: params.apiKeyId,
    });
    if (enforcement.block) {
        return {
            ok: false,
            status: enforcement.block.status,
            code: enforcement.block.code,
            message: enforcement.block.message,
            reasons: enforcement.block.reasons,
        };
    }
    // Return redact/tokenize directives; the caller applies them to the
    // actual emitted text (the guard scans a joined string for signals).
    if (enforcement.redactions.length > 0) {
        return { ok: true, redactions: enforcement.redactions };
    }

    return { ok: true };
}
