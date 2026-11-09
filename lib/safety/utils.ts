/**
 * Shared Safety Utilities
 * 
 * Functions used across multiple AI gateway routes for security config.
 */

import { hasFeature } from '@/lib/entitlements';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { ProjectSecurityConfig } from '@/lib/safety/multi-layer-check';
import type { SubscriptionTier } from '@/lib/entitlements';
import {
    getCachedSecurityConfig,
    setCachedSecurityConfig,
} from '@/lib/config-cache';

/**
 * Settings-row state. Scanning is explicit opt-in: nothing runs unless the
 * project turned it on on the dashboard (`security_settings.security_enabled`).
 * No row or an unset flag means fully disabled. Lexical defaults produced
 * false positives on ordinary agent traffic (coding-agent system prompts read
 * as instruction overrides), so protection is a deliberate per-project choice.
 */
export type CachedSecuritySettings = {
    enabled: boolean;
    inputThreshold: number;
    outputThreshold: number;
    jailbreakThreshold: number;
    filterJailbreaks: boolean;
    filterPII: boolean;
    filterPromptInjection: boolean;
};

type SecuritySettingsRow = {
    security_enabled?: boolean | null;
    safety_threshold?: number | null;
    filter_jailbreaks?: boolean | null;
    filter_pii?: boolean | null;
    filter_prompt_injection?: boolean | null;
} | null | undefined;

const DISABLED_SECURITY_SETTINGS: CachedSecuritySettings = {
    enabled: false,
    inputThreshold: 0.5,
    outputThreshold: 0.6,
    jailbreakThreshold: 0.7,
    filterJailbreaks: false,
    filterPII: false,
    filterPromptInjection: false,
};

/**
 * Pure row → cache-shape mapper. Shared by the DB reader below and the
 * gateway request warmer so a packed bundle seeds exactly what a DB read
 * would have cached.
 */
export function toCachedSecuritySettings(row: SecuritySettingsRow): CachedSecuritySettings {
    if (!row || row.security_enabled !== true) {
        return { ...DISABLED_SECURITY_SETTINGS };
    }
    const safetyThreshold = row.safety_threshold ?? 0.7;
    const inputThreshold = safetyThreshold; // Strictly follow the UI value
    return {
        enabled: true,
        inputThreshold,
        outputThreshold: Math.max(0.1, inputThreshold - 0.1), // Slightly more lenient output check
        jailbreakThreshold: Math.max(0.2, inputThreshold),
        filterJailbreaks: row.filter_jailbreaks ?? true,
        filterPII: row.filter_pii ?? true,
        filterPromptInjection: row.filter_prompt_injection ?? true,
    };
}

/**
 * Get project security configuration from database.
 *
 * Explicit opt-in, and Pro only: scanning runs iff the project enabled it on
 * the dashboard (`security_settings.security_enabled`) AND the org's plan
 * includes security. An org that turned it on and then left Pro stops being
 * scanned. The plan is read here from the project's org, not taken from the
 * caller, because several paths pass a placeholder tier ('embedded') or none.
 */
export async function getProjectSecurityConfig(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string,
    _tier: SubscriptionTier = 'free'
): Promise<ProjectSecurityConfig> {
    // Only PII protection remains; the other cached flags are ignored.
    const securityIncluded = await projectIncludesSecurity(supabase, projectId);
    const applyExplicit = (settings: CachedSecuritySettings): ProjectSecurityConfig => ({
        enabled: securityIncluded && settings.enabled,
        filterPII: securityIncluded && settings.filterPII,
    });

    const cached = await getCachedSecurityConfig(projectId);
    if (cached?.data) {
        return applyExplicit(cached.data as CachedSecuritySettings);
    }

    try {
        const { data: settings } = await supabase
            .from('security_settings')
            .select('*')
            .eq('project_id', projectId)
            .single();

        // Null row (never configured) maps to fully disabled, as does any
        // warmer-seeded bundle without the explicit switch.
        const resolved = toCachedSecuritySettings(settings);
        void setCachedSecurityConfig(projectId, resolved);
        return applyExplicit(resolved);
    } catch (error) {
        console.warn('[Security] Failed to fetch security settings:', error);
        return applyExplicit({ ...DISABLED_SECURITY_SETTINGS });
    }
}

// ── Plan check for security ──
// Short in-process memo: the plan changes rarely, and this runs on every request.
const PLAN_MEMO_MS = 60_000;
const planMemo = new Map<string, { included: boolean; at: number }>();

/** Whether the project's org plan includes security (Pro and up; business accounts follow their own setting). */
export async function projectIncludesSecurity(supabase: ReturnType<typeof createAdminClient>, projectId: string): Promise<boolean> {
    const hit = planMemo.get(projectId);
    if (hit && Date.now() - hit.at < PLAN_MEMO_MS) return hit.included;
    try {
        const { data } = await supabase
            .from('projects')
            .select('organizations!inner(subscription_tier, account_type)')
            .eq('id', projectId)
            .maybeSingle();
        const org = (data as { organizations?: { subscription_tier?: string | null; account_type?: string | null } } | null)?.organizations;
        // Unknown project/org: keep the explicit setting rather than silently unprotect.
        if (!org) return true;
        const included = org.account_type === 'business' || hasFeature((org.subscription_tier || 'free') as SubscriptionTier, 'security');
        planMemo.set(projectId, { included, at: Date.now() });
        return included;
    } catch {
        // A read failure must not switch protection off.
        return true;
    }
}
